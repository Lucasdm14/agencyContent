import type { RSSItem } from '../types'
// rss-parser runs server-side only (Next.js API routes)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Parser = require('rss-parser')

const parser = new Parser({ timeout: 8000 })

export async function fetchRSSFeed(feedUrl: string): Promise<RSSItem[]> {
  try {
    const feed = await parser.parseURL(feedUrl) as {
      title?: string
      items: {
        title?: string
        contentSnippet?: string
        content?: string
        isoDate?: string
        link?: string
      }[]
    }

    const feedName = feed.title ?? new URL(feedUrl).hostname

    return (feed.items ?? []).slice(0, 6).map(item => ({
      title: item.title ?? 'Sin título',
      summary: (item.contentSnippet ?? item.content ?? '').slice(0, 200),
      feed_name: feedName,
      published_at: item.isoDate ?? new Date().toISOString(),
      url: item.link ?? feedUrl,
    }))
  } catch {
    return []
  }
}

export async function fetchMultipleFeeds(feedUrls: string[]): Promise<RSSItem[]> {
  if (feedUrls.length === 0) return []

  const results = await Promise.allSettled(
    feedUrls.map(url => fetchRSSFeed(url))
  )

  return results
    .filter((r): r is PromiseFulfilledResult<RSSItem[]> => r.status === 'fulfilled')
    .flatMap(r => r.value)
    .slice(0, 20)
}
