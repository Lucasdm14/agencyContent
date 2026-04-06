import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? 'autocm-dev-secret-change-in-prod'
)

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (!pathname.startsWith('/dashboard')) return NextResponse.next()

  const token = request.cookies.get('autocm_token')?.value
  if (!token) return NextResponse.redirect(new URL('/auth/login', request.url))

  try {
    await jwtVerify(token, SECRET)
    return NextResponse.next()
  } catch {
    const res = NextResponse.redirect(new URL('/auth/login', request.url))
    res.cookies.delete('autocm_token')
    return res
  }
}

export const config = { matcher: ['/dashboard/:path*'] }
