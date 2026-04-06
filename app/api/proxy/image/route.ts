/**
 * GET /api/proxy/image?url=ENCODED_URL
 * Proxy para imágenes de Instagram CDN que bloquean carga directa desde el browser.
 */
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

export async function GET(req: Request) {
  const session = await getSession()
  if (!session) return new Response('No autorizado', { status: 401 })

  const { searchParams } = new URL(req.url)
  const imageUrl = searchParams.get('url')
  if (!imageUrl) return new Response('url requerida', { status: 400 })

  const allowed = ['cdninstagram.com', 'fbcdn.net', 'scontent', 'lookaside.fbsbx.com']
  if (!allowed.some(d => imageUrl.includes(d))) {
    return new Response('Dominio no permitido', { status: 403 })
  }

  try {
    const res = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)',
        'Accept':     'image/webp,image/apng,image/*,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return new Response('Error al obtener imagen', { status: res.status })

    const contentType = res.headers.get('content-type') ?? 'image/jpeg'
    const buffer      = await res.arrayBuffer()

    return new Response(buffer, {
      headers: {
        'Content-Type':                contentType,
        'Cache-Control':               'public, max-age=3600, s-maxage=3600',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (err) {
    console.error('[ImageProxy]', err)
    return new Response('Error de red', { status: 500 })
  }
}
