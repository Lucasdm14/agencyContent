import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import OpenAI from 'openai'
import { competitorAnalysisSystem, competitorAnalysisPrompt } from '@/lib/prompts'
import type { RealContext } from '@/lib/types'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

function parseJSON<T>(raw: string): T {
  const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  return JSON.parse(clean) as T
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { competitor_name, brand_name, real_data } = await req.json() as {
    competitor_name: string
    brand_name: string
    real_data: RealContext
  }

  if (!competitor_name || !brand_name || !real_data) {
    return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 })
  }

  const totalDataPoints =
    real_data.meta_ads.length +
    real_data.youtube_videos.length +
    real_data.news.length +
    real_data.rss.length

  if (totalDataPoints === 0) {
    return NextResponse.json({
      error: 'Sin datos reales para analizar. Configurá al menos un Facebook Page Name, canal de YouTube o keywords.',
    }, { status: 422 })
  }

  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: competitorAnalysisSystem() },
        {
          role: 'user',
          content: competitorAnalysisPrompt(competitor_name, brand_name, {
            meta_ads: real_data.meta_ads,
            youtube_videos: real_data.youtube_videos,
            news: real_data.news,
            rss: real_data.rss,
          }),
        },
      ],
    })

    const insights = parseJSON<{
      active_ads_count: number
      main_messages: string[]
      content_themes: string[]
      posting_cadence: string
      differentiation_opportunities: string[]
      topics_to_avoid: string[]
      recommended_angles: string[]
      confidence: 'high' | 'medium' | 'low'
      data_sources_used: string[]
      disclaimer: string
    }>(res.choices[0]?.message?.content ?? '{}')

    return NextResponse.json({ insights })
  } catch (err) {
    console.error('[CompetitorAnalyze]', err)
    return NextResponse.json({ error: 'Error al analizar. Verificá tu OPENAI_API_KEY.' }, { status: 500 })
  }
}
