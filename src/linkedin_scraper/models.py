"""Data models for LinkedIn posts and analysis."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class LinkedInPost:
    """Represents a scraped LinkedIn post."""

    author_name: str
    author_url: str
    text: str
    posted_at: str
    likes: int = 0
    comments: int = 0
    shares: int = 0
    impressions: int = 0
    media_type: str = ""  # text, image, video, carousel, article
    post_url: str = ""
    reaction_types: dict[str, int] = field(default_factory=dict)  # LIKE, PRAISE, APPRECIATION, etc.

    @property
    def total_reactions(self) -> int:
        """Total reactions across all types."""
        return sum(self.reaction_types.values()) if self.reaction_types else self.likes

    @property
    def engagement_score(self) -> float:
        """Weighted engagement score: reactions + 2*comments + 3*shares."""
        return self.total_reactions + (2 * self.comments) + (3 * self.shares)


@dataclass
class PostPattern:
    """AI-extracted pattern from a high-performing post."""

    hook_type: str  # question, bold_claim, statistic, story, contrarian
    hook_text: str
    structure: str  # narrative, listicle, framework, before_after, lesson
    tone: str  # professional, conversational, inspirational, provocative
    cta_type: str  # question, agree_disagree, share, tag, none
    key_techniques: list[str] = field(default_factory=list)
    estimated_reading_time: str = ""
    line_count: int = 0


@dataclass
class UserContext:
    """User's professional context for post personalization."""

    name: str = ""
    role: str = ""
    industry: str = ""
    expertise_areas: list[str] = field(default_factory=list)
    recent_achievements: list[str] = field(default_factory=list)
    opinions: list[str] = field(default_factory=list)
    target_audience: str = ""
    tone_preference: str = "professional"  # professional, casual, bold


@dataclass
class GeneratedPost:
    """A generated LinkedIn post ready for publishing."""

    content: str
    inspired_by: str  # author of the original post
    pattern_used: str  # which pattern was applied
    hook_type: str
    estimated_engagement: str  # low, medium, high
    tips: list[str] = field(default_factory=list)
