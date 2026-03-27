"use client";

import { useState } from "react";
import { LinkedInPost, PostPatterns, UserContext, GeneratedPost } from "@/lib/types";
import { storage } from "@/lib/storage";

interface Props {
  posts: LinkedInPost[];
  patterns: PostPatterns | null;
  userContext: UserContext | null;
  generatedPosts: GeneratedPost[];
  setGeneratedPosts: (p: GeneratedPost[]) => void;
}

export function GeneratePosts({ posts, patterns, userContext, generatedPosts, setGeneratedPosts }: Props) {
  const [generating, setGenerating] = useState(false);
  const [numPosts, setNumPosts] = useState(3);
  const [topN, setTopN] = useState(5);
  const [error, setError] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const ready = posts.length > 0 && patterns !== null && userContext !== null;

  async function handleGenerate() {
    setError("");
    const apiKey = storage.getAnthropicKey();
    if (!apiKey) {
      setError("Anthropic API key not set. Go to Settings.");
      return;
    }

    const topPosts = [...posts]
      .sort((a, b) => b.engagement_score - a.engagement_score)
      .slice(0, topN);

    setGenerating(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anthropicKey: apiKey,
          patterns,
          topPosts,
          userContext,
          numPosts,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Generation failed");
      }

      const data = await res.json();
      setGeneratedPosts(data.posts);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  function copyToClipboard(text: string, index: number) {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">Generate LinkedIn Posts</h2>
      <p className="text-gray-500 mb-8">Create personalized posts based on proven patterns and your profile.</p>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
      )}

      {/* Preconditions */}
      {!ready && (
        <div className="space-y-3 mb-6">
          {posts.length === 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
              No scraped posts. Complete <strong>Scrape & Analyze</strong> first.
            </div>
          )}
          {!patterns && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
              No pattern analysis. Run <strong>AI Pattern Analysis</strong> in Scrape & Analyze.
            </div>
          )}
          {!userContext && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
              No user profile. Fill in <strong>About You</strong> first.
            </div>
          )}
        </div>
      )}

      {ready && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <div className="flex items-center gap-6 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Posts to generate</label>
              <select
                value={numPosts}
                onChange={(e) => setNumPosts(Number(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {[1, 2, 3, 5, 7, 10].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Inspiration posts</label>
              <select
                value={topN}
                onChange={(e) => setTopN(Number(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {[3, 5, 10].map((n) => (
                  <option key={n} value={n}>Top {n}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-6 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {generating ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2 align-middle" />
                Claude is writing your posts...
              </>
            ) : generatedPosts.length ? (
              "Regenerate Posts"
            ) : (
              "Generate Posts"
            )}
          </button>
        </div>
      )}

      {/* Generated Posts */}
      {generatedPosts.length > 0 && (
        <div className="space-y-6">
          {generatedPosts.map((post, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-6 py-3 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-semibold text-gray-700">Post {i + 1}</span>
                  <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">{post.hook_type}</span>
                  <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">{post.pattern_used}</span>
                  <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">{post.estimated_engagement} engagement</span>
                </div>
                <button
                  onClick={() => copyToClipboard(post.content, i)}
                  className="px-3 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {copiedIndex === i ? "Copied!" : "Copy"}
                </button>
              </div>

              <div className="p-6">
                <pre className="text-sm text-gray-800 whitespace-pre-wrap font-sans leading-relaxed">
                  {post.content}
                </pre>
              </div>

              {(post.inspired_by || post.tips.length > 0) && (
                <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
                  {post.inspired_by && (
                    <p className="text-xs text-gray-500 mb-1">Inspired by: {post.inspired_by}</p>
                  )}
                  {post.tips.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-1">
                      {post.tips.map((tip, j) => (
                        <span key={j} className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                          {tip}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
