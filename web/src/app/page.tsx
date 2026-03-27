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
  const [chatKey, setChatKey] = useState(0); // key to force chat remount
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
    setChatKey((k) => k + 1); // reset chat when new posts confirmed
    setTab("chat");
  }

  function handleStartOver() {
    setSelectedPosts([]);
    setPosts([]);
    setChatKey((k) => k + 1);
    setTab("scrape");
  }

  function handleTabClick(id: TabId) {
    // Block chat tab if no posts confirmed
    if (id === "chat" && selectedPosts.length === 0) {
      setTab("scrape");
      return;
    }
    setTab(id);
  }

  if (!loaded) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  const chatLocked = selectedPosts.length === 0;

  return (
    <div className="flex h-screen">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="GhostPost" className="w-7 h-7" />
            <div>
              <h1 className="text-lg font-bold text-gray-900">Ghost<span className="text-blue-600">Post</span></h1>
              <p className="text-[10px] text-gray-400 -mt-0.5">AI-powered LinkedIn ghostwriter</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {TABS.map((t) => {
            const locked = t.id === "chat" && chatLocked;
            return (
              <button
                key={t.id}
                onClick={() => handleTabClick(t.id)}
                className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  tab === t.id
                    ? "bg-blue-50 text-blue-700"
                    : locked
                    ? "text-gray-300 cursor-not-allowed"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {t.label}
                {locked && <span className="ml-1 text-[10px] text-gray-300">- confirm posts first</span>}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200 text-xs space-y-1.5">
          <div className="font-medium text-gray-500 uppercase tracking-wider mb-2">Pipeline Status</div>
          <StatusDot ok={profiles.length > 0} label={`${profiles.length} profiles`} />
          <StatusDot ok={posts.length > 0} label={`${posts.length} posts scraped`} />
          <StatusDot ok={selectedPosts.length > 0} label={selectedPosts.length > 0 ? `${selectedPosts.length} posts confirmed` : "No posts confirmed"} />
        </div>

        {/* Start Over button */}
        {(posts.length > 0 || selectedPosts.length > 0) && (
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={handleStartOver}
              className="w-full px-3 py-2 text-xs font-medium text-gray-500 bg-gray-50 rounded-lg hover:bg-gray-100 hover:text-gray-700 transition-colors"
            >
              Start over
            </button>
          </div>
        )}
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
              key={chatKey}
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
