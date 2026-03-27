import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

function buildSystemPrompt(
  topPosts: Array<{ author_name: string; likes: number; comments: number; shares: number; text: string }>
): string {
  const postsText = topPosts
    .map(
      (p, i) =>
        `\n--- POST ${i + 1} (by ${p.author_name}, ${p.likes} likes, ${p.comments} comments, ${p.shares} shares) ---\n${p.text}\n`
    )
    .join("");

  return `I need your help writing LinkedIn posts for my personal brand. I run an agency that generates leads for businesses. We run Facebook ads. We run outbound cold email campaigns. And I'm sharing our learnings and to educate my audience to help them use AI and these tools to get leads and acquire clients for their business.

I am going to share with you top performing posts from top voices on LinkedIn, as well as some comments on what is working and not working in their posts. I need your help analyzing the posts to find the patterns, structures, and hooks that are working. So we can use these to our advantage when writing posts for my LinkedIn personal brand.

I want you to ask me clarifying questions or questions around what I'm currently doing in my work, any insights, or anything you think might be important to help you decide what to write a post on.

## TOP PERFORMING POSTS FROM LINKEDIN TOP VOICES
${postsText}

## HOW TO WORK WITH ME
- Start by analyzing the posts above: what hooks, structures, formatting, and engagement patterns do you see? Give me a quick breakdown of what's working and how we could use it for our lead gen / AI / cold email content
- Then ask me what's top of mind so we can start writing
- When I give you a topic, result, or process — immediately write 2-3 posts using DIFFERENT hooks and structures from what you identified
- Don't ask generic questions. If you need something specific to write a better post, ask ONE targeted question
- When I give feedback, adjust and rewrite

## RULES FOR THE POSTS YOU WRITE
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

export async function POST(req: NextRequest) {
  try {
    const { anthropicKey: clientKey, messages, topPosts } = await req.json();
    const anthropicKey = clientKey || process.env.ANTHROPIC_API_KEY;

    if (!anthropicKey) {
      return new Response(JSON.stringify({ error: "Missing API key" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const client = new Anthropic({ apiKey: anthropicKey });
    const systemPrompt = buildSystemPrompt(topPosts || []);

    // For the initial request (no user messages), Claude's first message IS the analysis
    const chatMessages = (!messages || messages.length === 0)
      ? [{ role: "user" as const, content: "I've loaded the top performing posts above. Please analyze them — what patterns, hooks, structures, and engagement drivers do you see? Then tell me how we could leverage these for my lead gen / Facebook ads / cold email / AI content. Keep it concise and actionable." }]
      : messages.map((m: { role: string; content: string | Array<Record<string, unknown>> }) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

    // Stream the response with retry on overload
    let stream;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        stream = await client.messages.stream({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4096,
          system: systemPrompt,
          messages: chatMessages,
        });
        break;
      } catch (err: unknown) {
        const isOverloaded = err instanceof Error && (err.message.includes("overloaded") || err.message.includes("529"));
        if (isOverloaded && attempt < 2) {
          await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
          continue;
        }
        throw err;
      }
    }
    if (!stream) throw new Error("Failed after retries");

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
