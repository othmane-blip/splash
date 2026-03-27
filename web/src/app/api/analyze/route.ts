import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const ANALYSIS_PROMPT = `You are an expert LinkedIn content strategist. Analyze these top-performing LinkedIn posts and identify the COMMON PATTERNS that make them successful.

POSTS:
{posts_text}

Provide your analysis as JSON with these fields:
- "common_hooks": list of objects with "type" and "example" fields for the most effective hook types
- "winning_structures": list of objects with "name" and "description" for post structures that perform best
- "tone_patterns": list of what tone combinations work
- "formatting_tricks": list of specific formatting techniques (line breaks, emojis, spacing)
- "content_themes": list of recurring themes or topic angles
- "engagement_drivers": list of what specifically drives comments and shares
- "ideal_post_blueprint": list of objects with "step" and "description" for crafting a high-performing post
- "dos": list of 5 things to always do
- "donts": list of 5 things to avoid

Return ONLY valid JSON, no markdown fences or extra text.`;

export async function POST(req: NextRequest) {
  try {
    const { anthropicKey, posts } = await req.json();

    if (!anthropicKey || !posts?.length) {
      return NextResponse.json({ error: "Missing anthropicKey or posts" }, { status: 400 });
    }

    const client = new Anthropic({ apiKey: anthropicKey });

    const postsText = posts
      .map(
        (p: { author_name: string; likes: number; comments: number; text: string }, i: number) =>
          `\n--- POST ${i + 1} (by ${p.author_name}, ${p.likes} likes, ${p.comments} comments) ---\n${p.text}\n`
      )
      .join("");

    const prompt = ANALYSIS_PROMPT.replace("{posts_text}", postsText);

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const responseText = message.content[0].type === "text" ? message.content[0].text : "";
    const patterns = parseJsonResponse(responseText);

    return NextResponse.json({ patterns });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}

function parseJsonResponse(text: string): Record<string, unknown> {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    const lines = cleaned.split("\n");
    cleaned = lines.slice(1).join("\n");
    if (cleaned.endsWith("```")) {
      cleaned = cleaned.slice(0, -3);
    }
  }
  return JSON.parse(cleaned.trim());
}
