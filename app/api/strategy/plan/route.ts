import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import OpenAI from 'openai'
import {
  resolveAgentPrompt, getFormatInsightsText,
  BASE_ESTRATEGA_PROMPT, resolveTemplate, buildBaseVars,
} from '@/lib/prompts'
import type { Brand, Agent, StrategyPostPlan, FormatInsights } from '@/lib/types'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

function parseJSON<T>(raw: string): T {
  const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  return JSON.parse(clean) as T
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { brand, estratega, num_days, period_label, selected_platforms, format_insights } = await req.json() as {
    brand:               Brand
    estratega:           Agent
    num_days:            number
    period_label:        string
    selected_platforms?: string[]
    format_insights?:    FormatInsights | null
  }

  if (!brand || !estratega || !num_days || !period_label) {
    return NextResponse.json({ error: 'brand, estratega, num_days y period_label son requeridos' }, { status: 400 })
  }

  const platforms = selected_platforms?.length ? selected_platforms : ['instagram', 'facebook', 'linkedin']

  // FIX: si el custom_system_prompt está vacío, usar el prompt base del rol
  const templateSource = estratega.custom_system_prompt?.trim() || BASE_ESTRATEGA_PROMPT
  const extraVars = {
    num_days:        String(num_days),
    period:          period_label,
    platforms:       platforms.join(', '),
    format_insights: getFormatInsightsText(format_insights),
  }

  const systemPrompt = templateSource === estratega.custom_system_prompt
    ? resolveAgentPrompt(estratega, brand, extraVars)
    : resolveTemplate(BASE_ESTRATEGA_PROMPT, { ...buildBaseVars(brand, estratega), ...extraVars })

  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o', temperature: 0.6,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: `Creá el plan de ${num_days} días para ${period_label}. Redes: ${platforms.join(', ')}. ${format_insights ? `El mejor formato según métricas es ${format_insights.best_format}.` : ''}` },
      ],
    })

    // FIX: propagar error real si GPT no devuelve contenido
    const content = res.choices[0]?.message?.content
    if (!content) {
      return NextResponse.json({ error: 'GPT no generó respuesta. Revisá la API key de OpenAI.' }, { status: 500 })
    }

    const plan = parseJSON<{ pillars: string[]; strategy_rationale: string; posts: StrategyPostPlan[] }>(content)
    const posts = (plan.posts ?? []).map(p => ({
      ...p,
      keywords: p.keywords ?? [],
      format:   p.format ?? 'post',
      format_rationale: p.format_rationale ?? '',
    }))
    return NextResponse.json({ ...plan, posts })
  } catch (err) {
    // FIX: propagar el mensaje de error real al cliente
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Strategy/Plan]', err)
    return NextResponse.json({ error: `Error al generar el plan: ${msg}` }, { status: 500 })
  }
}
