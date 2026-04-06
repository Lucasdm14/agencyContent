'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, invite_code: inviteCode }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al registrarse'); return }
      router.push('/dashboard/inbox')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-paper flex items-center justify-center p-4">
      <div className="w-full max-w-sm fade-up">
        <div className="mb-10 text-center">
          <h1 className="font-display text-5xl text-ink tracking-tight">AutoCM</h1>
          <p className="text-muted text-sm mt-2">Crear cuenta</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-8 shadow-sm space-y-5">
          <div>
            <label className="block text-xs font-medium text-muted uppercase tracking-widest mb-2">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full border border-border rounded px-3 py-2.5 text-sm bg-paper focus:bg-white outline-none focus:border-accent transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted uppercase tracking-widest mb-2">Contraseña</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
              className="w-full border border-border rounded px-3 py-2.5 text-sm bg-paper focus:bg-white outline-none focus:border-accent transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted uppercase tracking-widest mb-2">
              Código de invitación
            </label>
            <input type="text" value={inviteCode} onChange={e => setInviteCode(e.target.value)} required
              placeholder="Pedíselo a tu admin"
              className="w-full border border-border rounded px-3 py-2.5 text-sm bg-paper focus:bg-white outline-none focus:border-accent transition-colors" />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-accent text-white font-medium py-2.5 rounded text-sm hover:bg-orange-700 transition-colors disabled:opacity-50">
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </form>

        <p className="text-center text-xs text-muted mt-6">
          ¿Ya tenés cuenta? <a href="/auth/login" className="text-accent hover:underline">Ingresar</a>
        </p>
      </div>
    </div>
  )
}
