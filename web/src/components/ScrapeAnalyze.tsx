"use client";

import { useState } from "react";
import { LinkedInProfile, LinkedInPost, PostPatterns } from "@/lib/types";
import { storage } from "@/lib/storage";

interface Props {
  profiles: LinkedInProfile[];
  posts: LinkedInPost[];
  setPosts: (p: LinkedInPost[]) => void;
  patterns: PostPatterns | null;
  setPatterns: (p: PostPatterns) => void;
}

export function ScrapeAnalyze({ profiles, posts, setPosts, patterns, setPatterns }: Props) {
  const [scraping, setScraping] = useState(false);
  const [scrapeStatus, setScrapeStatus] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [topN, setTopN] = useState(5);
  const [error, setError] = useState("");

  async function handleScrape() {
    setError("");
    const token = storage.getApifyToken(); // optional — server has env var fallback
    if (profiles.length === 0) {
      setError("No profiles configured. Go to Profiles first.");
      return;
    }

    setScraping(true);
    setScrapeStatus("Starting Apify scraper...");

    try {
      // Start the scrape
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

      // Poll for completion
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

  async function handleAnalyze() {
    setError("");
    const apiKey = storage.getAnthropicKey(); // optional — server has env var fallback

    const topPosts = getTopPosts();
    if (topPosts.length === 0) {
      setError("No posts to analyze. Scrape first.");
      return;
    }

    setAnalyzing(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anthropicKey: apiKey || "", posts: topPosts }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Analysis failed");
      }

      const data = await res.json();
      setPatterns(data.patterns);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
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
      <h2 className="text-2xl font-bold mb-2">Scrape & Analyze</h2>
      <p className="text-gray-500 mb-8">Fetch posts from your configured profiles and analyze winning patterns.</p>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
      )}

      {/* Step 1: Scrape */}
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

      {/* Stats */}
      {posts.length > 0 && (
        <>
          {/* Debug: raw keys from first post */}
          {posts[0]?._raw_keys && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-xs">
              <p className="font-semibold mb-1">Debug: Apify raw field names</p>
              <code className="break-all">{posts[0]._raw_keys.join(", ")}</code>
            </div>
          )}

          <div className="grid grid-cols-4 gap-4 mb-6">
            <Stat label="Total Posts" value={posts.length} />
            <Stat label="Avg Likes" value={avgLikes} />
            <Stat label="Avg Comments" value={avgComments} />
            <Stat label="Avg Shares" value={avgShares} />
          </div>

          {/* Step 2: Top Posts */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h3 className="text-lg font-semibold mb-3">Step 2: Top Posts</h3>
            <div className="flex items-center gap-4 mb-4">
              <label className="text-sm text-gray-600">Analyze top</label>
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

          {/* Step 3: Analyze */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h3 className="text-lg font-semibold mb-3">Step 3: AI Pattern Analysis</h3>

            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="px-6 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {analyzing ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2 align-middle" />
                  Analyzing with Claude...
                </>
              ) : patterns ? (
                "Re-analyze Patterns"
              ) : (
                "Analyze Patterns with Claude"
              )}
            </button>
          </div>

          {/* Patterns Display */}
          {patterns && <PatternsDisplay patterns={patterns} />}
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

function PatternsDisplay({ patterns }: { patterns: PostPatterns }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Extracted Patterns</h3>

      {patterns.common_hooks && (
        <Section title="Hook Types">
          {patterns.common_hooks.map((h, i) => (
            <li key={i} className="text-sm">
              {typeof h === "string" ? h : <><strong>{h.type}</strong>: {h.example || h.description}</>}
            </li>
          ))}
        </Section>
      )}

      {patterns.winning_structures && (
        <Section title="Winning Structures">
          {patterns.winning_structures.map((s, i) => (
            <li key={i} className="text-sm">
              {typeof s === "string" ? s : <><strong>{s.name || s.type}</strong>: {s.description}</>}
            </li>
          ))}
        </Section>
      )}

      {patterns.engagement_drivers && (
        <Section title="Engagement Drivers">
          {patterns.engagement_drivers.map((d, i) => (
            <li key={i} className="text-sm">
              {typeof d === "string" ? d : d.description || d.driver || JSON.stringify(d)}
            </li>
          ))}
        </Section>
      )}

      <div className="grid grid-cols-2 gap-4">
        {patterns.dos && (
          <div className="bg-green-50 rounded-xl p-4">
            <h4 className="font-semibold text-green-800 mb-2">Do&apos;s</h4>
            <ul className="space-y-1">
              {patterns.dos.map((d, i) => (
                <li key={i} className="text-sm text-green-700">+ {d}</li>
              ))}
            </ul>
          </div>
        )}
        {patterns.donts && (
          <div className="bg-red-50 rounded-xl p-4">
            <h4 className="font-semibold text-red-800 mb-2">Don&apos;ts</h4>
            <ul className="space-y-1">
              {patterns.donts.map((d, i) => (
                <li key={i} className="text-sm text-red-700">- {d}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {patterns.ideal_post_blueprint && (
        <Section title="Ideal Post Blueprint">
          {Array.isArray(patterns.ideal_post_blueprint) ? (
            patterns.ideal_post_blueprint.map((step, i) => (
              <li key={i} className="text-sm">
                {typeof step === "string" ? step : <><strong>{step.step}</strong>: {step.description}</>}
              </li>
            ))
          ) : typeof patterns.ideal_post_blueprint === "object" ? (
            Object.entries(patterns.ideal_post_blueprint).map(([k, v], i) => (
              <li key={i} className="text-sm"><strong>{k}</strong>: {v}</li>
            ))
          ) : (
            <li className="text-sm">{String(patterns.ideal_post_blueprint)}</li>
          )}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h4 className="font-semibold text-gray-800 mb-2">{title}</h4>
      <ul className="space-y-1 list-disc list-inside">{children}</ul>
    </div>
  );
}
