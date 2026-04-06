/**
 * POST /api/metrics/format-insights
 * Builds FormatInsights from Apify data OR from manual answers.
 * Used by Step 0 of the strategy flow.
 */
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { fetchInstagramAccount } from '@/lib/free-apis/apify'
import type { FormatInsights, ContentFormat } from '@/lib/types'

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json() as {
    source:        'apify' | 'manual'
    brand_id:      string
    username?:     string
    period_days?:  number
    // manual fields
    manual?: {
      followers_count:    number
      best_format:        ContentFormat
      avg_likes:          number
      avg_er:             number
      best_posting_hour:  number
      top_hashtags:       string[]
    }
  }

  // ── From Apify ────────────────────────────────────────────────────────────
  if (body.source === 'apify') {
    if (!body.username) return NextResponse.json({ error: 'username requerido' }, { status: 400 })
    if (!process.env.APIFY_TOKEN) {
      return NextResponse.json({ error: 'APIFY_TOKEN no configurado' }, { status: 422 })
    }
    const result = await fetchInstagramAccount(body.username, body.brand_id, body.period_days ?? 30)
    if (!result) {
      return NextResponse.json(
        { error: `No se encontraron datos para @${body.username}` }, { status: 404 }
      )
    }
    if ('apify_error' in result) {
      return NextResponse.json({ error: `Error de Apify: ${result.apify_error}` }, { status: 502 })
    }
    return NextResponse.json({ format_insights: result.format_insights })
  }

  // ── From manual answers ───────────────────────────────────────────────────
  if (body.source === 'manual' && body.manual) {
    const m = body.manual
    const fi: FormatInsights = {
      brand_id:          body.brand_id,
      instagram_handle:  body.username ?? '',
      followers_count:   m.followers_count,
      posts_count:       0,
      source:            'manual',
      best_format:       m.best_format,
      format_stats: {
        [m.best_format]: {
          count:     1,
          avg_er:    m.avg_er,
          avg_likes: m.avg_likes,
          avg_views: null,
        },
      },
      best_posting_hours: [m.best_posting_hour],
      top_hashtags:       m.top_hashtags,
      avg_caption_length: 0,
      generated_at:       new Date().toISOString(),
    }
    return NextResponse.json({ format_insights: fi })
  }

  return NextResponse.json({ error: 'source inválido' }, { status: 400 })
}
