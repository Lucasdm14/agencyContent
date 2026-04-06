/**
 * Agents are stored client-side in localStorage (same as brands/posts).
 * This route only provides server-side validation for agent data.
 * The actual CRUD happens via storage.ts in the browser.
 */
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import type { Agent } from '@/lib/types'

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const agent = await req.json() as Partial<Agent>

  if (!agent.name?.trim())     return NextResponse.json({ error: 'El nombre del agente es requerido' }, { status: 400 })
  if (!agent.brand_id?.trim()) return NextResponse.json({ error: 'brand_id es requerido' }, { status: 400 })
  if (!agent.segment?.trim())  return NextResponse.json({ error: 'El segmento objetivo es requerido' }, { status: 400 })

  return NextResponse.json({ ok: true })
}
