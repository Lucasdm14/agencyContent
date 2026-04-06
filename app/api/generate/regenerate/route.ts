import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import OpenAI from 'openai'
import { regeneratePrompt, supervisorSystem, supervisorPrompt } from '@/lib/prompts'
import type { Brand, Agent } from '@/lib/types'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

function parseJSON<T>(raw: string): T {
  const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  return JSON.parse(clean) as T
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { brand, original_copy, instruction, platform, agent } = await req.json() as {
    brand:         Brand
    original_copy: string
    instruction:   string
    platform:      string
    agent?:        Agent | null
  }

  if (!brand || !original_copy || !instruction || !platform) {
    return NextResponse.json({ error: 'Faltan parámetros requeridos' }, { status: 400 })
  }

  const brandbookJson = JSON.stringify(brand.brandbook_rules, null, 2)

  // ── Regenerate ─────────────────────────────────────────────────────────────
  let regenerated: { generated_copy: string; hashtags: string[]; rationale: string }

  try {
    const res = await openai.chat.completions.create({
      model:           'gpt-4o',
      temperature:     0.7,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Sos un copywriter experto. Reescribís copies aplicando instrucciones específicas del PM, sin perder el brandbook${agent ? ` ni el perfil de agente "${agent.name}"` : ''}. Respondé SOLO con JSON válido.`,
        },
        {
          role: 'user',
          content: regeneratePrompt(original_copy, instruction, brandbookJson, platform, agent),
        },
      ],
    })
    regenerated = parseJSON(res.choices[0]?.message?.content ?? '{}')
  } catch (err) {
    console.error('[Regenerate]', err)
    return NextResponse.json(
      { error: 'Error al regenerar. Verificá tu OPENAI_API_KEY.' },
      { status: 500 }
    )
  }

  // ── Re-audit ───────────────────────────────────────────────────────────────
  let supervisor: {
    score:              number
    overall_approved:   boolean
    clause_validations: { rule: string; category: string; passed: boolean; comment: string | null }[]
    critical_violations: number
    suggested_fix:      string | null
  }

  try {
    const res = await openai.chat.completions.create({
      model:           'gpt-4o-mini',
      temperature:     0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: supervisorSystem() },
        {
          role: 'user',
          content: supervisorPrompt(brandbookJson, regenerated.generated_copy, regenerated.hashtags, agent),
        },
      ],
    })
    supervisor = parseJSON(res.choices[0]?.message?.content ?? '{}')
  } catch {
    supervisor = {
      score:               5,
      overall_approved:    false,
      clause_validations:  [],
      critical_violations: 0,
      suggested_fix:       null,
    }
  }

  return NextResponse.json({ regenerated, supervisor })
}
