import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

function buildSystemPrompt(
  patterns: Record<string, unknown>,
  topPosts: Array<{ author_name: string; likes: number; comments: number; shares: number; text: string }>,
  savedProfile: Record<string, unknown> | null
): string {
  const postsText = topPosts
    .map(
      (p, i) =>
        `\n--- POST ${i + 1} (by ${p.author_name}, ${p.likes} likes, ${p.comments} comments, ${p.shares} shares) ---\n${p.text}\n`
    )
    .join("");

  const profileSection = savedProfile?.name
    ? `\n## WHAT I ALREADY KNOW ABOUT THE USER (from a previous session)
- Name: ${savedProfile.name}
- Role: ${savedProfile.role}
- Industry: ${savedProfile.industry}
- Expertise: ${Array.isArray(savedProfile.expertise_areas) ? (savedProfile.expertise_areas as string[]).join(", ") : savedProfile.expertise_areas}
- Recent achievements: ${Array.isArray(savedProfile.recent_achievements) ? (savedProfile.recent_achievements as string[]).join(", ") : savedProfile.recent_achievements}
- Opinions/hot takes: ${Array.isArray(savedProfile.opinions) ? (savedProfile.opinions as string[]).join(", ") : savedProfile.opinions}
- Target audience: ${savedProfile.target_audience}
- Preferred tone: ${savedProfile.tone_preference}

You already have this context. Don't re-ask these basics. Instead, dig deeper — ask about specific recent stories, challenges, wins, or contrarian views that would make great post material.`
    : `\n## USER PROFILE
No saved profile yet. Start by learning about the user — their role, industry, expertise, and what makes them unique. Keep it conversational, not like a form.`;

  return `You are an elite LinkedIn ghostwriter. You help professionals create high-performing LinkedIn posts by combining proven viral patterns with their authentic voice and experiences.

## YOUR APPROACH
1. FIRST: Have a brief, natural conversation to understand the user's story, expertise, and what they want to share. Ask 3-5 focused questions (not all at once — have a conversation). If you already have their profile, skip basics and ask about fresh material.
2. THEN: Write 3-5 LinkedIn posts using the winning patterns below, filled with the user's real experiences and voice.
3. ITERATE: Let the user give feedback, refine posts, adjust tone, try different angles.

## TOP PERFORMING POSTS (scraped from LinkedIn top voices)
These posts got the highest engagement. Study their structure, hooks, and patterns:
${postsText}

## PATTERN ANALYSIS (extracted by AI from the top posts above)
${JSON.stringify(patterns, null, 2)}

## KEY RULES FOR WRITING POSTS
- Each post MUST use a different hook type and structure from the patterns
- The first 1-2 lines are critical — they show before "...see more"
- Use short paragraphs, line breaks, punchy sentences
- 150-300 words is the sweet spot
- End with a call-to-action that drives comments
- Write in the user's authentic voice — never generic corporate speak
- Draw from their REAL experiences, not hypotheticals
- DON'T copy the example posts — use their structural DNA with fresh content
${profileSection}

## FORMAT FOR POSTS
When you write posts, format each one clearly with a header like "**Post 1:**" followed by the post content. After each post, add a brief note on which pattern you used and why.`;
}

const FIRST_MESSAGE_WITH_PROFILE = `I've analyzed the top-performing LinkedIn posts and extracted the patterns that drive engagement — hooks, structures, storytelling techniques, and CTAs that work.

I already have your profile info, so let's skip the basics. To write posts that really land, I need fresh material:

**What's something that happened recently in your work that stuck with you?** Could be a win, a lesson learned, a frustrating moment, or a realization. The best LinkedIn posts come from real moments.`;

const FIRST_MESSAGE_NO_PROFILE = `I've analyzed the top-performing LinkedIn posts and extracted the patterns that drive the most engagement — specific hooks, structures, and techniques that consistently get thousands of likes and comments.

Now I need to understand YOUR story so I can write posts that sound authentically like you.

**Let's start simple: what do you do, and what's one thing you're passionate about in your work?**`;

export async function POST(req: NextRequest) {
  try {
    const { anthropicKey: clientKey, messages, patterns, topPosts, savedProfile } = await req.json();
    const anthropicKey = clientKey || process.env.ANTHROPIC_API_KEY;

    if (!anthropicKey) {
      return new Response(JSON.stringify({ error: "Missing API key" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // If this is the initial request (no user messages yet), return the first message
    if (!messages || messages.length === 0) {
      const firstMessage = savedProfile?.name
        ? FIRST_MESSAGE_WITH_PROFILE
        : FIRST_MESSAGE_NO_PROFILE;
      return new Response(JSON.stringify({ message: firstMessage }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const client = new Anthropic({ apiKey: anthropicKey });
    const systemPrompt = buildSystemPrompt(patterns || {}, topPosts || [], savedProfile);

    // Stream the response
    const stream = await client.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      messages: messages.map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      })),
    });

    // Return as a readable stream
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`));
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: err instanceof Error ? err.message : "Stream error" })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
