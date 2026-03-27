"use client";

import { useState, useEffect } from "react";
import { storage } from "@/lib/storage";

export function Settings() {
  const [apifyToken, setApifyToken] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [envStatus, setEnvStatus] = useState<{ apify: boolean; anthropic: boolean } | null>(null);

  useEffect(() => {
    setApifyToken(storage.getApifyToken());
    setAnthropicKey(storage.getAnthropicKey());
    // Check if server-side env vars are configured
    fetch("/api/env-status")
      .then((r) => r.json())
      .then((data) => setEnvStatus(data))
      .catch(() => {});
  }, []);

  function handleSave() {
    storage.setApifyToken(apifyToken.trim());
    storage.setAnthropicKey(anthropicKey.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">Settings</h2>
      <p className="text-gray-500 mb-8">Configure your API keys.</p>

      {/* Server-side env var status */}
      {envStatus && (envStatus.apify || envStatus.anthropic) && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl">
          <p className="text-sm font-medium text-green-800 mb-2">Server-side keys (Vercel Environment Variables)</p>
          <div className="space-y-1 text-sm">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${envStatus.apify ? "bg-green-500" : "bg-gray-300"}`} />
              <span className={envStatus.apify ? "text-green-700" : "text-gray-500"}>
                Apify Token: {envStatus.apify ? "Configured" : "Not set"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${envStatus.anthropic ? "bg-green-500" : "bg-gray-300"}`} />
              <span className={envStatus.anthropic ? "text-green-700" : "text-gray-500"}>
                Anthropic Key: {envStatus.anthropic ? "Configured" : "Not set"}
              </span>
            </div>
          </div>
          {envStatus.apify && envStatus.anthropic && (
            <p className="text-xs text-green-600 mt-2">
              Both keys are set on the server. You don&apos;t need to enter them below.
            </p>
          )}
        </div>
      )}

      {/* Browser-side fallback */}
      <div className="space-y-6 max-w-lg">
        <p className="text-xs text-gray-400">
          Browser-side keys (fallback if Vercel env vars are not set):
        </p>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Apify API Token</label>
          <input
            type="password"
            value={apifyToken}
            onChange={(e) => setApifyToken(e.target.value)}
            placeholder="apify_api_..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
          <p className="text-xs text-gray-400 mt-1">
            Get yours at{" "}
            <a href="https://console.apify.com/account/integrations" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">
              console.apify.com
            </a>
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Anthropic API Key</label>
          <input
            type="password"
            value={anthropicKey}
            onChange={(e) => setAnthropicKey(e.target.value)}
            placeholder="sk-ant-api03-..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
          <p className="text-xs text-gray-400 mt-1">
            Get yours at{" "}
            <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">
              console.anthropic.com
            </a>
          </p>
        </div>

        <button
          onClick={handleSave}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          {saved ? "Saved!" : "Save Keys"}
        </button>
      </div>
    </div>
  );
}
