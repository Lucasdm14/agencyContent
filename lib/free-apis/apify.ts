/**
 * Apify Instagram integration
 * Actor: apify/instagram-scraper (posts + profile en un solo actor)
 *
 * FIX: input actualizado al formato actual del actor (2024+).
 * FIX: runActor ahora retorna el error real para que la UI lo muestre.
 */
import type { InstagramPost, InstagramProfile, InstagramAccountMetrics, FormatInsights, ContentFormat } from '../types'

const APIFY_BASE = 'https://api.apify.com/v2'

// FIX: retorna { data, error } en lugar de silenciar errores con []
async function runActor<T>(
  actorId: string,
  input: Record<string, unknown>,
  timeoutSec = 120
): Promise<{ data: T[]; error?: string }> {
  const token = process.env.APIFY_TOKEN
  if (!token) return { data: [], error: 'APIFY_TOKEN no configurado' }

  try {
    const res = await fetch(
      `${APIFY_BASE}/acts/${actorId}/run-sync-get-dataset-items?token=${token}&timeout=${timeoutSec}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout((timeoutSec + 20) * 1000),
      }
    )
    if (!res.ok) {
      const body = await res.text().catch(() => '').then(t => t.slice(0, 300))
      const msg  = `Actor ${actorId} respondió ${res.status}: ${body}`
      console.error(`[Apify] ${msg}`)
      return { data: [], error: msg }
    }
    const data = await res.json() as T[]
    return { data }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[Apify] ${actorId} error:`, err)
    return { data: [], error: msg }
  }
}

// ─── Raw Apify post shape ─────────────────────────────────────────────────────

interface RawPost {
  url:            string
  shortCode?:     string
  type:           string
  caption?:       string
  hashtags?:      string[]
  likesCount?:    number
  commentsCount?: number
  videoViewCount?: number
  displayUrl?:    string
  videoUrl?:      string
  timestamp:      string
  ownerUsername?: string
  ownerFullName?: string
  locationName?:  string
  isSponsored?:   boolean
  // El actor también puede devolver el perfil embebido
  ownerFollowersCount?: number
  followersCount?: number
}

interface RawProfile {
  username?:           string
  fullName?:           string
  followersCount?:     number
  followsCount?:       number
  postsCount?:         number
  profilePicUrl?:      string
  biography?:          string
  verified?:           boolean
  isBusinessAccount?:  boolean
}

// ─── Compute engagement rate ──────────────────────────────────────────────────

function computeER(post: { likesCount: number; commentsCount: number; videoViewCount?: number }, followers: number): number {
  if (followers === 0) return 0
  const interactions = (post.likesCount ?? 0) + (post.commentsCount ?? 0)
  return Math.round((interactions / followers) * 10000) / 100
}

function computeScore(post: RawPost, followers: number): number {
  const likes    = post.likesCount    ?? 0
  const comments = post.commentsCount ?? 0
  const views    = post.videoViewCount ?? 0
  return likes + comments * 3 + views * 0.05 + computeER({ likesCount: likes, commentsCount: comments }, followers) * 100
}

// ─── Map format ───────────────────────────────────────────────────────────────

function mapFormat(type: string): ContentFormat {
  if (type === 'Video')   return 'reel'
  if (type === 'Sidecar') return 'carousel'
  return 'post'
}

// ─── Build FormatInsights from posts ─────────────────────────────────────────

function buildFormatInsights(
  brand_id: string,
  handle: string,
  posts: InstagramPost[],
  profile: InstagramProfile
): FormatInsights {
  const followers = profile.followersCount || 1

  const byFormat: Record<string, InstagramPost[]> = {}
  posts.forEach(p => {
    const fmt = mapFormat(p.type)
    if (!byFormat[fmt]) byFormat[fmt] = []
    byFormat[fmt].push(p)
  })

  const format_stats: FormatInsights['format_stats'] = {}
  Object.entries(byFormat).forEach(([fmt, fmtPosts]) => {
    const avg_likes = Math.round(fmtPosts.reduce((s, p) => s + p.likesCount, 0) / fmtPosts.length)
    const avgViews  = fmtPosts.some(p => (p.videoViewCount ?? 0) > 0)
      ? Math.round(fmtPosts.reduce((s, p) => s + (p.videoViewCount ?? 0), 0) / fmtPosts.length)
      : null
    const avg_er    = Math.round(fmtPosts.reduce((s, p) => s + (p.er ?? 0), 0) / fmtPosts.length * 100) / 100
    format_stats[fmt as ContentFormat] = { count: fmtPosts.length, avg_er, avg_likes, avg_views: avgViews }
  })

  const best_format = (Object.entries(format_stats)
    .sort(([, a], [, b]) => (b?.avg_er ?? 0) - (a?.avg_er ?? 0))[0]?.[0] ?? 'post') as ContentFormat

  const hourCounts: Record<number, { total_er: number; count: number }> = {}
  posts.forEach(p => {
    const hour = new Date(p.timestamp).getHours()
    if (!hourCounts[hour]) hourCounts[hour] = { total_er: 0, count: 0 }
    hourCounts[hour].total_er += p.er ?? 0
    hourCounts[hour].count++
  })
  const best_posting_hours = Object.entries(hourCounts)
    .sort(([, a], [, b]) => (b.total_er / b.count) - (a.total_er / a.count))
    .slice(0, 3)
    .map(([h]) => parseInt(h))

  const hashtagCounts: Record<string, number> = {}
  posts.forEach(p => (p.hashtags ?? []).forEach(h => { hashtagCounts[h] = (hashtagCounts[h] ?? 0) + 1 }))
  const top_hashtags = Object.entries(hashtagCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([h]) => `#${h}`)

  const avg_caption_length = Math.round(
    posts.reduce((s, p) => s + (p.caption?.length ?? 0), 0) / Math.max(posts.length, 1)
  )

  return {
    brand_id, instagram_handle: handle,
    followers_count: profile.followersCount,
    posts_count:     posts.length,
    source:          'apify',
    best_format, format_stats,
    best_posting_hours, top_hashtags, avg_caption_length,
    generated_at: new Date().toISOString(),
  }
}

// ─── Main export: fetch full account metrics ──────────────────────────────────

export async function fetchInstagramAccount(
  username: string,
  brand_id:  string,
  periodDays = 30,
  limit = 50   // FIX: reducido de 80 para mayor velocidad y menos bloqueos
): Promise<InstagramAccountMetrics | null | { apify_error: string }> {

  // FIX: input actualizado al formato actual del actor apify/instagram-scraper
  // El campo resultsType fue deprecado — el actor detecta el tipo por la URL
  const [postsResult, profileResult] = await Promise.all([
    runActor<RawPost>('apify~instagram-scraper', {
      directUrls:   [`https://www.instagram.com/${username}/`],
      resultsLimit: limit,
      // No incluir resultsType — deprecado en versiones recientes del actor
      // El actor devuelve posts por default cuando se pasa una URL de perfil
    }),
    runActor<RawProfile>('apify~instagram-profile-scraper', {
      usernames: [username],
    }, 60),
  ])

  // FIX: propagar error específico de Apify en lugar de retornar null genérico
  if (postsResult.error) {
    console.error('[Apify] fetchInstagramAccount error:', postsResult.error)
    return { apify_error: postsResult.error }
  }

  if (postsResult.data.length === 0) return null

  const rawPosts   = postsResult.data
  // FIX: perfil es opcional — no bloquear si falla
  const rawProfile = profileResult.data[0] ?? {}

  // Intentar obtener followers de los posts si el perfil no cargó
  const followersFromPosts = rawPosts[0]?.ownerFollowersCount ?? rawPosts[0]?.followersCount ?? 0

  const profile: InstagramProfile = {
    username:           rawProfile.username ?? username,
    fullName:           rawProfile.fullName,
    followersCount:     rawProfile.followersCount ?? followersFromPosts,
    followsCount:       rawProfile.followsCount   ?? 0,
    postsCount:         rawProfile.postsCount      ?? 0,
    profilePicUrl:      rawProfile.profilePicUrl,
    bio:                rawProfile.biography,
    isVerified:         rawProfile.verified,
    isBusinessAccount:  rawProfile.isBusinessAccount,
  }

  const followers = profile.followersCount || 1

  const cutoff   = Date.now() - periodDays * 86_400_000
  const inPeriod = rawPosts.filter(p => new Date(p.timestamp).getTime() >= cutoff)
  const raw      = inPeriod.length > 0 ? inPeriod : rawPosts

  const posts: InstagramPost[] = raw.map(p => {
    const likes    = p.likesCount    ?? 0
    const comments = p.commentsCount ?? 0
    const er       = computeER({ likesCount: likes, commentsCount: comments }, followers)
    const score    = computeScore(p, followers)
    return {
      url:           p.url,
      shortCode:     p.shortCode,
      type:          (p.type as 'Image' | 'Video' | 'Sidecar') || 'Image',
      caption:       p.caption ?? '',
      hashtags:      p.hashtags ?? [],
      likesCount:    likes,
      commentsCount: comments,
      videoViewCount: p.videoViewCount,
      displayUrl:    p.displayUrl,
      videoUrl:      p.videoUrl,
      timestamp:     p.timestamp,
      ownerUsername: p.ownerUsername ?? username,
      ownerFullName: p.ownerFullName,
      locationName:  p.locationName,
      isSponsored:   p.isSponsored,
      score, er,
    }
  }).sort((a, b) => b.score - a.score)

  const top_hooks = posts.slice(0, 5).map(p => {
    const first = p.caption?.split(/[.!?\n]/)[0]?.trim()
    return first?.slice(0, 120) ?? ''
  }).filter(Boolean)

  const format_breakdown: Record<string, number> = {}
  posts.forEach(p => { format_breakdown[p.type] = (format_breakdown[p.type] ?? 0) + 1 })

  const format_insights = buildFormatInsights(brand_id, username, posts, profile)

  return {
    profile,
    period_days: periodDays,
    posts,
    top_posts:   posts.slice(0, 12),
    format_breakdown,
    format_insights,
    top_hooks,
    fetched_at: new Date().toISOString(),
  }
}

// ─── Meta Ad Library via Apify ────────────────────────────────────────────────

interface RawMetaAd {
  page_name?: string; body_text?: string; ad_id?: string
  start_date?: string; end_date?: string; platforms?: string[]
  cta_text?: string; media_type?: string
}

export async function fetchMetaAdLibraryApify(pageName: string, countries = ['AR', 'MX', 'ES']) {
  const result = await runActor<RawMetaAd>('apify~facebook-ads-scraper', {
    searchTerms: [pageName], countries, adActiveStatus: 'ACTIVE', limit: 40,
  })
  const items = result.data
  const now = Date.now(); const sevenDays = 7 * 86_400_000
  return {
    new_ads:    items.filter(a => a.start_date && (now - new Date(a.start_date).getTime()) < sevenDays),
    active_ads: items,
    main_messages:    [...new Set(items.map(a => a.body_text?.slice(0, 120)).filter(Boolean))] as string[],
    creative_formats: [...new Set(items.map(a => a.media_type).filter(Boolean))] as string[],
    cta_patterns:     [...new Set(items.map(a => a.cta_text).filter(Boolean))] as string[],
  }
}
