'use client'

import { useState, useEffect } from 'react'
import {
  Inbox, CheckCircle2, AlertTriangle, XCircle,
  Loader2, ChevronDown, ChevronUp, Hash, Lightbulb, RefreshCw, Database, Bot,
} from 'lucide-react'
import type { Post, ClauseValidation, Agent } from '@/lib/types'
import { getPosts, upsertPost, getBrands, getAgents } from '@/lib/storage'
import { useBrand } from '@/lib/hooks/useBrand'

function ScoreBar({ score }: { score: number }) {
  const color = score >= 8 ? 'bg-emerald-500' : score >= 6 ? 'bg-amber-400' : 'bg-red-500'
  const text  = score >= 8 ? 'text-emerald-600' : score >= 6 ? 'text-amber-600' : 'text-red-600'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-zinc-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${score * 10}%` }} />
      </div>
      <span className={`text-xs font-mono font-bold ${text}`}>{score}/10</span>
    </div>
  )
}

function PostCard({ post, onUpdate }: { post: Post; onUpdate: (p: Post) => void }) {
  const [copy,             setCopy]             = useState(post.final_copy || post.generated_copy)
  const [date,             setDate]             = useState(post.scheduled_date || '')
  const [showValidation,   setShowValidation]   = useState(post.critical_violations > 2)
  const [showReject,       setShowReject]       = useState(false)
  const [rejectReason,     setRejectReason]     = useState('')
  const [loading,          setLoading]          = useState(false)
  const [regenerating,     setRegenerating]     = useState(false)
  const [instruction,      setInstruction]      = useState('')
  const [showRegenerate,   setShowRegenerate]   = useState(false)
  const [msg,              setMsg]              = useState('')
  const [score,            setScore]            = useState(post.supervisor_score)
  const [validations,      setValidations]      = useState(post.supervisor_validation)
  const [violations,       setViolations]       = useState(post.critical_violations)
  const [suggestedFix,     setSuggestedFix]     = useState(post.suggested_fix)
  const [hashtags,         setHashtags]         = useState(post.hashtags)

  const getBrand = () => getBrands().find(b => b.id === post.brand_id)
  const getAgent = (): Agent | null => {
    if (!post.agent_id) return null
    return getAgents().find(a => a.id === post.agent_id) ?? null
  }

  async function approve() {
    if (!date) { setMsg('Seleccioná una fecha de publicación'); return }
    setLoading(true); setMsg('')
    const brand = getBrand()
    const updated = { ...post, final_copy: copy, hashtags, scheduled_date: date, status: 'approved' as const }
    try {
      const res = await fetch('/api/approve', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post: updated, webhook_url: brand?.webhook_url ?? '' }),
      })
      const data = await res.json()
      const saved = { ...updated, status: (data.status === 'webhook_sent' ? 'webhook_sent' : 'approved') as Post['status'] }
      upsertPost(saved); onUpdate(saved)
      if (data.warning) setMsg(`⚠️ ${data.warning}`)
    } catch { setMsg('Error de red.') }
    finally { setLoading(false) }
  }

  async function regenerate() {
    if (!instruction.trim()) return
    setRegenerating(true); setMsg('')
    const brand = getBrand()
    if (!brand) { setMsg('Marca no encontrada'); setRegenerating(false); return }
    try {
      const res = await fetch('/api/generate/regenerate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand, original_copy: copy, instruction: instruction.trim(), platform: post.platform, agent: getAgent() }),
      })
      const data = await res.json()
      if (!res.ok) { setMsg(data.error ?? 'Error'); return }
      setCopy(data.regenerated.generated_copy)
      setHashtags(data.regenerated.hashtags ?? [])
      setScore(data.supervisor.score)
      setValidations(data.supervisor.clause_validations)
      setViolations(data.supervisor.critical_violations)
      setSuggestedFix(data.supervisor.suggested_fix)
      setInstruction(''); setShowRegenerate(false)
    } finally { setRegenerating(false) }
  }

  function reject() {
    const updated = { ...post, status: 'rejected' as const }
    upsertPost(updated); onUpdate(updated)
  }

  const isApproved = post.status === 'approved' || post.status === 'webhook_sent'

  return (
    <div className={`bg-white border rounded-xl overflow-hidden transition-all shadow-sm
      ${violations > 2 ? 'border-amber-300' : 'border-zinc-200'}
      ${isApproved ? 'opacity-60' : 'hover:border-zinc-300'}`}>

      {violations > 2 && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2">
          <AlertTriangle size={13} className="text-amber-500" />
          <span className="text-xs font-medium text-amber-700">{violations} violación{violations !== 1 ? 'es' : ''} al brandbook</span>
        </div>
      )}
      {post.agent_name && (
        <div className="bg-blue-50 border-b border-blue-100 px-4 py-1.5 flex items-center gap-1.5">
          <Bot size={11} className="text-blue-500" />
          <span className="text-xs text-blue-700">Agente: <strong>{post.agent_name}</strong></span>
        </div>
      )}
      {post.context_used && post.context_used.sources.length > 0 && (
        <div className="bg-zinc-50 border-b border-zinc-100 px-4 py-1.5 flex items-center gap-1.5">
          <Database size={11} className="text-zinc-400" />
          <span className="text-xs text-zinc-500">Datos reales: {post.context_used.sources.join(', ')}</span>
        </div>
      )}

      <div className="grid grid-cols-2 divide-x divide-zinc-100">
        {/* Image */}
        <div className="relative bg-zinc-100 min-h-60">
          {post.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.image_url} alt="post" className="absolute inset-0 w-full h-full object-cover" />
          )}
          <div className="absolute top-2 left-2 flex gap-1.5">
            <span className="text-xs bg-black/60 text-white px-2 py-0.5 rounded font-mono">{post.platform}</span>
            <span className="text-xs bg-black/60 text-white px-2 py-0.5 rounded">{post.brand_name}</span>
          </div>
          {isApproved && (
            <div className="absolute bottom-2 left-2">
              <span className="text-xs bg-emerald-600 text-white px-2 py-0.5 rounded">
                {post.status === 'webhook_sent' ? '✓ Enviado' : '✓ Aprobado'}
              </span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="p-4 flex flex-col gap-3">
          {/* Score */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-2xs font-medium text-zinc-500 uppercase tracking-wider">Score supervisor</span>
              <button onClick={() => setShowValidation(v => !v)}
                className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
                Cláusulas {showValidation ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              </button>
            </div>
            <ScoreBar score={score} />
          </div>

          {showValidation && (
            <div className="bg-zinc-50 rounded-lg p-3 space-y-1.5 max-h-36 overflow-y-auto">
              {validations.map((v: ClauseValidation, i: number) => (
                <div key={i} className="flex items-start gap-1.5 text-xs">
                  {v.passed
                    ? <CheckCircle2 size={11} className="text-emerald-500 mt-0.5 shrink-0" />
                    : <XCircle     size={11} className="text-red-500   mt-0.5 shrink-0" />}
                  <div>
                    <span className={v.passed ? 'text-zinc-500' : 'text-red-700 font-medium'}>{v.rule}</span>
                    {v.comment && <p className="text-zinc-400 mt-0.5">{v.comment}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {suggestedFix && violations > 0 && (
            <div className="bg-blue-50 rounded-lg p-2.5 flex gap-2">
              <Lightbulb size={12} className="text-blue-500 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-700">{suggestedFix}</p>
            </div>
          )}

          {/* Copy editor */}
          <div>
            <label className="text-2xs font-medium text-zinc-500 uppercase tracking-wider block mb-1.5">Copy</label>
            <textarea value={copy} onChange={e => setCopy(e.target.value)} disabled={isApproved} rows={4}
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm resize-none bg-white outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/20 transition disabled:opacity-60 disabled:bg-zinc-50" />
          </div>

          {hashtags?.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              <Hash size={11} className="text-zinc-400" />
              {hashtags.map((t, i) => (
                <span key={i} className="text-xs font-mono text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded">{t}</span>
              ))}
            </div>
          )}

          {post.ai_rationale && (
            <p className="text-xs text-zinc-400 italic border-t border-zinc-100 pt-2">💡 {post.ai_rationale}</p>
          )}

          {/* Regenerate */}
          {!isApproved && (
            <div>
              {!showRegenerate ? (
                <button onClick={() => setShowRegenerate(true)}
                  className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800 border border-zinc-200 rounded-lg px-3 py-1.5 hover:bg-zinc-50 transition w-full justify-center">
                  <RefreshCw size={11} /> Regenerar con instrucción
                </button>
              ) : (
                <div className="space-y-2">
                  <input value={instruction} onChange={e => setInstruction(e.target.value)}
                    placeholder='"más corto", "sin emojis", "más formal"'
                    onKeyDown={e => e.key === 'Enter' && regenerate()}
                    className="w-full border border-zinc-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/20" />
                  <div className="flex gap-2">
                    <button onClick={() => { setShowRegenerate(false); setInstruction('') }}
                      className="flex-1 text-xs border border-zinc-200 rounded-lg py-1.5 hover:bg-zinc-50 transition text-zinc-600">Cancelar</button>
                    <button onClick={regenerate} disabled={regenerating || !instruction.trim()}
                      className="flex-1 text-xs bg-zinc-900 text-white rounded-lg py-1.5 hover:bg-zinc-700 transition disabled:opacity-40 flex items-center justify-center gap-1">
                      {regenerating ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                      Regenerar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Date */}
          {!isApproved && (
            <div>
              <label className="text-2xs font-medium text-zinc-500 uppercase tracking-wider block mb-1.5">Fecha de publicación</label>
              <input type="datetime-local" value={date} onChange={e => setDate(e.target.value)}
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/20 transition" />
            </div>
          )}

          {msg && <p className="text-xs rounded-lg px-3 py-2 bg-amber-50 border border-amber-200 text-amber-700">{msg}</p>}

          {/* Actions */}
          {!isApproved && !showReject && (
            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowReject(true)} disabled={loading}
                className="flex items-center gap-1 text-xs border border-red-200 text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg transition">
                <XCircle size={12} /> Rechazar
              </button>
              <button onClick={approve} disabled={loading}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-zinc-900 text-white hover:bg-zinc-700 px-3 py-2 rounded-lg transition disabled:opacity-40">
                {loading ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                Aprobar
              </button>
            </div>
          )}

          {showReject && (
            <div className="space-y-2">
              <input value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                placeholder="Razón (opcional)"
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
              <div className="flex gap-2">
                <button onClick={() => setShowReject(false)} className="flex-1 text-xs border border-zinc-200 rounded-lg py-2 hover:bg-zinc-50 transition">Cancelar</button>
                <button onClick={reject} className="flex-1 text-xs bg-red-600 text-white rounded-lg py-2 hover:bg-red-700 transition">Confirmar</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function InboxPage() {
  const { brand } = useBrand()
  const [posts,  setPosts]  = useState<Post[]>([])
  const [filter, setFilter] = useState<'pending' | 'approved' | 'all'>('pending')

  useEffect(() => {
    const all = getPosts().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    setPosts(brand ? all.filter(p => p.brand_id === brand.id) : all)
  }, [brand?.id])

  const filtered = posts.filter(p => {
    if (filter === 'pending')  return p.status === 'pm_review' || p.status === 'supervisor_review'
    if (filter === 'approved') return p.status === 'approved'  || p.status === 'webhook_sent'
    return true
  })
  const pendingCount = posts.filter(p => p.status === 'pm_review' || p.status === 'supervisor_review').length

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <Inbox size={20} className="text-blue-600" />
        <h1 className="text-xl font-semibold text-zinc-900">Bandeja de Aprobación</h1>
        {pendingCount > 0 && (
          <span className="bg-blue-600 text-white text-xs font-mono px-2 py-0.5 rounded-full">{pendingCount}</span>
        )}
      </div>

      <div className="flex gap-1 mb-6 bg-white border border-zinc-200 rounded-lg p-1 w-fit shadow-sm">
        {(['pending', 'approved', 'all'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-1.5 text-sm rounded-md transition-all font-medium ${filter === f ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-900'}`}>
            {f === 'pending' ? 'Pendientes' : f === 'approved' ? 'Aprobados' : 'Todos'}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-zinc-400">
          <CheckCircle2 size={48} className="text-emerald-400 mb-4 opacity-50" />
          <p className="text-xl font-medium text-zinc-300">{filter === 'pending' ? 'Todo al día' : 'Sin posts'}</p>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {filtered.map(p => <PostCard key={p.id} post={p} onUpdate={u => setPosts(prev => prev.map(x => x.id === u.id ? u : x))} />)}
        </div>
      )}
    </div>
  )
}
