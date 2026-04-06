import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { fetchMetaAds } from '@/lib/free-apis/meta-ads'
import { fetchNews } from '@/lib/free-apis/newsapi'
import { fetchRSSFeed } from '@/lib/free-apis/rss'
import { fetchYouTubeVideos } from '@/lib/free-apis/youtube'
import { fetchInstagramAccount } from '@/lib/free-apis/apify'
import type { CompetitorHandle, RealContext, RSSItem } from '@/lib/types'

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { competitor, keywords, rss_feeds } = await req.json() as {
    competitor: CompetitorHandle
    keywords:   string[]
    rss_feeds:  string[]
  }

  if (!competitor?.name) {
    return NextResponse.json({ error: 'competitor.name es requerido' }, { status: 400 })
  }

  // Use instagram_handle for Apify if available and no facebook_page_name
  const igHandle = competitor.instagram_handle?.replace('@', '')

  const [metaAds, news, competitorRss, youtubeVideos, igMetrics] = await Promise.all([
    competitor.facebook_page_name
      ? fetchMetaAds(competitor.facebook_page_name)
      : Promise.resolve([]),
    fetchNews([competitor.name, ...keywords].slice(0, 4)),
    competitor.website_url ? fetchRSSFeed(competitor.website_url) : Promise.resolve([]),
    competitor.youtube_channel ? fetchYouTubeVideos(competitor.youtube_channel) : Promise.resolve([]),
    // If we have instagram handle and APIFY_TOKEN, fetch IG metrics
    (igHandle && process.env.APIFY_TOKEN)
      ? fetchInstagramAccount(igHandle, '', 30).then(r => (!r || 'apify_error' in r) ? null : r).catch(() => null)
      : Promise.resolve(null),
  ])

  const industryRss: RSSItem[] = rss_feeds?.length > 0
    ? await Promise.allSettled(rss_feeds.slice(0, 3).map(u => fetchRSSFeed(u)))
        .then(results =>
          results
            .filter((r): r is PromiseFulfilledResult<RSSItem[]> => r.status === 'fulfilled')
            .flatMap(r => r.value)
        )
    : []

  // Build news items from Instagram top posts if available
  const igNewsItems = igMetrics?.top_posts?.slice(0, 5).map(p => ({
    title:        p.caption?.split('\n')[0]?.slice(0, 100) ?? '(sin caption)',
    description:  p.caption?.slice(0, 300) ?? '',
    source:       `@${igHandle} (Instagram)`,
    published_at: p.timestamp,
    url:          p.url,
  })) ?? []

  const context: RealContext = {
    news:           [...news, ...igNewsItems],
    rss:            [...competitorRss, ...industryRss].slice(0, 20),
    meta_ads:       metaAds,
    youtube_videos: youtubeVideos,
    fetched_at:     new Date().toISOString(),
  }

  const igCount = igMetrics?.top_posts?.length ?? 0

  return NextResponse.json({
    context,
    summary: {
      meta_ads_found:  metaAds.length,
      news_found:      news.length,
      rss_found:       (competitorRss.length + industryRss.length),
      youtube_found:   youtubeVideos.length,
      instagram_found: igCount,
      has_any_data:    metaAds.length > 0 || news.length > 0 || youtubeVideos.length > 0 || igCount > 0,
    },
  })
}
