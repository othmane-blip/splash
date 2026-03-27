"""Claude AI-powered post pattern analysis."""

from __future__ import annotations

import json
import os

import anthropic

from .models import LinkedInPost, PostPattern

PATTERN_ANALYSIS_PROMPT = """\
You are an expert LinkedIn content strategist. Analyze this high-performing LinkedIn post \
and extract its structural patterns.

POST (by {author}, {likes} likes, {comments} comments):
---
{text}
---

Return a JSON object with these fields:
- "hook_type": one of ["question", "bold_claim", "statistic", "story", "contrarian", "personal_revelation", "list_preview"]
- "hook_text": the first 1-2 lines that serve as the hook
- "structure": one of ["narrative", "listicle", "framework", "before_after", "lesson_learned", "hot_take", "case_study"]
- "tone": one of ["professional", "conversational", "inspirational", "provocative", "vulnerable", "educational"]
- "cta_type": one of ["question", "agree_disagree", "share", "tag_someone", "none"]
- "key_techniques": list of 3-5 specific techniques used (e.g., "line breaks for readability", "personal anecdote", "data point", "emoji bullets", "short punchy sentences")
- "estimated_reading_time": e.g., "30 seconds"
- "line_count": approximate number of lines

Return ONLY valid JSON, no markdown fences or extra text."""

BATCH_ANALYSIS_PROMPT = """\
You are an expert LinkedIn content strategist. Analyze these {count} top-performing LinkedIn posts \
and identify the COMMON PATTERNS that make them successful.

POSTS:
{posts_text}

Provide your analysis as JSON with these fields:
- "common_hooks": list of the most effective hook types seen, with examples
- "winning_structures": list of post structures that perform best
- "tone_patterns": what tone combinations work
- "formatting_tricks": specific formatting techniques (line breaks, emojis, spacing)
- "content_themes": recurring themes or topic angles
- "engagement_drivers": what specifically drives comments and shares
- "ideal_post_blueprint": a step-by-step template for crafting a high-performing post
- "dos": list of 5 things to always do
- "donts": list of 5 things to avoid

Return ONLY valid JSON, no markdown fences or extra text."""


def get_client() -> anthropic.Anthropic:
    """Get an Anthropic client."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError(
            "ANTHROPIC_API_KEY not set. Get one at https://console.anthropic.com/"
        )
    return anthropic.Anthropic(api_key=api_key)


def analyze_single_post(post: LinkedInPost) -> PostPattern:
    """Analyze a single post's structure using Claude."""
    client = get_client()

    prompt = PATTERN_ANALYSIS_PROMPT.format(
        author=post.author_name,
        likes=post.likes,
        comments=post.comments,
        text=post.text,
    )

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )

    result = _parse_json_response(message.content[0].text)
    return PostPattern(
        hook_type=result.get("hook_type", "unknown"),
        hook_text=result.get("hook_text", ""),
        structure=result.get("structure", "unknown"),
        tone=result.get("tone", "professional"),
        cta_type=result.get("cta_type", "none"),
        key_techniques=result.get("key_techniques", []),
        estimated_reading_time=result.get("estimated_reading_time", ""),
        line_count=result.get("line_count", 0),
    )


def analyze_post_patterns(posts: list[LinkedInPost]) -> dict:
    """
    Batch-analyze top posts to extract common winning patterns.

    Returns a structured analysis of what makes these posts successful.
    """
    client = get_client()

    posts_text = ""
    for i, post in enumerate(posts, 1):
        posts_text += (
            f"\n--- POST {i} (by {post.author_name}, "
            f"{post.likes} likes, {post.comments} comments) ---\n"
            f"{post.text}\n"
        )

    prompt = BATCH_ANALYSIS_PROMPT.format(count=len(posts), posts_text=posts_text)

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )

    return _parse_json_response(message.content[0].text)


def _parse_json_response(text: str) -> dict:
    """Parse a JSON response from Claude, handling potential markdown fences."""
    text = text.strip()
    # Strip markdown code fences if present
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:])
        if text.endswith("```"):
            text = text[:-3]
    text = text.strip()
    return json.loads(text)
