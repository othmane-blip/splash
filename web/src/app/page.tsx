"use client";

import { useState, useEffect } from "react";
import { storage } from "@/lib/storage";
import { LinkedInProfile, LinkedInPost, PostPatterns, UserContext, GeneratedPost } from "@/lib/types";
import { Settings } from "@/components/Settings";
import { ConfigureProfiles } from "@/components/ConfigureProfiles";
import { ScrapeAnalyze } from "@/components/ScrapeAnalyze";
import { Interview } from "@/components/Interview";
import { GeneratePosts } from "@/components/GeneratePosts";

const TABS = [
  { id: "settings", label: "Settings", icon: "gear" },
  { id: "profiles", label: "1. Profiles", icon: "users" },
  { id: "scrape", label: "2. Scrape & Analyze", icon: "chart" },
  { id: "interview", label: "3. About You", icon: "user" },
  { id: "generate", label: "4. Generate", icon: "sparkle" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function Home() {
  const [tab, setTab] = useState<TabId>("profiles");
  const [profiles, setProfiles] = useState<LinkedInProfile[]>([]);
  const [posts, setPosts] = useState<LinkedInPost[]>([]);
  const [patterns, setPatterns] = useState<PostPatterns | null>(null);
  const [userContext, setUserContext] = useState<UserContext | null>(null);
  const [generatedPosts, setGeneratedPosts] = useState<GeneratedPost[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    setProfiles(storage.getProfiles());
    setPosts(storage.getPosts());
    setPatterns(storage.getPatterns());
    setUserContext(storage.getUserContext());
    setGeneratedPosts(storage.getGeneratedPosts());
    setLoaded(true);
  }, []);

  // Persist on change
  useEffect(() => { if (loaded) storage.setProfiles(profiles); }, [profiles, loaded]);
  useEffect(() => { if (loaded) storage.setPosts(posts); }, [posts, loaded]);
  useEffect(() => { if (loaded && patterns) storage.setPatterns(patterns); }, [patterns, loaded]);
  useEffect(() => { if (loaded && userContext) storage.setUserContext(userContext); }, [userContext, loaded]);
  useEffect(() => { if (loaded) storage.setGeneratedPosts(generatedPosts); }, [generatedPosts, loaded]);

  if (!loaded) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-blue-700">Splash</h1>
          <p className="text-xs text-gray-500 mt-1">LinkedIn AI Content Pipeline</p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t.id
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {/* Status */}
        <div className="p-4 border-t border-gray-200 text-xs space-y-1.5">
          <div className="font-medium text-gray-500 uppercase tracking-wider mb-2">Pipeline Status</div>
          <StatusDot ok={profiles.length > 0} label={`${profiles.length} profiles`} />
          <StatusDot ok={posts.length > 0} label={`${posts.length} posts scraped`} />
          <StatusDot ok={patterns !== null} label={patterns ? "Patterns analyzed" : "Not analyzed"} />
          <StatusDot ok={userContext !== null} label={userContext ? "Profile saved" : "Not set"} />
          <StatusDot ok={generatedPosts.length > 0} label={`${generatedPosts.length} posts generated`} />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-8">
          {tab === "settings" && <Settings />}
          {tab === "profiles" && <ConfigureProfiles profiles={profiles} setProfiles={setProfiles} />}
          {tab === "scrape" && (
            <ScrapeAnalyze
              profiles={profiles}
              posts={posts}
              setPosts={setPosts}
              patterns={patterns}
              setPatterns={setPatterns}
            />
          )}
          {tab === "interview" && <Interview userContext={userContext} setUserContext={setUserContext} />}
          {tab === "generate" && (
            <GeneratePosts
              posts={posts}
              patterns={patterns}
              userContext={userContext}
              generatedPosts={generatedPosts}
              setGeneratedPosts={setGeneratedPosts}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function StatusDot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full ${ok ? "bg-green-500" : "bg-gray-300"}`} />
      <span className={ok ? "text-gray-700" : "text-gray-400"}>{label}</span>
    </div>
  );
}
