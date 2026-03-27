"use client";

import { useState, useEffect } from "react";
import { storage } from "@/lib/storage";
import { LinkedInProfile, LinkedInPost } from "@/lib/types";
import { Settings } from "@/components/Settings";
import { ConfigureProfiles } from "@/components/ConfigureProfiles";
import { ScrapeAnalyze } from "@/components/ScrapeAnalyze";
import { Chat } from "@/components/Chat";

const TABS = [
  { id: "settings", label: "Settings" },
  { id: "profiles", label: "1. Profiles" },
  { id: "scrape", label: "2. Scrape & Select" },
  { id: "chat", label: "3. Chat & Generate" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function Home() {
  const [tab, setTab] = useState<TabId>("profiles");
  const [profiles, setProfiles] = useState<LinkedInProfile[]>([]);
  const [posts, setPosts] = useState<LinkedInPost[]>([]);
  const [selectedPosts, setSelectedPosts] = useState<LinkedInPost[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setProfiles(storage.getProfiles());
    setPosts(storage.getPosts());
    setLoaded(true);
  }, []);

  useEffect(() => { if (loaded) storage.setProfiles(profiles); }, [profiles, loaded]);
  useEffect(() => { if (loaded) storage.setPosts(posts); }, [posts, loaded]);

  function handleConfirmPosts(confirmed: LinkedInPost[]) {
    setSelectedPosts(confirmed);
    setTab("chat");
  }

  if (!loaded) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900">Ghost<span className="text-blue-600">Post</span></h1>
          <p className="text-xs text-gray-500 mt-1">AI-powered LinkedIn ghostwriter</p>
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

        <div className="p-4 border-t border-gray-200 text-xs space-y-1.5">
          <div className="font-medium text-gray-500 uppercase tracking-wider mb-2">Pipeline Status</div>
          <StatusDot ok={profiles.length > 0} label={`${profiles.length} profiles`} />
          <StatusDot ok={posts.length > 0} label={`${posts.length} posts scraped`} />
          <StatusDot ok={selectedPosts.length > 0} label={`${selectedPosts.length} posts selected`} />
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-8 h-full">
          {tab === "settings" && <Settings />}
          {tab === "profiles" && <ConfigureProfiles profiles={profiles} setProfiles={setProfiles} />}
          {tab === "scrape" && (
            <ScrapeAnalyze
              profiles={profiles}
              posts={posts}
              setPosts={setPosts}
              onConfirm={handleConfirmPosts}
            />
          )}
          {tab === "chat" && (
            <Chat
              posts={posts}
              selectedPosts={selectedPosts}
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
