import type { YoutubeVideo } from '../types'

const SEARCH_BASE = 'https://www.googleapis.com/youtube/v3/search'
const VIDEOS_BASE = 'https://www.googleapis.com/youtube/v3/videos'

async function findChannelId(channelName: string, apiKey: string): Promise<string | null> {
  try {
    const url = new URL(SEARCH_BASE)
    url.searchParams.set('part', 'snippet')
    url.searchParams.set('q', channelName)
    url.searchParams.set('type', 'channel')
    url.searchParams.set('maxResults', '1')
    url.searchParams.set('key', apiKey)

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null

    const data = await res.json() as {
      items: { id: { channelId: string } }[]
    }
    return data.items?.[0]?.id?.channelId ?? null
  } catch {
    return null
  }
}

export async function fetchYouTubeVideos(
  channelName: string,
  maxResults = 8
): Promise<YoutubeVideo[]> {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey || !channelName) return []

  try {
    const channelId = await findChannelId(channelName, apiKey)
    if (!channelId) return []

    // Search for recent videos from channel
    const url = new URL(SEARCH_BASE)
    url.searchParams.set('part', 'snippet')
    url.searchParams.set('channelId', channelId)
    url.searchParams.set('type', 'video')
    url.searchParams.set('order', 'date')
    url.searchParams.set('maxResults', String(maxResults))
    url.searchParams.set('key', apiKey)

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return []

    const data = await res.json() as {
      items: {
        id: { videoId: string }
        snippet: {
          title: string
          description: string
          channelTitle: string
          publishedAt: string
        }
      }[]
    }

    if (!data.items?.length) return []

    // Get view counts for these videos
    const videoIds = data.items.map(i => i.id.videoId).join(',')
    const statsUrl = new URL(VIDEOS_BASE)
    statsUrl.searchParams.set('part', 'statistics')
    statsUrl.searchParams.set('id', videoIds)
    statsUrl.searchParams.set('key', apiKey)

    const statsRes = await fetch(statsUrl.toString(), { signal: AbortSignal.timeout(8000) })
    const statsData = statsRes.ok
      ? await statsRes.json() as { items: { id: string; statistics: { viewCount: string } }[] }
      : { items: [] }

    const statsMap = Object.fromEntries(
      (statsData.items ?? []).map(s => [s.id, s.statistics?.viewCount ?? '0'])
    )

    return data.items.map(item => ({
      title: item.snippet.title,
      description: item.snippet.description?.slice(0, 200) ?? '',
      channel: item.snippet.channelTitle,
      published_at: item.snippet.publishedAt,
      view_count: statsMap[item.id.videoId] ?? '0',
      url: `https://youtube.com/watch?v=${item.id.videoId}`,
    }))
  } catch {
    return []
  }
}
