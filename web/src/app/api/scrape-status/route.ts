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

    // Parse reaction types - handle both array and object formats
    const reactionTypes: Record<string, number> = {};
    let totalLikes = 0;

    // Try multiple possible locations for reaction data
    const reactionCounts =
      item.reactionTypeCounts ||
      item.reactions ||
      item.reactionCounts ||
      (item.socialContent as Record<string, unknown>)?.reactionTypeCounts ||
      (item.socialCounts as Record<string, unknown>)?.reactionTypeCounts;

    if (Array.isArray(reactionCounts)) {
      for (const r of reactionCounts as Array<Record<string, unknown>>) {
        const type = String(r.type || r.reactionType || "LIKE");
        const count = Number(r.count || r.value || 0);
        reactionTypes[type] = count;
        totalLikes += count;
      }
    } else if (typeof reactionCounts === "object" && reactionCounts !== null) {
      for (const [type, count] of Object.entries(reactionCounts as Record<string, number>)) {
        reactionTypes[type] = Number(count);
        totalLikes += Number(count);
      }
    }

    // Fall back to simple likes/totalReactionCount fields
    if (totalLikes === 0) {
      totalLikes = Number(
        item.totalReactionCount ||
        item.totalReactions ||
        item.likesCount ||
        item.numLikes ||
        item.likes ||
        item.numReactions ||
        (item.socialContent as Record<string, unknown>)?.totalReactionCount ||
        0
      );
    }

    // Get post text - try multiple possible field names
    const text = String(
      item.content || item.commentary || item.text || item.postText || item.body || item.message || ""
    );

    // Parse comments - try nested socialContent too
    const socialContent = (item.socialContent || {}) as Record<string, unknown>;
    const comments = Number(
      item.numComments || item.commentsCount || item.comments ||
      item.totalComments || socialContent.totalComments ||
      socialContent.numComments || 0
    );
    const shares = Number(
      item.numShares || item.sharesCount || item.shares ||
      item.totalShares || socialContent.totalShares ||
      socialContent.numShares || 0
    );

    // Determine media type and collect image URLs
    let mediaType = "text";
    const imageUrls: string[] = [];
    if (item.images && Array.isArray(item.images)) {
      mediaType = "image";
      for (const img of item.images as Array<Record<string, unknown>>) {
        if (img.url) imageUrls.push(String(img.url));
      }
    } else if (item.image) {
      mediaType = "image";
      const img = item.image as Record<string, unknown>;
      if (typeof img === "string") imageUrls.push(img);
      else if (img.url) imageUrls.push(String(img.url));
    }
    if (item.documents) mediaType = "document";
    else if (item.video) mediaType = "video";
    else if (item.mediaType) mediaType = String(item.mediaType);

    return {
      author_name: authorName,
      author_url: authorUrl,
      text,
      posted_at: parseDate(item.postedAt || item.createdAt || item.publishedAt || item.date || ""),
      likes: totalLikes,
      comments,
      shares,
      impressions: Number(
        item.numImpressions || item.impressions || item.views ||
        socialContent.numImpressions || 0
      ),
      media_type: mediaType,
      post_url: String(item.linkedinUrl || item.url || item.postUrl || item.link || ""),
      reaction_types: reactionTypes,
      engagement_score: totalLikes + 2 * comments + 3 * shares,
      image_urls: imageUrls,
      // Include raw keys for debugging
      _raw_keys: Object.keys(item),
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
