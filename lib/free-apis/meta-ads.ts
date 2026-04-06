import type { MetaAd } from '../types'

const BASE = 'https://graph.facebook.com/v19.0/ads_archive'

export async function fetchMetaAds(
  pageName: string,
  countries = ['AR', 'MX', 'ES', 'US'],
  limit = 20
): Promise<MetaAd[]> {
  const token = process.env.META_ACCESS_TOKEN
  if (!token || !pageName) return []

  try {
    const url = new URL(BASE)
    url.searchParams.set('access_token', token)
    url.searchParams.set('ad_reached_countries', JSON.stringify(countries))
    url.searchParams.set('search_page_ids', '')       // will be replaced by name search
    url.searchParams.set('search_terms', pageName)
    url.searchParams.set('ad_active_status', 'ACTIVE')
    url.searchParams.set('fields', [
      'id',
      'page_name',
      'ad_creative_bodies',
      'ad_creative_link_titles',
      'ad_delivery_start_time',
      'publisher_platforms',
    ].join(','))
    url.searchParams.set('limit', String(limit))

    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) return []

    const data = await res.json() as {
      data: {
        id: string
        page_name?: string
        ad_creative_bodies?: string[]
        ad_creative_link_titles?: string[]
        ad_delivery_start_time?: string
        publisher_platforms?: string[]
      }[]
    }

    return (data.data ?? []).map(ad => ({
      id: ad.id,
      page_name: ad.page_name ?? pageName,
      body_text: (ad.ad_creative_bodies ?? [])[0] ?? '',
      started_at: ad.ad_delivery_start_time ?? '',
      platforms: ad.publisher_platforms ?? [],
    }))
  } catch {
    return []
  }
}
