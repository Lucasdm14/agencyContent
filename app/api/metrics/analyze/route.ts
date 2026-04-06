import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import OpenAI from 'openai'
import { metricsSystem, metricsPrompt } from '@/lib/prompts'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

function parseJSON<T>(raw: string): T {
  const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  return JSON.parse(clean) as T
}

/**
 * Simple CSV parser — handles Meta Business Suite and LinkedIn Analytics exports.
 * Returns a compact string representation of the first N rows for the prompt.
 */
function parseCsvToString(csv: string, maxRows = 40): { summary: string; rowCount: number } {
  const lines = csv.split('\n').filter(l => l.trim())
  if (lines.length < 2) return { summary: 'CSV vacío o inválido', rowCount: 0 }

  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim())
  const rows = lines.slice(1, maxRows + 1)

  const summary = [
    `Columnas: ${headers.join(' | ')}`,
    `Total filas: ${lines.length - 1}`,
    '',
    'Primeras filas de datos:',
    ...rows.slice(0, 15).map(row => {
      const cols = row.split(',').map(c => c.replace(/"/g, '').trim())
      return headers.map((h, i) => `${h}: ${cols[i] ?? ''}`).join(' | ')
    }),
  ].join('\n')

  return { summary, rowCount: lines.length - 1 }
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { csv_content, platform, brand_name } = await req.json() as {
    csv_content: string
    platform: string
    brand_name: string
  }

  if (!csv_content || !platform || !brand_name) {
    return NextResponse.json({ error: 'csv_content, platform y brand_name son requeridos' }, { status: 400 })
  }

  const { summary, rowCount } = parseCsvToString(csv_content)

  if (rowCount < 2) {
    return NextResponse.json(
      { error: 'El CSV tiene menos de 2 filas de datos. Verificá el archivo.' },
      { status: 422 }
    )
  }

  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: metricsSystem() },
        { role: 'user', content: metricsPrompt(summary, platform, brand_name) },
      ],
    })

    const insights = parseJSON<{
      best_performing_posts: { copy_preview: string; metric: string; value: number }[]
      worst_performing_posts: { copy_preview: string; metric: string; value: number }[]
      avg_engagement_rate: number | null
      best_day_of_week: string
      best_time_of_day: string
      top_content_themes: string[]
      recommendations: string[]
      data_quality: 'complete' | 'partial' | 'minimal'
      columns_found: string[]
    }>(res.choices[0]?.message?.content ?? '{}')

    return NextResponse.json({ insights, row_count: rowCount })
  } catch (err) {
    console.error('[MetricsAnalyze]', err)
    return NextResponse.json({ error: 'Error al analizar. Verificá tu OPENAI_API_KEY.' }, { status: 500 })
  }
}
