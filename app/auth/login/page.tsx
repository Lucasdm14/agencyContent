'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Credenciales incorrectas'); return }
      router.push('/dashboard/strategy'); router.refresh()
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#0d0d0d' }}>
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-[#5b6ef5] flex items-center justify-center">
            <Sparkles size={16} className="text-white" />
          </div>
          <span className="font-semibold text-lg text-white">AgencyCopilot</span>
        </div>
        <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-6">
          <h1 className="text-base font-semibold text-white mb-1">Iniciá sesión</h1>
          <p className="text-sm text-[#666] mb-6">Plataforma de contenido con IA</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-[#666] mb-1.5">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="pm@agencia.com" className="input" />
            </div>
            <div>
              <label className="block text-xs text-[#666] mb-1.5">Contraseña</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" className="input" />
            </div>
            {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">{error}</p>}
            <button type="submit" disabled={loading} className="btn btn-primary w-full justify-center">
              {loading ? <><Loader2 size={14} className="animate-spin" /> Ingresando...</> : 'Ingresar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
