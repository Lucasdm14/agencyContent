import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import OpenAI from 'openai'
import { resolveAgentPrompt } from '@/lib/prompts'
import type { Brand, Agent, StrategyPostPlan, CopyOption } from '@/lib/types'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
function parseJSON<T>(raw: string): T {
  const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  return JSON.parse(clean) as T
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { brand, copy_agent, post } = await req.json() as {
    brand:      Brand
    copy_agent: Agent
    post:       StrategyPostPlan
  }
  if (!brand || !copy_agent || !post) {
    return NextResponse.json({ error: 'brand, copy_agent y post son requeridos' }, { status: 400 })
  }

  const needsScript = ['reel', 'story', 'video'].includes(post.format)

  const systemPrompt = resolveAgentPrompt(copy_agent, brand, {
    day:             String(post.day),
    platform:        post.platform,
    format:          post.format,
    content_type:    post.content_type,
    topic:           post.topic,
    keywords:        (post.keywords ?? []).join(', '),
    hook:            post.hook_suggestion,
    visual_direction: post.visual_direction,
  })

  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o', temperature: 0.85,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Generá 3 versiones de copy para el día ${post.day}: "${post.topic}" en ${post.platform} (formato: ${post.format}).${needsScript ? ' Incluí guión completo con escenas para cada versión.' : ''}`,
        },
      ],
    })
    const result = parseJSON<{ copies: CopyOption[] }>(res.choices[0]?.message?.content ?? '{}')
    const copies = (result.copies ?? []).slice(0, 3).map(c => ({
      ...c,
      keywords: c.keywords ?? post.keywords ?? [],
    }))
    return NextResponse.json({ copies, post_day: post.day })
  } catch (err) {
    console.error('[Strategy/Copies]', err)
    return NextResponse.json({ error: 'Error al generar copies.', post_day: post.day }, { status: 500 })
  }
}
