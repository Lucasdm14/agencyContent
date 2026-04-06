import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import OpenAI from 'openai'
import { creatorSystem, creatorPrompt, supervisorSystem, supervisorPrompt } from '@/lib/prompts'
import { fetchNews } from '@/lib/free-apis/newsapi'
import { fetchMultipleFeeds } from '@/lib/free-apis/rss'
import { fetchMetaAds } from '@/lib/free-apis/meta-ads'
import type { Brand, Agent, BrandImage } from '@/lib/types'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

function parseJSON<T>(raw: string): T {
  const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  return JSON.parse(clean) as T
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { brand, image_base64, image_url, platform, agent, use_ai_image_match, topic } = await req.json() as {
    brand:              Brand
    image_base64?:      string   // uploaded image
    image_url?:         string   // drive or external URL
    platform:           string
    agent?:             Agent | null
    use_ai_image_match?: boolean
    topic?:             string
  }

  if (!brand || !platform) {
    return NextResponse.json({ error: 'brand y platform son requeridos' }, { status: 400 })
  }

  // At least one image source required
  const imageSource = image_base64 || image_url
  if (!imageSource) {
    return NextResponse.json({ error: 'Se requiere image_base64 o image_url' }, { status: 400 })
  }

  const brandbookJson = JSON.stringify(brand.brandbook_rules, null, 2)

  // ── If AI image matching enabled and topic provided, pick best image ───────
  let suggestedImageUrl: string | null = null
  if (use_ai_image_match && topic && brand.brand_assets) {
    const allImages: BrandImage[] = [
      ...(brand.brand_assets.uploaded_images ?? []),
      ...(brand.brand_assets.drive_images    ?? []),
    ]
    if (allImages.length > 0) {
      try {
        const res = await openai.chat.completions.create({
          model:       'gpt-4o-mini',
          temperature: 0,
          messages: [{
            role: 'user',
            content: `Tenés estas imágenes disponibles en el banco de la marca:\n${allImages.map((img, i) => `${i}: ${img.name}`).join('\n')}\n\nEl tema del post es: "${topic}"\n\nRespondé SOLO con el número (índice) de la imagen más relevante para este tema. Solo el número, nada más.`,
          }],
        })
        const idx = parseInt(res.choices[0]?.message?.content?.trim() ?? '0')
        if (!isNaN(idx) && allImages[idx]) {
          suggestedImageUrl = allImages[idx].url
        }
      } catch { /* fallback to provided image */ }
    }
  }

  // ── Fetch real-world context ───────────────────────────────────────────────
  const keywords = brand.news_keywords?.length > 0
    ? brand.news_keywords
    : [brand.industry, brand.name].filter(Boolean)

  const competitorAdPromises = (brand.competitors ?? [])
    .filter(c => c.facebook_page_name).slice(0, 2)
    .map(c => fetchMetaAds(c.facebook_page_name!))

  const [newsItems, rssItems, ...adArrays] = await Promise.all([
    fetchNews(keywords),
    fetchMultipleFeeds(brand.rss_feeds ?? []),
    ...competitorAdPromises,
  ])
  const competitorAds = adArrays.flat().slice(0, 10)

  const contextSummary = {
    news_count:           newsItems.length,
    rss_count:            rssItems.length,
    competitor_ads_count: competitorAds.length,
    sources: [
      ...(newsItems.length     > 0 ? ['NewsAPI'] : []),
      ...(rssItems.length      > 0 ? ['RSS'] : []),
      ...(competitorAds.length > 0 ? ['Meta Ads'] : []),
    ],
  }

  // ── Creator ────────────────────────────────────────────────────────────────
  const finalImage = suggestedImageUrl ?? imageSource
  let creator: { generated_copy: string; hashtags: string[]; visual_description: string; rationale: string }

  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o', temperature: 0.8,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: creatorSystem(brand.name, platform, agent) },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: finalImage } },
            { type: 'text', text: creatorPrompt(brandbookJson, platform, { news: newsItems, rss: rssItems, competitor_ads: competitorAds }, agent, brand.brand_prompt) },
          ],
        },
      ],
    })
    creator = parseJSON(res.choices[0]?.message?.content ?? '{}')
  } catch (err) {
    console.error('[Creator]', err)
    return NextResponse.json({ error: 'Error al generar copy. Verificá tu OPENAI_API_KEY.' }, { status: 500 })
  }

  // ── Supervisor ────────────────────────────────────────────────────────────
  let supervisor: { score: number; overall_approved: boolean; clause_validations: { rule: string; category: string; passed: boolean; comment: string | null }[]; critical_violations: number; suggested_fix: string | null }
  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini', temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: supervisorSystem() },
        { role: 'user',   content: supervisorPrompt(brandbookJson, creator.generated_copy, creator.hashtags, agent) },
      ],
    })
    supervisor = parseJSON(res.choices[0]?.message?.content ?? '{}')
  } catch {
    supervisor = { score: 5, overall_approved: false, clause_validations: [], critical_violations: 0, suggested_fix: null }
  }

  return NextResponse.json({ creator, supervisor, context: contextSummary, suggested_image_url: suggestedImageUrl })
}
