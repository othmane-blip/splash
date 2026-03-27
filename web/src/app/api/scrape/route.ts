import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { apifyToken, profileUrls, maxPosts } = await req.json();

    if (!apifyToken || !profileUrls?.length) {
      return NextResponse.json({ error: "Missing apifyToken or profileUrls" }, { status: 400 });
    }

    // Start the Apify actor run (non-blocking)
    const res = await fetch(
      `https://api.apify.com/v2/acts/harvestapi~linkedin-profile-posts/runs?token=${apifyToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUrls: profileUrls,
          maxPosts: maxPosts || 20,
          scrapeReactions: false,
          scrapeComments: false,
        }),
      }
    );

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json({ error: `Apify error: ${errorText}` }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json({ runId: data.data.id });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
