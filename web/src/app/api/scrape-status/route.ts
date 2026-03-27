import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const runId = req.nextUrl.searchParams.get("runId");
    const apifyToken = req.nextUrl.searchParams.get("apifyToken") || process.env.APIFY_API_TOKEN;

    if (!runId || !apifyToken) {
      return NextResponse.json({ error: "Missing runId or apifyToken" }, { status: 400 });
    }

    // Check run status
    const statusRes = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${apifyToken}`
    );

    if (!statusRes.ok) {
      return NextResponse.json({ error: "Failed to check run status" }, { status: statusRes.status });
    }

    const runData = await statusRes.json();
    const status = runData.data.status;

    if (status !== "SUCCEEDED") {
      return NextResponse.json({ status });
    }

    // Fetch results from dataset
    const datasetId = runData.data.defaultDatasetId;
    const itemsRes = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyToken}&format=json`
    );

    if (!itemsRes.ok) {
      return NextResponse.json({ error: "Failed to fetch results" }, { status: itemsRes.status });
    }

    const items = await itemsRes.json();

    // Parse into our post format
    const posts = items
      .map(parseApifyPost)
      .filter((p: ReturnType<typeof parseApifyPost>) => p !== null && p.text.trim());

    return NextResponse.json({ status: "SUCCEEDED", posts });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}

function parseApifyPost(item: Record<string, unknown>) {
  try {
    const author = (item.author || {}) as Record<string, unknown>;

    // Parse reaction types
    const reactionTypes: Record<string, number> = {};
    let totalLikes = 0;
    const reactions = (item.reactionTypeCounts || []) as Array<Record<string, unknown>>;
    for (const r of reactions) {
      const type = String(r.type || "LIKE");
      const count = Number(r.count || 0);
      reactionTypes[type] = count;
      totalLikes += count;
    }

    // Determine media type
    let mediaType = "text";
    if (item.images) mediaType = "image";
    else if (item.documents) mediaType = "document";
    else if (item.video) mediaType = "video";

    const likes = totalLikes;
    const comments = Number(item.numComments || 0);
    const shares = Number(item.numShares || 0);

    return {
      author_name: String(author.name || "Unknown"),
      author_url: String(author.linkedinUrl || ""),
      text: String(item.commentary || ""),
      posted_at: String(item.createdAt || ""),
      likes,
      comments,
      shares,
      impressions: Number(item.numImpressions || 0),
      media_type: mediaType,
      post_url: String(item.url || ""),
      reaction_types: reactionTypes,
      engagement_score: likes + 2 * comments + 3 * shares,
    };
  } catch {
    return null;
  }
}
