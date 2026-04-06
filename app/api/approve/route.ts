import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { post, webhook_url } = await req.json()

  if (!post) return NextResponse.json({ error: 'post es requerido' }, { status: 400 })

  // Fire webhook if configured
  if (webhook_url) {
    const payload = {
      image_url: post.image_url,
      final_copy: post.final_copy,
      scheduled_date: post.scheduled_date,
      client_name: post.brand_name,
      platform: post.platform,
      hashtags: post.hashtags ?? [],
      post_id: post.id,
    }
    try {
      const res = await fetch(webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) {
        return NextResponse.json({
          ok: true,
          status: 'approved',
          warning: `Webhook respondió con error ${res.status}. El post fue aprobado localmente.`,
        })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      return NextResponse.json({
        ok: true,
        status: 'approved',
        warning: `No se pudo enviar el webhook: ${msg}. El post fue aprobado localmente.`,
      })
    }
    return NextResponse.json({ ok: true, status: 'webhook_sent' })
  }

  return NextResponse.json({ ok: true, status: 'approved', warning: 'No hay webhook configurado para este cliente.' })
}
