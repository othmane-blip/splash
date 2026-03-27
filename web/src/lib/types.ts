export interface LinkedInProfile {
  name: string;
  linkedin_url: string;
  category: string;
}

export interface LinkedInPost {
  author_name: string;
  author_url: string;
  text: string;
  posted_at: string;
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
  media_type: string;
  post_url: string;
  reaction_types: Record<string, number>;
  engagement_score: number;
  image_urls?: string[];
  _raw_keys?: string[];
  _debug_engagement?: string;
  _debug_socialContent?: string;
}

export interface PostPatterns {
  common_hooks?: Array<{ type: string; example?: string; description?: string } | string>;
  winning_structures?: Array<{ name?: string; type?: string; description?: string } | string>;
  tone_patterns?: string[] | string;
  formatting_tricks?: string[];
  content_themes?: string[];
  engagement_drivers?: Array<{ driver?: string; description?: string } | string>;
  ideal_post_blueprint?: Array<{ step?: string; description?: string } | string> | Record<string, string> | string;
  dos?: string[];
  donts?: string[];
}

export interface UserContext {
  name: string;
  role: string;
  industry: string;
  expertise_areas: string[];
  recent_achievements: string[];
  opinions: string[];
  target_audience: string;
  tone_preference: string;
}

export interface GeneratedPost {
  content: string;
  inspired_by: string;
  pattern_used: string;
  hook_type: string;
  estimated_engagement: string;
  tips: string[];
}

export interface PipelineState {
  profiles: LinkedInProfile[];
  posts: LinkedInPost[];
  patterns: PostPatterns | null;
  userContext: UserContext | null;
  generatedPosts: GeneratedPost[];
}
