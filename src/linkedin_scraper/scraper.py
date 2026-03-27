"""LinkedIn post scraper using Apify's harvestapi/linkedin-profile-posts actor."""

from __future__ import annotations

import json
import os
from pathlib import Path

from apify_client import ApifyClient

from .models import LinkedInPost


# HarvestAPI LinkedIn Profile Posts Scraper - no cookies needed
# Docs: https://apify.com/harvestapi/linkedin-profile-posts
ACTOR_ID = "harvestapi/linkedin-profile-posts"


def load_profiles(config_path: str = "config/profiles.json") -> dict:
    """Load target profiles from config file."""
    path = Path(config_path)
    if not path.exists():
        raise FileNotFoundError(
            f"Profile config not found at {config_path}. "
            "Copy config/profiles.json and add your target profiles."
        )
    with open(path) as f:
        return json.load(f)


def scrape_linkedin_posts(
    profile_urls: list[str],
    posts_per_profile: int = 20,
    apify_token: str | None = None,
) -> list[LinkedInPost]:
    """
    Scrape LinkedIn posts from given profile URLs using Apify.

    Uses harvestapi/linkedin-profile-posts which accepts profile URLs
    directly and returns posts with engagement metrics (reactions by type,
    comments, shares, impressions). No cookies or login required.
    """
    token = apify_token or os.environ.get("APIFY_API_TOKEN")
    if not token:
        raise ValueError(
            "APIFY_API_TOKEN not set. Get one at https://console.apify.com/account/integrations"
        )

    client = ApifyClient(token)

    # This actor accepts all profile URLs in a single run
    # and processes up to 6 concurrently
    run_input = {
        "targetUrls": profile_urls,
        "maxPosts": posts_per_profile,
        "scrapeReactions": False,  # Don't deep-scrape individual reactions (saves cost)
        "scrapeComments": False,   # Don't deep-scrape full comment threads (saves cost)
    }

    print(f"  Starting Apify actor for {len(profile_urls)} profiles...")
    print(f"  Max {posts_per_profile} posts per profile")

    run = client.actor(ACTOR_ID).call(run_input=run_input)

    all_posts: list[LinkedInPost] = []
    for item in client.dataset(run["defaultDatasetId"]).iterate_items():
        post = _parse_harvestapi_post(item)
        if post and post.text.strip():
            all_posts.append(post)

    print(f"  Scraped {len(all_posts)} posts total")
    return all_posts


def _parse_harvestapi_post(item: dict) -> LinkedInPost | None:
    """
    Parse a HarvestAPI result item into a LinkedInPost.

    HarvestAPI output fields:
    - commentary: post text
    - author.name, author.position, author.linkedinUrl
    - createdAt / createdAtTimestamp
    - numComments, numShares, numImpressions
    - reactionTypeCounts: [{"type": "LIKE", "count": 123}, ...]
    - images, documents
    - url: direct link to the post
    """
    try:
        # Extract author info
        author = item.get("author", {})
        author_name = author.get("name", "Unknown")
        author_url = author.get("linkedinUrl", "")

        # Extract reaction counts by type
        reaction_types = {}
        total_likes = 0
        for reaction in item.get("reactionTypeCounts", []):
            rtype = reaction.get("type", "LIKE")
            count = _safe_int(reaction.get("count", 0))
            reaction_types[rtype] = count
            total_likes += count

        # Determine media type
        media_type = "text"
        if item.get("images"):
            media_type = "image"
        elif item.get("documents"):
            media_type = "document"
        elif item.get("video"):
            media_type = "video"

        return LinkedInPost(
            author_name=author_name,
            author_url=author_url,
            text=item.get("commentary", ""),
            posted_at=item.get("createdAt", ""),
            likes=total_likes,
            comments=_safe_int(item.get("numComments", 0)),
            shares=_safe_int(item.get("numShares", 0)),
            impressions=_safe_int(item.get("numImpressions", 0)),
            media_type=media_type,
            post_url=item.get("url", ""),
            reaction_types=reaction_types,
        )
    except (KeyError, TypeError):
        return None


def _safe_int(value) -> int:
    """Safely convert a value to int."""
    try:
        return int(value) if value else 0
    except (ValueError, TypeError):
        return 0


def save_posts(posts: list[LinkedInPost], output_path: str = "output/scraped_posts.json"):
    """Save scraped posts to a JSON file."""
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    data = [
        {
            "author_name": p.author_name,
            "author_url": p.author_url,
            "text": p.text,
            "posted_at": p.posted_at,
            "likes": p.likes,
            "comments": p.comments,
            "shares": p.shares,
            "impressions": p.impressions,
            "media_type": p.media_type,
            "post_url": p.post_url,
            "reaction_types": p.reaction_types,
            "engagement_score": p.engagement_score,
        }
        for p in posts
    ]
    with open(output_path, "w") as f:
        json.dump(data, f, indent=2)
    print(f"  Saved {len(posts)} posts to {output_path}")


def load_posts(input_path: str = "output/scraped_posts.json") -> list[LinkedInPost]:
    """Load previously scraped posts from JSON."""
    with open(input_path) as f:
        data = json.load(f)
    return [
        LinkedInPost(
            author_name=d["author_name"],
            author_url=d["author_url"],
            text=d["text"],
            posted_at=d["posted_at"],
            likes=d["likes"],
            comments=d["comments"],
            shares=d["shares"],
            impressions=d.get("impressions", 0),
            media_type=d.get("media_type", "text"),
            post_url=d.get("post_url", ""),
            reaction_types=d.get("reaction_types", {}),
        )
        for d in data
    ]
