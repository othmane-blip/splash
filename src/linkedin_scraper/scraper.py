"""LinkedIn post scraper using Apify API."""

from __future__ import annotations

import json
import os
from pathlib import Path

from apify_client import ApifyClient

from .models import LinkedInPost


# Apify actor for LinkedIn profile scraping
LINKEDIN_SCRAPER_ACTOR = "anchor/linkedin-profile-scraper"
LINKEDIN_POSTS_ACTOR = "apimatica/linkedin-posts-scraper"


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

    Uses the Apify LinkedIn scraper actor to fetch recent posts
    from each profile URL.
    """
    token = apify_token or os.environ.get("APIFY_API_TOKEN")
    if not token:
        raise ValueError(
            "APIFY_API_TOKEN not set. Get one at https://console.apify.com/account/integrations"
        )

    client = ApifyClient(token)
    all_posts: list[LinkedInPost] = []

    for url in profile_urls:
        print(f"  Scraping posts from: {url}")
        try:
            posts = _scrape_profile_posts(client, url, posts_per_profile)
            all_posts.extend(posts)
            print(f"    -> Found {len(posts)} posts")
        except Exception as e:
            print(f"    -> Error scraping {url}: {e}")

    return all_posts


def _scrape_profile_posts(
    client: ApifyClient,
    profile_url: str,
    max_posts: int,
) -> list[LinkedInPost]:
    """Scrape posts from a single LinkedIn profile using Apify."""
    # Run the Apify actor for LinkedIn post scraping
    run_input = {
        "profileUrls": [profile_url],
        "maxPosts": max_posts,
        "proxy": {
            "useApifyProxy": True,
            "apifyProxyGroups": ["RESIDENTIAL"],
        },
    }

    run = client.actor(LINKEDIN_POSTS_ACTOR).call(run_input=run_input)

    posts = []
    for item in client.dataset(run["defaultDatasetId"]).iterate_items():
        post = _parse_apify_post(item, profile_url)
        if post and post.text.strip():
            posts.append(post)

    return posts


def _parse_apify_post(item: dict, profile_url: str) -> LinkedInPost | None:
    """Parse an Apify result item into a LinkedInPost."""
    try:
        return LinkedInPost(
            author_name=item.get("authorName", item.get("author", {}).get("name", "Unknown")),
            author_url=profile_url,
            text=item.get("text", item.get("postText", "")),
            posted_at=item.get("postedAt", item.get("publishedAt", "")),
            likes=_safe_int(item.get("likesCount", item.get("numLikes", 0))),
            comments=_safe_int(item.get("commentsCount", item.get("numComments", 0))),
            shares=_safe_int(item.get("sharesCount", item.get("numShares", 0))),
            media_type=item.get("mediaType", item.get("type", "text")),
            post_url=item.get("postUrl", item.get("url", "")),
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
            "media_type": p.media_type,
            "post_url": p.post_url,
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
            media_type=d.get("media_type", "text"),
            post_url=d.get("post_url", ""),
        )
        for d in data
    ]
