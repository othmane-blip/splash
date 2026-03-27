"use client";

import { useState, useRef, useEffect } from "react";
import { LinkedInPost, PostPatterns, UserContext } from "@/lib/types";
import { storage } from "@/lib/storage";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  posts: LinkedInPost[];
  patterns: PostPatterns | null;
  userContext: UserContext | null;
  setUserContext: (ctx: UserContext) => void;
}

export function Chat({ posts, patterns, userContext }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const topPosts = [...posts]
    .sort((a, b) => b.engagement_score - a.engagement_score)
    .slice(0, 5);

  const ready = posts.length > 0 && patterns !== null;

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initialize chat with Claude's first message
  useEffect(() => {
    if (!ready || initialized) return;

    async function init() {
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            anthropicKey: storage.getAnthropicKey() || "",
            messages: [],
            patterns,
            topPosts,
          }),
        });

        const data = await res.json();
        if (data.message) {
          setMessages([{ role: "assistant", content: data.message }]);
        }
        setInitialized(true);
      } catch {
        setError("Failed to start chat");
      }
    }

    init();
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSend() {
    if (!input.trim() || streaming) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);
    setError("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anthropicKey: storage.getAnthropicKey() || "",
          messages: newMessages,
          patterns,
          topPosts,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Chat failed");
      }

      // Read the SSE stream
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let assistantContent = "";

      // Add empty assistant message that we'll fill via streaming
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") break;

            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                assistantContent += parsed.text;
                const content = assistantContent;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: "assistant", content };
                  return updated;
                });
              }
              if (parsed.error) {
                throw new Error(parsed.error);
              }
            } catch (e) {
              if (e instanceof SyntaxError) continue; // partial JSON, skip
              throw e;
            }
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chat failed");
    } finally {
      setStreaming(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleReset() {
    setMessages([]);
    setInitialized(false);
  }

  if (!ready) {
    return (
      <div>
        <h2 className="text-2xl font-bold mb-2">Chat with Claude</h2>
        <p className="text-gray-500 mb-6">Complete the previous steps first.</p>
        <div className="space-y-3">
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
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold">Chat with Claude</h2>
          <p className="text-gray-500 text-sm">
            Claude has the top {topPosts.length} posts and patterns loaded. Tell it what&apos;s top of mind and it&apos;ll write posts.
          </p>
        </div>
        {messages.length > 1 && (
          <button
            onClick={handleReset}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            New conversation
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-white border border-gray-200 text-gray-800"
              }`}
            >
              <MessageContent content={msg.content} isAssistant={msg.role === "assistant"} />
            </div>
          </div>
        ))}

        {streaming && messages[messages.length - 1]?.role === "assistant" && (
          <div className="flex justify-start">
            <span className="inline-block w-2 h-2 bg-gray-400 rounded-full animate-pulse" />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 pt-4">
        <div className="flex gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Drop a topic, result, or process and I'll write posts..."
            rows={2}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
            disabled={streaming}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || streaming}
            className="px-5 py-3 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors self-end"
          >
            Send
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

function MessageContent({ content, isAssistant }: { content: string; isAssistant: boolean }) {
  if (!isAssistant) {
    return <span className="whitespace-pre-wrap">{content}</span>;
  }

  // Simple markdown-like rendering for assistant messages
  const parts = content.split(/(\*\*.*?\*\*)/g);
  return (
    <span className="whitespace-pre-wrap">
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}
