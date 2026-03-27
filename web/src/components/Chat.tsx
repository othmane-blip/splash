"use client";

import { useState, useRef, useEffect } from "react";
import { LinkedInPost, PostPatterns, UserContext } from "@/lib/types";
import { storage } from "@/lib/storage";

interface ImageAttachment {
  base64: string;
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  preview: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  images?: ImageAttachment[];
}

interface Props {
  posts: LinkedInPost[];
  patterns: PostPatterns | null;
  userContext: UserContext | null;
  setUserContext: (ctx: UserContext) => void;
}

export function Chat({ posts }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pendingImages, setPendingImages] = useState<ImageAttachment[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const topPosts = [...posts]
    .sort((a, b) => b.engagement_score - a.engagement_score)
    .slice(0, 5);

  const ready = posts.length > 0;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initialize: stream Claude's first message (its own analysis of the posts)
  useEffect(() => {
    if (!ready || initialized) return;
    setInitialized(true);

    async function init() {
      setStreaming(true);
      setMessages([{ role: "assistant", content: "" }]);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            anthropicKey: storage.getAnthropicKey() || "",
            messages: [], // Empty = trigger initial analysis
            topPosts,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to start");
        }

        await readStream(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to start chat");
      } finally {
        setStreaming(false);
      }
    }

    init();
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  async function readStream(res: Response) {
    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response stream");

    const decoder = new TextDecoder();
    let content = "";

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
              content += parsed.text;
              const c = content;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: c };
                return updated;
              });
            }
            if (parsed.error) throw new Error(parsed.error);
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
    }
  }

  function fileToBase64(file: File): Promise<ImageAttachment> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(",")[1];
        const mediaType = file.type as ImageAttachment["mediaType"];
        resolve({ base64, mediaType, preview: dataUrl });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleFileSelect(files: FileList | null) {
    if (!files) return;
    const newImages: ImageAttachment[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      if (file.size > 20 * 1024 * 1024) {
        setError("Image too large (max 20MB)");
        continue;
      }
      newImages.push(await fileToBase64(file));
    }
    setPendingImages((prev) => [...prev, ...newImages]);
  }

  function removePendingImage(index: number) {
    setPendingImages((prev) => prev.filter((_, i) => i !== index));
  }

  function buildApiMessages(msgs: Message[]) {
    return msgs.map((m) => {
      if (m.role === "assistant" || !m.images?.length) {
        return { role: m.role, content: m.content };
      }
      const contentBlocks: Array<
        | { type: "text"; text: string }
        | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
      > = [];
      for (const img of m.images) {
        contentBlocks.push({
          type: "image",
          source: { type: "base64", media_type: img.mediaType, data: img.base64 },
        });
      }
      if (m.content) {
        contentBlocks.push({ type: "text", text: m.content });
      }
      return { role: m.role, content: contentBlocks };
    });
  }

  async function handleSend() {
    if ((!input.trim() && pendingImages.length === 0) || streaming) return;

    const userMessage: Message = {
      role: "user",
      content: input.trim(),
      images: pendingImages.length > 0 ? [...pendingImages] : undefined,
    };
    const newMessages = [...messages, userMessage];
    setMessages([...newMessages, { role: "assistant", content: "" }]);
    setInput("");
    setPendingImages([]);
    setStreaming(true);
    setError("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anthropicKey: storage.getAnthropicKey() || "",
          messages: buildApiMessages(newMessages),
          topPosts,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Chat failed");
      }

      await readStream(res);
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
    setPendingImages([]);
    setInitialized(false);
  }

  if (!ready) {
    return (
      <div>
        <h2 className="text-2xl font-bold mb-2">Chat with Claude</h2>
        <p className="text-gray-500 mb-6">Complete the previous steps first.</p>
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          No scraped posts. Complete <strong>Scrape & Analyze</strong> first.
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-[calc(100vh-4rem)]"
      onDrop={(e) => { e.preventDefault(); handleFileSelect(e.dataTransfer.files); }}
      onDragOver={(e) => e.preventDefault()}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold">Chat with Claude</h2>
          <p className="text-gray-500 text-sm">
            Top {topPosts.length} posts loaded. Claude analyzes patterns then writes posts with you.
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
              {msg.images && msg.images.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {msg.images.map((img, j) => (
                    <img key={j} src={img.preview} alt={`Attachment ${j + 1}`} className="max-w-[200px] max-h-[150px] rounded-lg object-cover" />
                  ))}
                </div>
              )}
              <MessageContent content={msg.content} isAssistant={msg.role === "assistant"} />
            </div>
          </div>
        ))}

        {streaming && (
          <div className="flex justify-start">
            <span className="inline-block w-2 h-2 bg-gray-400 rounded-full animate-pulse" />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Pending images */}
      {pendingImages.length > 0 && (
        <div className="flex gap-2 px-1 pb-2">
          {pendingImages.map((img, i) => (
            <div key={i} className="relative group">
              <img src={img.preview} alt={`Upload ${i + 1}`} className="w-16 h-16 rounded-lg object-cover border border-gray-200" />
              <button
                onClick={() => removePendingImage(i)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                x
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-gray-200 pt-4">
        <div className="flex gap-3 items-end">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files)}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={streaming}
            className="px-3 py-3 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50"
            title="Attach image"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          </button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={async (e) => {
              const imageFiles: File[] = [];
              for (const item of Array.from(e.clipboardData.items)) {
                if (item.type.startsWith("image/")) {
                  const file = item.getAsFile();
                  if (file) imageFiles.push(file);
                }
              }
              if (imageFiles.length > 0) {
                const dt = new DataTransfer();
                imageFiles.forEach((f) => dt.items.add(f));
                handleFileSelect(dt.files);
              }
            }}
            placeholder="Drop a topic, result, or process and I'll write posts..."
            rows={2}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
            disabled={streaming}
          />
          <button
            onClick={handleSend}
            disabled={(!input.trim() && pendingImages.length === 0) || streaming}
            className="px-5 py-3 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Press Enter to send, Shift+Enter for new line. Paste or drag images to attach.
        </p>
      </div>
    </div>
  );
}

function MessageContent({ content, isAssistant }: { content: string; isAssistant: boolean }) {
  if (!isAssistant) {
    return <span className="whitespace-pre-wrap">{content}</span>;
  }

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
