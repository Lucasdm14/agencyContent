import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? 'autocm-dev-secret-change-in-prod'
)

/**
 * FIX: Was a broken module-level constant that crashed on cold start.
 * Now a function so env vars are read at call time, not import time.
 *
 * Configure via USERS_JSON={"email":"pass","other@a.com":"pass2"}
 * or ADMIN_EMAIL + ADMIN_PASSWORD for a single admin user.
 */
function getUsers(): Record<string, string> {
  if (process.env.USERS_JSON) {
    try {
      return JSON.parse(process.env.USERS_JSON) as Record<string, string>
    } catch {
      console.warn('[auth] USERS_JSON is not valid JSON — falling back to admin credentials')
    }
  }
  const email    = process.env.ADMIN_EMAIL    ?? 'admin@agency.com'
  const password = process.env.ADMIN_PASSWORD ?? 'admin123'
  return { [email.toLowerCase()]: password }
}

export function validateCredentials(email: string, password: string): boolean {
  const users  = getUsers()
  const stored = users[email.toLowerCase()]
  return stored !== undefined && stored === password
}

export async function createToken(email: string): Promise<string> {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(SECRET)
}

export async function verifyToken(token: string): Promise<{ email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return { email: payload.email as string }
  } catch {
    return null
  }
}

export async function getSession(): Promise<{ email: string } | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('autocm_token')?.value
  if (!token) return null
  return verifyToken(token)
}
