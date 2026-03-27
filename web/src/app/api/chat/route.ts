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

  return `I need your help writing LinkedIn posts for my personal brand. I run an agency that generates leads for businesses. We run Facebook ads. We run outbound cold email campaigns. And I'm sharing our learnings and to educate my audience to help them use AI and these tools to get leads and acquire clients for their business.

I am going to share with you top performing posts from top voices on LinkedIn, as well as some analysis on what is working and not working in their posts. I need your help analyzing the posts to find the patterns, structures, and hooks that are working. So we can use these to our advantage when writing posts for my LinkedIn personal brand.

I want you to ask me clarifying questions or questions around what I'm currently doing in my work, any insights, or anything you think might be important to help you decide what to write a post on.

## TOP PERFORMING POSTS FROM LINKEDIN TOP VOICES
These are the highest-engagement posts we scraped and analyzed:
${postsText}

## PATTERN ANALYSIS (extracted by AI from the posts above)
Here's what our analysis found about why these posts work:
${JSON.stringify(patterns, null, 2)}

## YOUR INSTRUCTIONS
1. You have all the posts and analysis above. Use them as your playbook for what works.
2. Start by asking me focused questions about my recent work, wins, challenges, opinions, and anything that could become great post material. Ask a few at a time, not all at once — have a natural conversation.
3. Once you have enough material, write LinkedIn posts using the winning patterns from the analysis, filled with MY real experiences and voice.
4. Let me iterate — I might want to adjust tone, swap stories, try different hooks, etc.

## KEY RULES FOR THE POSTS YOU WRITE
- Each post MUST use a different hook type and structure from the patterns
- The first 1-2 lines are critical — they show before "...see more"
- Use short paragraphs, line breaks, punchy sentences
- 150-300 words is the sweet spot
- End with a call-to-action that drives comments
- Write in my authentic voice — never generic corporate speak
- Draw from my REAL experiences, not hypotheticals
- DON'T copy the example posts — use their structural DNA with fresh content

## FORMAT FOR POSTS
When you write posts, format each one clearly with a header like "**Post 1:**" followed by the post content. After each post, briefly note which pattern you used and why.`;
}

const FIRST_MESSAGE = `Hey! I've gone through the top-performing LinkedIn posts you scraped and the pattern analysis. There's some really solid material to work with — I can see what hooks, structures, and engagement drivers are working well.

Before I start writing posts for you, I want to make sure they're grounded in YOUR real experiences and insights. A few questions to get us started:

**1.** What's a recent win or result you've gotten for a client with your Facebook ads or cold email campaigns? (Specific numbers are gold for LinkedIn posts.)

**2.** What's a common mistake you see businesses make when trying to generate leads — something that frustrates you?

**3.** Is there a contrarian opinion you hold about lead gen, AI, or marketing that most people would disagree with?

Take your time — even a quick answer to one of these gives me plenty to work with.`;

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
