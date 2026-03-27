"""Post ranking and filtering by engagement metrics."""

from __future__ import annotations

from .models import LinkedInPost


def rank_posts_by_engagement(posts: list[LinkedInPost]) -> list[LinkedInPost]:
    """Sort posts by engagement score (descending)."""
    return sorted(posts, key=lambda p: p.engagement_score, reverse=True)


def filter_top_posts(
    posts: list[LinkedInPost],
    top_n: int = 5,
    min_likes: int = 0,
) -> list[LinkedInPost]:
    """
    Filter and return the top performing posts.

    Ranks all posts by engagement score and returns the top N.
    Optionally filters by a minimum likes threshold (default: no filter).
    """
    qualified = [p for p in posts if p.likes >= min_likes]
    ranked = rank_posts_by_engagement(qualified)
    return ranked[:top_n]


def get_engagement_summary(posts: list[LinkedInPost]) -> dict:
    """Generate summary statistics for a set of posts."""
    if not posts:
        return {"total": 0}

    scores = [p.engagement_score for p in posts]
    return {
        "total": len(posts),
        "avg_likes": sum(p.likes for p in posts) / len(posts),
        "avg_comments": sum(p.comments for p in posts) / len(posts),
        "avg_shares": sum(p.shares for p in posts) / len(posts),
        "avg_engagement": sum(scores) / len(scores),
        "max_engagement": max(scores),
        "top_author": max(posts, key=lambda p: p.engagement_score).author_name,
    }


def group_posts_by_author(posts: list[LinkedInPost]) -> dict[str, list[LinkedInPost]]:
    """Group posts by author name."""
    grouped: dict[str, list[LinkedInPost]] = {}
    for post in posts:
        grouped.setdefault(post.author_name, []).append(post)
    return grouped
