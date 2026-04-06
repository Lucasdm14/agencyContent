import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { fetchInstagramAccount, fetchMetaAdLibraryApify } from '@/lib/free-apis/apify'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

function parseJSON<T>(raw: string): T {
  const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  return JSON.parse(clean) as T
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json() as {
    type:        'account' | 'meta_ads' | 'ai_analysis'
    username?:   string
    brand_id?:   string
    page_name?:  string
    period_days?: number
    account_metrics?: object
  }

  if (!process.env.APIFY_TOKEN) {
    return NextResponse.json(
      { error: 'APIFY_TOKEN no configurado. Agregalo en las variables de entorno de Vercel.' },
      { status: 422 }
    )
  }

  // ── Full account (posts + profile + format insights) ──────────────────────
  if (body.type === 'account') {
    if (!body.username) return NextResponse.json({ error: 'username requerido' }, { status: 400 })

    const result = await fetchInstagramAccount(
      body.username.replace('@', ''),
      body.brand_id ?? '',
      body.period_days ?? 30
    )

    // FIX: propagar error específico de Apify al cliente
    if (!result) {
      return NextResponse.json(
        { error: `No se encontraron datos para @${body.username}. Verificá que la cuenta sea pública y que el handle sea correcto.` },
        { status: 404 }
      )
    }
    if ('apify_error' in result) {
      return NextResponse.json(
        { error: `Error de Apify: ${result.apify_error}` },
        { status: 502 }
      )
    }
    return NextResponse.json({ metrics: result })
  }

  // ── Meta Ads ──────────────────────────────────────────────────────────────
  if (body.type === 'meta_ads') {
    const name = body.page_name ?? body.username
    if (!name) return NextResponse.json({ error: 'page_name requerido' }, { status: 400 })
    const data = await fetchMetaAdLibraryApify(name)
    return NextResponse.json({ data })
  }

  // ── AI Analysis ──────────────────────────────────────────────────────────
  if (body.type === 'ai_analysis') {
    const metrics = body.account_metrics as {
      profile: { username: string; followersCount: number }
      top_posts: { caption: string; likesCount: number; videoViewCount?: number; type: string; er?: number }[]
      format_insights: { best_format: string; format_stats: object; top_hashtags: string[] }
    }
    if (!metrics) return NextResponse.json({ error: 'account_metrics requerido' }, { status: 400 })

    const summary = {
      username:      metrics.profile?.username,
      followers:     metrics.profile?.followersCount,
      best_format:   metrics.format_insights?.best_format,
      format_stats:  metrics.format_insights?.format_stats,
      top_hashtags:  metrics.format_insights?.top_hashtags?.slice(0, 10),
      top_captions:  (metrics.top_posts ?? []).slice(0, 5).map(p => ({
        caption: p.caption?.slice(0, 200),
        likes:   p.likesCount,
        views:   p.videoViewCount,
        type:    p.type,
        er:      p.er,
      })),
    }

    try {
      const res = await openai.chat.completions.create({
        model: 'gpt-4o-mini', temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'Sos un analista experto en contenido de Instagram. Analizás datos reales y extraés insights accionables. Solo trabajás con los datos provistos. Respondé SOLO con JSON.',
          },
          {
            role: 'user',
            content: `Analizá esta cuenta de Instagram:\n${JSON.stringify(summary, null, 2)}\n\nRespondé con:\n{\n  "top_hook_patterns": ["patrón detectado"],\n  "best_formats": ["formato con justificación"],\n  "content_themes": ["tema recurrente"],\n  "posting_frequency": "frecuencia detectada",\n  "engagement_insights": ["insight de engagement"],\n  "recommendations": ["recomendación concreta"],\n  "strengths": ["fortaleza del contenido"],\n  "weaknesses": ["área de mejora"]\n}`,
          },
        ],
      })
      const analysis = parseJSON<object>(res.choices[0]?.message?.content ?? '{}')
      return NextResponse.json({ ai_analysis: { ...analysis, generated_at: new Date().toISOString() } })
    } catch (err) {
      console.error('[AI Analysis]', err)
      return NextResponse.json({ error: 'Error al generar análisis IA' }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'type inválido' }, { status: 400 })
}
