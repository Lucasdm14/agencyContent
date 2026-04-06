/**
 * POST /api/publish
 * Delegates post to the appropriate social media platform.
 * Currently supports webhook dispatch + Meta Graph API for IG/FB.
 */
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { platform, copy, hashtags, scheduled_at, brand_name, post_id, access_token, page_id } = await req.json() as {
    platform:     string
    copy:         string
    hashtags:     string[]
    scheduled_at: string
    brand_name:   string
    post_id:      string
    access_token?: string
    page_id?:     string
  }

  const fullCopy = [copy, ...(hashtags ?? [])].join('\n')
  const scheduledTs = Math.floor(new Date(scheduled_at).getTime() / 1000)
  const isScheduled  = scheduledTs > Math.floor(Date.now() / 1000) + 600  // > 10 min from now

  // ── Meta (Instagram / Facebook) ────────────────────────────────────────────
  if ((platform === 'instagram' || platform === 'facebook') && access_token && page_id) {
    try {
      if (platform === 'instagram') {
        // Step 1: Create media container
        const containerRes = await fetch(
          `https://graph.facebook.com/v19.0/${page_id}/media`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              caption: fullCopy,
              media_type: 'IMAGE',  // caller should pass image_url for real publishing
              access_token,
            }),
          }
        )
        const container = await containerRes.json()
        if (!containerRes.ok || !container.id) {
          return NextResponse.json({ error: container.error?.message ?? 'Error al crear contenedor en Instagram' }, { status: 502 })
        }
        // Step 2: Publish
        const publishRes = await fetch(
          `https://graph.facebook.com/v19.0/${page_id}/media_publish`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ creation_id: container.id, access_token }),
          }
        )
        const published = await publishRes.json()
        if (!publishRes.ok) {
          return NextResponse.json({ error: published.error?.message ?? 'Error al publicar en Instagram' }, { status: 502 })
        }
        return NextResponse.json({ ok: true, post_id: published.id, scheduled: false })
      }

      if (platform === 'facebook') {
        const params: Record<string, string> = {
          message: fullCopy,
          access_token,
        }
        if (isScheduled) {
          params.published          = 'false'
          params.scheduled_publish_time = String(scheduledTs)
        }
        const res = await fetch(`https://graph.facebook.com/v19.0/${page_id}/feed`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body:   JSON.stringify(params),
        })
        const data = await res.json()
        if (!res.ok) {
          return NextResponse.json({ error: data.error?.message ?? 'Error al publicar en Facebook' }, { status: 502 })
        }
        return NextResponse.json({ ok: true, post_id: data.id, scheduled: isScheduled })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }

  // ── LinkedIn ───────────────────────────────────────────────────────────────
  if (platform === 'linkedin' && access_token) {
    try {
      // Get author URN first
      const meRes  = await fetch('https://api.linkedin.com/v2/me', { headers: { Authorization: `Bearer ${access_token}` } })
      const meData = await meRes.json()
      const authorUrn = `urn:li:person:${meData.id}`

      const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access_token}` },
        body: JSON.stringify({
          author: authorUrn,
          lifecycleState: 'PUBLISHED',
          specificContent: {
            'com.linkedin.ugc.ShareContent': {
              shareCommentary: { text: fullCopy },
              shareMediaCategory: 'NONE',
            },
          },
          visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        return NextResponse.json({ error: err.message ?? 'Error al publicar en LinkedIn' }, { status: 502 })
      }
      return NextResponse.json({ ok: true, scheduled: false })
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Error desconocido' }, { status: 500 })
    }
  }

  // ── No integration available ───────────────────────────────────────────────
  return NextResponse.json({
    error: `No hay integración directa disponible para ${platform}. Configurá un webhook en Redes Sociales.`,
    hint:  'Alternativa: usá Zapier/Make con un webhook para automatizar la publicación.',
  }, { status: 422 })
}
