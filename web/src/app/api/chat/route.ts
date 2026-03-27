import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

function buildSystemPrompt(
  patterns: Record<string, unknown>,
  topPosts: Array<{ author_name: string; likes: number; comments: number; shares: number; text: string }>
): string {
  const postsText = topPosts
    .map(
      (p, i) =>
        `\n--- POST ${i + 1} (by ${p.author_name}, ${p.likes} likes, ${p.comments} comments, ${p.shares} shares) ---\n${p.text}\n`
    )
    .join("");

  return `You are my LinkedIn ghostwriter. I run an agency that generates leads for businesses using Facebook ads and outbound cold email campaigns. I share learnings to educate my audience on using AI and these tools to get leads and acquire clients.

Here are top performing posts from LinkedIn top voices, and an analysis of what's working. Use these patterns, structures, and hooks when writing posts for me.

## TOP PERFORMING POSTS
${postsText}

## PATTERN ANALYSIS
${JSON.stringify(patterns, null, 2)}

## HOW TO WORK WITH ME
- I'll tell you what's top of mind — a result, a learning, a process, an opinion, something I've been doing lately
- Your job is to immediately turn that into LinkedIn posts using the winning patterns above
- Write 2-3 posts per topic I give you, each using a DIFFERENT hook and structure from the patterns
- Don't interview me or ask generic questions. If you need something specific to write a better post, ask ONE targeted question
- When I give you feedback, adjust and rewrite

## RULES FOR THE POSTS
- First 1-2 lines are everything — they show before "...see more". Make them stop the scroll
- Short paragraphs, line breaks, punchy sentences
- 150-300 words sweet spot
- End with a call-to-action that drives comments
- Use my real numbers, processes, and insights — not vague generic advice
- DON'T copy the example posts — use their structural DNA with my content
- Make it sound like me talking, not a corporate marketing team
- Focus on actionable, specific content. Teach something. Share a real process. Give a real number.

## FORMAT
Label each post clearly: **Post 1:**, **Post 2:**, etc.
After each post, one line on which pattern/hook you used.`;
}

const FIRST_MESSAGE = `I've studied the top posts and extracted the patterns that drive engagement. I'm ready to write.

**What's top of mind for you right now?** Drop me a topic, a recent result, a process you've been using, or something you want to teach your audience — and I'll turn it into LinkedIn posts using the patterns that work.`;

export async function POST(req: NextRequest) {
  try {
    const { anthropicKey: clientKey, messages, patterns, topPosts } = await req.json();
    const anthropicKey = clientKey || process.env.ANTHROPIC_API_KEY;

    if (!anthropicKey) {
      return new Response(JSON.stringify({ error: "Missing API key" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // If this is the initial request (no user messages yet), return the first message
    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ message: FIRST_MESSAGE }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const client = new Anthropic({ apiKey: anthropicKey });
    const systemPrompt = buildSystemPrompt(patterns || {}, topPosts || []);

    // Stream the response
    const stream = await client.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      messages: messages.map((m: { role: string; content: string | Array<Record<string, unknown>> }) => ({
        role: m.role,
        content: m.content, // Pass through as-is (string or content blocks with images)
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
