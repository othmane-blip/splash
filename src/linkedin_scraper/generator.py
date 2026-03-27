"""LinkedIn post generator using Claude AI."""

from __future__ import annotations

import json
import os
from dataclasses import asdict

import anthropic

from .models import GeneratedPost, LinkedInPost, PostPattern, UserContext

GENERATION_PROMPT = """\
You are a world-class LinkedIn ghostwriter. Your job is to write LinkedIn posts that \
feel authentic, get high engagement, and match the user's voice.

## WINNING PATTERNS FROM TOP PERFORMERS
These patterns were extracted from posts that got thousands of likes and comments:
{patterns_json}

## TOP PERFORMING POSTS FOR INSPIRATION
{example_posts}

## USER'S PROFILE
- Name: {name}
- Role: {role}
- Industry: {industry}
- Expertise: {expertise}
- Recent achievements: {achievements}
- Strong opinions: {opinions}
- Target audience: {audience}
- Preferred tone: {tone}

## YOUR TASK
Generate {num_posts} LinkedIn posts for this user. Each post should:

1. Use a DIFFERENT hook type and structure from the winning patterns above
2. Feel authentic to the user's voice and expertise
3. Be about topics relevant to their industry and audience
4. Include a strong hook in the first 1-2 lines (this is what shows before "...see more")
5. Use proven formatting: short paragraphs, line breaks, punchy sentences
6. End with a clear call-to-action (question, prompt for discussion, etc.)
7. Be 150-300 words (the sweet spot for LinkedIn engagement)

Return a JSON array of objects, each with:
- "content": the full post text (use \\n for line breaks)
- "inspired_by": which top voice pattern inspired this
- "pattern_used": which structure/hook combo was used
- "hook_type": the hook type used
- "estimated_engagement": "low", "medium", or "high"
- "tips": list of 2-3 tips for when to post this and how to boost engagement

Return ONLY valid JSON, no markdown fences or extra text."""


def generate_posts(
    user_context: UserContext,
    patterns: dict,
    top_posts: list[LinkedInPost],
    num_posts: int = 3,
) -> list[GeneratedPost]:
    """Generate personalized LinkedIn posts using Claude."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY not set.")

    client = anthropic.Anthropic(api_key=api_key)

    example_posts = ""
    for i, post in enumerate(top_posts[:5], 1):
        example_posts += (
            f"\n--- Example {i} ({post.author_name}, "
            f"{post.likes} likes) ---\n{post.text}\n"
        )

    prompt = GENERATION_PROMPT.format(
        patterns_json=json.dumps(patterns, indent=2),
        example_posts=example_posts,
        name=user_context.name,
        role=user_context.role,
        industry=user_context.industry,
        expertise=", ".join(user_context.expertise_areas),
        achievements=", ".join(user_context.recent_achievements),
        opinions=", ".join(user_context.opinions),
        audience=user_context.target_audience,
        tone=user_context.tone_preference,
        num_posts=num_posts,
    )

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}],
    )

    response_text = message.content[0].text.strip()
    # Strip markdown fences if present
    if response_text.startswith("```"):
        lines = response_text.split("\n")
        response_text = "\n".join(lines[1:])
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        response_text = response_text.strip()

    results = json.loads(response_text)

    return [
        GeneratedPost(
            content=r["content"],
            inspired_by=r.get("inspired_by", ""),
            pattern_used=r.get("pattern_used", ""),
            hook_type=r.get("hook_type", ""),
            estimated_engagement=r.get("estimated_engagement", "medium"),
            tips=r.get("tips", []),
        )
        for r in results
    ]


def save_generated_posts(posts: list[GeneratedPost], output_path: str = "output/generated_posts.md"):
    """Save generated posts as a readable Markdown file."""
    from pathlib import Path

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    lines = ["# Generated LinkedIn Posts\n"]
    lines.append(f"*Generated {len(posts)} posts ready for publishing.*\n\n---\n")

    for i, post in enumerate(posts, 1):
        lines.append(f"## Post {i}")
        lines.append(f"**Hook type:** {post.hook_type}")
        lines.append(f"**Pattern:** {post.pattern_used}")
        lines.append(f"**Inspired by:** {post.inspired_by}")
        lines.append(f"**Expected engagement:** {post.estimated_engagement}\n")
        lines.append("### Content\n")
        lines.append(f"{post.content}\n")
        if post.tips:
            lines.append("### Tips")
            for tip in post.tips:
                lines.append(f"- {tip}")
        lines.append("\n---\n")

    with open(output_path, "w") as f:
        f.write("\n".join(lines))

    print(f"  Posts saved to {output_path}")
