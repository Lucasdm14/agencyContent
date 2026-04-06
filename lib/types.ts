// ─── Brandbook ────────────────────────────────────────────────────────────────

export interface BrandbookRules {
  tone: { voice: string; pronouns: string; examples_good: string[]; examples_bad: string[] }
  emojis:        { allowed: boolean; max_per_post: number; banned_list: string[] }
  hashtags:      { always_include: string[]; banned: string[]; max_count: number }
  content_rules: string[]
}

// ─── Brand Assets ─────────────────────────────────────────────────────────────

export interface BrandImage {
  id: string; name: string; url: string
  source: 'upload' | 'drive' | 'url'
  mime_type?: string; created_at: string
}

export interface BrandAssets {
  drive_folder_url?: string
  drive_images:      BrandImage[]
  uploaded_images:   BrandImage[]
  manual_url?:       string
  manual_base64?:    string
  use_ai_matching:   boolean
}

// ─── Agent ────────────────────────────────────────────────────────────────────

export type AgentRole      = 'copy' | 'estratega' | 'supervisor'
export type AgentEnergy    = 'alta' | 'media' | 'baja'
export type AgentFormality = 'formal' | 'semiformal' | 'informal'

export interface Agent {
  id: string; brand_id: string; role: AgentRole
  name: string; description: string; segment: string
  tone_voice: string; energy: AgentEnergy; formality: AgentFormality
  platform_focus: string[]; content_priorities: string[]
  extra_rules: string[]; custom_system_prompt: string
  created_at: string
}

// ─── Competitor ───────────────────────────────────────────────────────────────

export interface CompetitorHandle {
  name: string; facebook_page_name?: string
  youtube_channel?: string; website_url?: string
  instagram_handle?: string
}

// ─── Brand ────────────────────────────────────────────────────────────────────

export interface Brand {
  id: string; name: string; industry: string; target_audience: string
  brandbook_rules: BrandbookRules
  brand_prompt:    string
  brand_assets:    BrandAssets
  instagram_handle: string          // @handle — links metrics automatically
  webhook_url:     string
  news_keywords:   string[]
  competitors:     CompetitorHandle[]
  rss_feeds:       string[]
  created_at:      string
}

// ─── Content Format ───────────────────────────────────────────────────────────

export type ContentFormat = 'reel' | 'story' | 'carousel' | 'post' | 'video' | 'live'
export type ContentTheme  = 'informativo' | 'producto' | 'comunidad' | 'educativo' | 'tendencia'

// ─── Format Insights (from Apify or manual) ───────────────────────────────────

export interface FormatStat {
  count:    number
  avg_er:   number     // engagement rate %
  avg_likes: number
  avg_views: number | null
}

export interface FormatInsights {
  brand_id:          string
  instagram_handle:  string
  followers_count:   number
  posts_count:       number
  source:            'apify' | 'manual'
  best_format:       ContentFormat
  format_stats:      Partial<Record<ContentFormat, FormatStat>>
  best_posting_hours: number[]        // e.g. [18, 19, 20]
  top_hashtags:      string[]
  avg_caption_length: number
  generated_at:      string
}

// ─── Script ───────────────────────────────────────────────────────────────────

export interface ScriptScene {
  order:        number
  duration_sec: number
  visual:       string        // qué se ve en pantalla
  text_overlay?: string       // texto sobre la imagen/video
  voiceover?:   string        // qué se dice
  cta?:         string
}

export interface Script {
  total_duration_sec: number
  scenes:             ScriptScene[]
  music_mood?:        string
  voiceover_full?:    string  // guión completo de voz para story/reel
}

// ─── Posts / Posts plan ───────────────────────────────────────────────────────

export type PostStatus = 'pm_review' | 'supervisor_review' | 'approved' | 'webhook_sent' | 'rejected'

export interface ClauseValidation {
  rule: string; category: string; passed: boolean; comment: string | null
}

export interface Post {
  id: string; brand_id: string; brand_name: string
  agent_id?: string; agent_name?: string
  image_url: string; platform: string
  generated_copy: string; final_copy: string
  hashtags: string[]; ai_rationale: string
  supervisor_score: number; supervisor_validation: ClauseValidation[]
  critical_violations: number; suggested_fix: string | null
  scheduled_date: string; status: PostStatus
  context_used?: { news_count: number; rss_count: number; competitor_ads_count: number; sources: string[] }
  created_at: string
}

// ─── Strategy ─────────────────────────────────────────────────────────────────

export interface StrategyPostPlan {
  day:              number
  platform:         string
  format:           ContentFormat        // reel | story | carousel | post | video | live
  format_rationale: string               // justificado con métricas reales
  content_type:     ContentTheme
  topic:            string
  keywords:         string[]             // para caption, overlay, SEO
  hook_suggestion:  string
  source_reference: string
  visual_direction: string
  script_outline?:  Omit<Script, 'voiceover_full'>  // outline del estratega
}

export interface CopyOption {
  index:     number
  angle:     string
  copy:      string
  hashtags:  string[]
  keywords:  string[]
  rationale: string
  script?:   Script    // guión completo del copy agent (para reel/story/video)
}

export interface StrategyPostWithCopies extends StrategyPostPlan {
  copies?:              CopyOption[]
  selected_copy_index?: number
  copies_done?:         boolean
}

export interface SupervisorReport {
  overall_score:   number
  brand_alignment: number
  format_score:    number    // qué tan alineados están los formatos con las métricas
  strengths:       string[]
  weaknesses:      string[]
  post_feedback:   { day: number; topic: string; format: string; passed: boolean; comment: string | null }[]
  calendar_suggestion: { day: number; platform: string; recommended_time: string; reasoning: string }[]
  improvements:    string[]
  approved:        boolean
}

export interface StrategySession {
  id: string; brand_id: string; brand_name: string
  estratega_id: string; estratega_name: string
  copy_agent_id: string; copy_agent_name: string
  supervisor_id: string; supervisor_name: string
  num_days: number; period_label: string
  selected_platforms?: string[]
  format_insights?: FormatInsights      // loaded in step 0
  step: 0 | 1 | 2 | 3 | 4
  pillars: string[]; strategy_rationale: string
  posts: StrategyPostWithCopies[]
  supervisor_report?: SupervisorReport
  created_at: string
}

// ─── Campaign ────────────────────────────────────────────────────────────────

export type CampaignPostStatus = 'draft' | 'scheduled' | 'published' | 'failed'

export interface CampaignPost {
  id: string; day: number; platform: string
  format: ContentFormat
  topic: string; content_type: string
  hook_suggestion: string; visual_direction: string
  copy: string; hashtags: string[]; keywords: string[]
  script?: Script
  scheduled_at?: string; status: CampaignPostStatus
  published_at?: string; error_msg?: string
}

export interface Campaign {
  id: string; brand_id: string; brand_name: string
  period_label: string; estratega_name: string; supervisor_name: string
  overall_score: number; format_score: number
  strengths: string[]; weaknesses: string[]
  posts: CampaignPost[]
  created_at: string; status: 'draft' | 'publishing' | 'done'
}

// ─── Social Account ───────────────────────────────────────────────────────────

export type SocialPlatform = 'instagram' | 'facebook' | 'linkedin' | 'twitter' | 'tiktok'

export interface SocialAccount {
  id: string; brand_id: string; platform: SocialPlatform
  handle: string; display_name: string
  access_token: string; page_id?: string; webhook_url?: string
  connected_at: string
}

// ─── Apify Instagram ──────────────────────────────────────────────────────────

export interface InstagramPost {
  url: string
  shortCode?: string
  type: 'Image' | 'Video' | 'Sidecar'
  caption: string
  hashtags?: string[]
  likesCount: number
  commentsCount: number
  videoViewCount?: number
  displayUrl?: string    // thumbnail URL
  videoUrl?: string      // video URL for reels
  timestamp: string
  ownerUsername: string
  ownerFullName?: string
  locationName?: string
  isSponsored?: boolean
  // computed
  score: number
  er?: number           // engagement rate
}

export interface InstagramProfile {
  username:       string
  fullName?:      string
  followersCount: number
  followsCount:   number
  postsCount:     number
  profilePicUrl?: string
  bio?:           string
  isVerified?:    boolean
  isBusinessAccount?: boolean
}

export interface InstagramAccountMetrics {
  profile:           InstagramProfile
  period_days:       number
  posts:             InstagramPost[]     // all posts in period
  top_posts:         InstagramPost[]     // top 10 by score
  format_breakdown:  Record<string, number>
  format_insights:   FormatInsights
  top_hooks:         string[]
  fetched_at:        string
}

// ─── Competitor Analysis ──────────────────────────────────────────────────────

export interface RSSItem {
  title: string; summary: string; feed_name: string; published_at: string; url: string
}

export interface NewsItem {
  title: string; description: string; source: string; published_at: string; url: string
}

export interface MetaAd {
  id: string; page_name: string; body_text: string; started_at: string; platforms: string[]
}

export interface YoutubeVideo {
  title: string; description: string; channel: string; published_at: string; view_count: string; url: string
}

export interface RealContext {
  news: { title: string; description: string; source: string; published_at: string; url: string }[]
  rss:  { title: string; summary: string; feed_name: string; published_at: string; url: string }[]
  meta_ads: { id: string; page_name: string; body_text: string; started_at: string; platforms: string[] }[]
  youtube_videos: { title: string; description: string; channel: string; published_at: string; view_count: string; url: string }[]
  fetched_at: string
}

export interface CompetitorAnalysis {
  id: string; brand_id: string; brand_name: string
  competitor_name: string; analyzed_at: string; raw_data: RealContext
  insights: {
    active_ads_count: number; main_messages: string[]; content_themes: string[]
    posting_cadence: string; differentiation_opportunities: string[]
    topics_to_avoid: string[]; recommended_angles: string[]
    confidence: 'high' | 'medium' | 'low'; data_sources_used: string[]; disclaimer: string
  }
}

// ─── Metrics Report (CSV) ─────────────────────────────────────────────────────

export interface MetricsReport {
  id: string; brand_id: string; brand_name: string; platform: string
  period: string; uploaded_at: string; raw_rows: number
  insights: {
    best_performing_posts: { copy_preview: string; metric: string; value: number }[]
    worst_performing_posts: { copy_preview: string; metric: string; value: number }[]
    avg_engagement_rate: number | null; best_day_of_week: string; best_time_of_day: string
    top_content_themes: string[]; recommendations: string[]
    data_quality: 'complete' | 'partial' | 'minimal'; columns_found: string[]
  }
}

// ─── Content Strategy (finalized) ────────────────────────────────────────────

export interface ContentStrategy {
  id: string; brand_id: string; brand_name: string
  agent_id?: string; agent_name?: string
  period: string; created_at: string; data_sources: string[]
  posts: StrategyPostPlan[]; pillars: string[]; disclaimer: string
}
export type StrategyPost = StrategyPostPlan
