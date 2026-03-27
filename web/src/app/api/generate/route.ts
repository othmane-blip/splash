import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const GENERATION_PROMPT = `You are a world-class LinkedIn ghostwriter. Your job is to write LinkedIn posts that feel authentic, get high engagement, and match the user's voice.

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

Return ONLY valid JSON, no markdown fences or extra text.`;

export async function POST(req: NextRequest) {
  try {
    const { anthropicKey: clientKey, patterns, topPosts, userContext, numPosts } = await req.json();
    const anthropicKey = process.env.ANTHROPIC_API_KEY || clientKey;

    if (!anthropicKey || !patterns || !topPosts?.length || !userContext) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const client = new Anthropic({ apiKey: anthropicKey });

    const examplePosts = topPosts
      .slice(0, 5)
      .map(
        (p: { author_name: string; likes: number; text: string }, i: number) =>
          `\n--- Example ${i + 1} (${p.author_name}, ${p.likes} likes) ---\n${p.text}\n`
      )
      .join("");

    const prompt = GENERATION_PROMPT.replace("{patterns_json}", JSON.stringify(patterns, null, 2))
      .replace("{example_posts}", examplePosts)
      .replace("{name}", userContext.name || "")
      .replace("{role}", userContext.role || "")
      .replace("{industry}", userContext.industry || "")
      .replace("{expertise}", (userContext.expertise_areas || []).join(", "))
      .replace("{achievements}", (userContext.recent_achievements || []).join(", "))
      .replace("{opinions}", (userContext.opinions || []).join(", "))
      .replace("{audience}", userContext.target_audience || "")
      .replace("{tone}", userContext.tone_preference || "professional")
      .replace("{num_posts}", String(numPosts || 3));

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const responseText = message.content[0].type === "text" ? message.content[0].text : "";
    const posts = parseJsonResponse(responseText);

    return NextResponse.json({ posts });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}

function parseJsonResponse(text: string): unknown[] {
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
