import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import OpenAI from 'openai'
import { resolveAgentPrompt, getFormatInsightsText } from '@/lib/prompts'
import type { Brand, Agent, StrategyPostWithCopies, SupervisorReport, FormatInsights } from '@/lib/types'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
function parseJSON<T>(raw: string): T {
  const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  return JSON.parse(clean) as T
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { brand, supervisor, posts, num_days, period_label, format_insights } = await req.json() as {
    brand:           Brand
    supervisor:      Agent
    posts:           StrategyPostWithCopies[]
    num_days:        number
    period_label:    string
    format_insights?: FormatInsights | null
  }
  if (!brand || !supervisor || !posts?.length) {
    return NextResponse.json({ error: 'brand, supervisor y posts son requeridos' }, { status: 400 })
  }

  const strategySummary = posts.map(p => {
    const selectedCopy = p.copies?.find(c => c.index === p.selected_copy_index)
    return {
      day: p.day, platform: p.platform, format: p.format,
      format_rationale: p.format_rationale,
      content_type: p.content_type, topic: p.topic,
      keywords: p.keywords,
      copy_selected: selectedCopy?.copy ?? '(sin copy seleccionado)',
      angle: selectedCopy?.angle ?? '',
      has_script: !!selectedCopy?.script,
    }
  })

  const systemPrompt = resolveAgentPrompt(supervisor, brand, {
    num_days:        String(num_days),
    period:          period_label,
    format_insights: getFormatInsightsText(format_insights),
    strategy_json:   JSON.stringify(strategySummary, null, 2),
  })

  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o', temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Evaluá la estrategia de ${num_days} días para ${period_label}.` },
      ],
    })
    const report = parseJSON<SupervisorReport>(res.choices[0]?.message?.content ?? '{}')
    return NextResponse.json({ report })
  } catch (err) {
    console.error('[Strategy/Review]', err)
    return NextResponse.json({ error: 'Error al generar el reporte.' }, { status: 500 })
  }
}
