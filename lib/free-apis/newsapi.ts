import type { NewsItem } from '../types'

const BASE = 'https://newsapi.org/v2/everything'

export async function fetchNews(
  keywords: string[],
  language = 'es',
  daysBack = 30
): Promise<NewsItem[]> {
  const apiKey = process.env.NEWS_API_KEY
  if (!apiKey || keywords.length === 0) return []

  const from = new Date(Date.now() - daysBack * 86400_000)
    .toISOString().split('T')[0]

  const q = keywords.slice(0, 3).join(' OR ')

  try {
    const url = new URL(BASE)
    url.searchParams.set('q', q)
    url.searchParams.set('language', language)
    url.searchParams.set('from', from)
    url.searchParams.set('sortBy', 'relevancy')
    url.searchParams.set('pageSize', '8')
    url.searchParams.set('apiKey', apiKey)

    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) return []

    const data = await res.json() as {
      articles: {
        title: string
        description: string
        source: { name: string }
        publishedAt: string
        url: string
      }[]
    }

    return (data.articles ?? [])
      .filter(a => a.title && a.description)
      .map(a => ({
        title: a.title,
        description: a.description ?? '',
        source: a.source?.name ?? 'NewsAPI',
        published_at: a.publishedAt,
        url: a.url,
      }))
  } catch {
    return []
  }
}
