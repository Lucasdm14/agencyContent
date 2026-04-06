import { NextResponse } from 'next/server'
import { createToken } from '@/lib/auth'
import { cookies } from 'next/headers'

// Users stored as env var: USERS_JSON = {"email@a.com":"pass123","other@a.com":"pass456"}
// Fallback: single admin user from ADMIN_EMAIL + ADMIN_PASSWORD
function getUsers(): Record<string, string> {
  if (process.env.USERS_JSON) {
    try { return JSON.parse(process.env.USERS_JSON) } catch {}
  }
  const email = process.env.ADMIN_EMAIL ?? 'admin@agency.com'
  const password = process.env.ADMIN_PASSWORD ?? 'admin123'
  return { [email]: password }
}

// POST /api/auth — login
export async function POST(req: Request) {
  const { email, password } = await req.json()
  const users = getUsers()
  const stored = users[email?.toLowerCase()]

  if (!stored || stored !== password) {
    return NextResponse.json({ error: 'Email o contraseña incorrectos' }, { status: 401 })
  }

  const token = await createToken(email.toLowerCase())
  const cookieStore = await cookies()
  cookieStore.set('autocm_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  })

  return NextResponse.json({ ok: true })
}

// PUT /api/auth — register (requires invite code)
export async function PUT(req: Request) {
  const { email, password, invite_code } = await req.json()
  const validCode = process.env.INVITE_CODE ?? 'autocm2024'

  if (invite_code !== validCode) {
    return NextResponse.json({ error: 'Código de invitación inválido' }, { status: 403 })
  }
  if (!email || !password || password.length < 6) {
    return NextResponse.json({ error: 'Email y contraseña (mín. 6 caracteres) requeridos' }, { status: 400 })
  }

  // In this no-DB version, we just issue a token — user exists as long as they have the token
  const token = await createToken(email.toLowerCase())
  const cookieStore = await cookies()
  cookieStore.set('autocm_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })

  return NextResponse.json({ ok: true })
}

// DELETE /api/auth — logout
export async function DELETE() {
  const cookieStore = await cookies()
  cookieStore.delete('autocm_token')
  return NextResponse.json({ ok: true })
}
