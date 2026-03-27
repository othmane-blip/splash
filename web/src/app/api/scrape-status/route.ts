import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const runId = req.nextUrl.searchParams.get("runId");
    const apifyToken = req.nextUrl.searchParams.get("apifyToken") || process.env.APIFY_API_TOKEN;
    const debug = req.nextUrl.searchParams.get("debug") === "1";

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

    // If debug mode, return raw items so we can see the actual schema
    if (debug) {
      return NextResponse.json({
        status: "SUCCEEDED",
        rawItemCount: items.length,
        sampleItem: items[0] || null,
        sampleKeys: items[0] ? Object.keys(items[0]) : [],
      });
    }

    // Parse into our post format
    const posts = items
      .map(parseApifyPost)
      .filter((p: ReturnType<typeof parseApifyPost>) => p !== null && p.text.trim());

    return NextResponse.json({ status: "SUCCEEDED", posts, totalRawItems: items.length });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}

function parseApifyPost(item: Record<string, unknown>) {
  try {
    // Handle different possible author formats
    const author = (item.author || {}) as Record<string, unknown>;
    const authorName = String(
      author.name || author.firstName || item.authorName || item.author_name || "Unknown"
    );
    const authorUrl = String(
      author.linkedinUrl || author.url || author.profileUrl || item.authorUrl || ""
    );

    // Parse engagement from Apify harvestapi schema
    // engagement: { likes, comments, shares, reactions: [{type, count}] }
    const engagement = (item.engagement || {}) as Record<string, unknown>;

    // Parse reaction types from engagement.reactions array
    const reactionTypes: Record<string, number> = {};
    let totalLikes = 0;

    const reactions = engagement.reactions || item.reactions;
    if (Array.isArray(reactions)) {
      for (const r of reactions as Array<Record<string, unknown>>) {
        const type = String(r.type || "LIKE");
        const count = Number(r.count || 0);
        reactionTypes[type] = count;
        totalLikes += count;
      }
    }

    // Fall back to engagement.likes or top-level
    if (totalLikes === 0) {
      totalLikes = Number(engagement.likes || item.likes || item.likesCount || 0);
    }

    const comments = Number(engagement.comments || item.numComments || item.comments || 0);
    const shares = Number(engagement.shares || item.numShares || item.shares || 0);
    const impressions = Number(engagement.impressions || item.numImpressions || item.impressions || 0);

    // Get post text
    const text = String(
      item.content || item.commentary || item.text || item.postText || item.body || ""
    );

    // Determine media type and collect image URLs
    let mediaType = "text";
    const imageUrls: string[] = [];

    // postImages field from Apify
    if (item.postImages && Array.isArray(item.postImages)) {
      mediaType = "image";
      for (const img of item.postImages as Array<Record<string, unknown>>) {
        const url = img.url || img.src || img.original || img.display;
        if (url) imageUrls.push(String(url));
      }
    } else if (item.images && Array.isArray(item.images)) {
      mediaType = "image";
      for (const img of item.images as Array<Record<string, unknown>>) {
        const url = img.url || img.src;
        if (url) imageUrls.push(String(url));
      }
    }
    if (item.document) mediaType = "document";
    else if (item.video) mediaType = "video";

    return {
      author_name: authorName,
      author_url: authorUrl,
      text,
      posted_at: parseDate(item.postedAt || item.createdAt || item.publishedAt || item.date || ""),
      likes: totalLikes,
      comments,
      shares,
      impressions,
      media_type: mediaType,
      post_url: String(item.linkedinUrl || item.url || item.postUrl || item.link || ""),
      reaction_types: reactionTypes,
      engagement_score: totalLikes + 2 * comments + 3 * shares,
      image_urls: imageUrls,
    };
  } catch {
    return null;
  }
}

function parseDate(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;
    return String(obj.date || obj.timestamp || obj.postedAt || "");
  }
  return String(value);
}
