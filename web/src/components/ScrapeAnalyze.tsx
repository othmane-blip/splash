"use client";

import { useState } from "react";
import { LinkedInProfile, LinkedInPost } from "@/lib/types";
import { storage } from "@/lib/storage";

interface Props {
  profiles: LinkedInProfile[];
  posts: LinkedInPost[];
  setPosts: (p: LinkedInPost[]) => void;
  onConfirm: (posts: LinkedInPost[]) => void;
}

export function ScrapeAnalyze({ profiles, posts, setPosts, onConfirm }: Props) {
  const [scraping, setScraping] = useState(false);
  const [scrapeStatus, setScrapeStatus] = useState("");
  const [topN, setTopN] = useState(5);
  const [error, setError] = useState("");

  async function handleScrape() {
    setError("");
    const token = storage.getApifyToken();
    if (profiles.length === 0) {
      setError("No profiles configured. Go to Profiles first.");
      return;
    }

    setScraping(true);
    setScrapeStatus("Starting Apify scraper...");

    try {
      const startRes = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apifyToken: token || "",
          profileUrls: profiles.map((p) => p.linkedin_url),
          maxPosts: 20,
        }),
      });

      if (!startRes.ok) {
        const err = await startRes.json();
        throw new Error(err.error || "Failed to start scrape");
      }

      const { runId } = await startRes.json();
      setScrapeStatus("Scraping posts... this takes 1-2 minutes.");

      let attempts = 0;
      while (attempts < 60) {
        await new Promise((r) => setTimeout(r, 5000));
        attempts++;

        const statusRes = await fetch(`/api/scrape-status?runId=${runId}&apifyToken=${encodeURIComponent(token || "")}`);
        const statusData = await statusRes.json();

        if (statusData.status === "SUCCEEDED") {
          const parsed = statusData.posts?.length || 0;
          const raw = statusData.totalRawItems || "?";
          setScrapeStatus(`Done! Found ${parsed} posts (${raw} raw items from Apify).`);
          setPosts(statusData.posts || []);
          break;
        } else if (statusData.status === "FAILED" || statusData.status === "ABORTED") {
          throw new Error(`Scrape ${statusData.status.toLowerCase()}`);
        } else {
          setScrapeStatus(`Scraping... (${statusData.status})`);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scrape failed");
    } finally {
      setScraping(false);
    }
  }

  function getTopPosts(): LinkedInPost[] {
    return [...posts]
      .sort((a, b) => b.engagement_score - a.engagement_score)
      .slice(0, topN);
  }

  const avgLikes = posts.length ? Math.round(posts.reduce((s, p) => s + p.likes, 0) / posts.length) : 0;
  const avgComments = posts.length ? Math.round(posts.reduce((s, p) => s + p.comments, 0) / posts.length) : 0;
  const avgShares = posts.length ? Math.round(posts.reduce((s, p) => s + p.shares, 0) / posts.length) : 0;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">Scrape & Select</h2>
      <p className="text-gray-500 mb-8">Fetch posts from your configured profiles. The top posts will be sent to Claude in the chat.</p>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
      )}

      {/* Scrape */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h3 className="text-lg font-semibold mb-3">Step 1: Scrape Posts</h3>
        <p className="text-sm text-gray-500 mb-4">
          {profiles.length} profile(s): {profiles.map((p) => p.name || p.linkedin_url).join(", ")}
        </p>

        <button
          onClick={handleScrape}
          disabled={scraping}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {scraping ? "Scraping..." : posts.length ? "Re-scrape Posts" : "Scrape LinkedIn Posts"}
        </button>

        {scrapeStatus && (
          <p className="mt-3 text-sm text-gray-600">
            {scraping && <span className="inline-block w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2 align-middle" />}
            {scrapeStatus}
          </p>
        )}
      </div>

      {/* Stats + Top Posts */}
      {posts.length > 0 && (
        <>
          <div className="grid grid-cols-4 gap-4 mb-6">
            <Stat label="Total Posts" value={posts.length} />
            <Stat label="Avg Likes" value={avgLikes} />
            <Stat label="Avg Comments" value={avgComments} />
            <Stat label="Avg Shares" value={avgShares} />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h3 className="text-lg font-semibold mb-3">Step 2: Select Top Posts</h3>
            <p className="text-sm text-gray-500 mb-4">These will be sent to Claude for analysis in the chat.</p>

            <div className="flex items-center gap-4 mb-4">
              <label className="text-sm text-gray-600">Send top</label>
              <input
                type="range"
                min={1}
                max={Math.min(20, posts.length)}
                value={topN}
                onChange={(e) => setTopN(Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-sm font-medium w-8">{topN}</span>
              <span className="text-sm text-gray-500">posts by engagement</span>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {getTopPosts().map((post, i) => (
                <PostCard key={i} rank={i + 1} post={post} />
              ))}
            </div>
          </div>

          <button
            onClick={() => onConfirm(getTopPosts())}
            className="w-full px-6 py-3 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors"
          >
            Confirm {topN} posts & start chatting with Claude →
          </button>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}

function PostCard({ rank, post }: { rank: number; post: LinkedInPost }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-gray-100 rounded-lg p-3 hover:bg-gray-50 transition-colors">
      <div className="flex items-start justify-between cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <span className="text-xs font-bold text-gray-400 mt-0.5">#{rank}</span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-700">{post.author_name}</p>
            <p className="text-xs text-gray-500 truncate">{post.text.slice(0, 100)}...</p>
          </div>
        </div>
        <div className="flex gap-3 text-xs text-gray-500 whitespace-nowrap ml-4">
          <span>{post.likes} likes</span>
          <span>{post.comments} comments</span>
          <span>{post.shares} shares</span>
        </div>
      </div>
      {expanded && (
        <div className="mt-3 pl-7">
          <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{post.text}</pre>
        </div>
      )}
    </div>
  );
}
