/**
 * POST /api/brand/assets
 * Fetch images from a Google Drive public folder.
 */
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { listDriveFolderImages } from '@/lib/free-apis/drive'

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { folder_url } = await req.json() as { folder_url: string }
  if (!folder_url) return NextResponse.json({ error: 'folder_url requerido' }, { status: 400 })

  if (!process.env.GOOGLE_API_KEY) {
    return NextResponse.json(
      { error: 'GOOGLE_API_KEY no configurado. Agregalo en las variables de entorno de Vercel (es la misma key que YouTube).' },
      { status: 422 }
    )
  }

  const files = await listDriveFolderImages(folder_url)
  return NextResponse.json({ files, count: files.length })
}
