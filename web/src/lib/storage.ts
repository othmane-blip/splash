import { LinkedInProfile, LinkedInPost, PostPatterns, UserContext, GeneratedPost } from "./types";

const KEYS = {
  profiles: "splash_profiles",
  posts: "splash_posts",
  patterns: "splash_patterns",
  userContext: "splash_user_context",
  generatedPosts: "splash_generated_posts",
  apifyToken: "splash_apify_token",
  anthropicKey: "splash_anthropic_key",
} as const;

function get<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function set(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

export const storage = {
  getProfiles: (): LinkedInProfile[] =>
    get(KEYS.profiles, [
      { name: "Dakota Robertson", linkedin_url: "https://www.linkedin.com/in/dakotarobertson/", category: "personal branding" },
      { name: "Lara Acosta", linkedin_url: "https://www.linkedin.com/in/laraacostar/", category: "personal branding" },
      { name: "Justin Welsh", linkedin_url: "https://www.linkedin.com/in/justinwelsh/", category: "solopreneurship" },
      { name: "Hatice Sultan", linkedin_url: "https://www.linkedin.com/in/hatice-sultan-ghostwriter/", category: "ghostwriting" },
      { name: "Jake Ward", linkedin_url: "https://www.linkedin.com/in/jakezward/", category: "content growth" },
      { name: "Cameron Trew", linkedin_url: "https://www.linkedin.com/in/camerontrew/", category: "marketing" },
    ]),
  setProfiles: (v: LinkedInProfile[]) => set(KEYS.profiles, v),

  getPosts: (): LinkedInPost[] => get(KEYS.posts, []),
  setPosts: (v: LinkedInPost[]) => set(KEYS.posts, v),

  getPatterns: (): PostPatterns | null => get(KEYS.patterns, null),
  setPatterns: (v: PostPatterns) => set(KEYS.patterns, v),

  getUserContext: (): UserContext | null => get(KEYS.userContext, null),
  setUserContext: (v: UserContext) => set(KEYS.userContext, v),

  getGeneratedPosts: (): GeneratedPost[] => get(KEYS.generatedPosts, []),
  setGeneratedPosts: (v: GeneratedPost[]) => set(KEYS.generatedPosts, v),

  getApifyToken: (): string => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(KEYS.apifyToken) || "";
  },
  setApifyToken: (v: string) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(KEYS.apifyToken, v);
  },

  getAnthropicKey: (): string => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(KEYS.anthropicKey) || "";
  },
  setAnthropicKey: (v: string) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(KEYS.anthropicKey, v);
  },
};
