'use client'

import { useState, useEffect } from 'react'
import {
  Sparkles, Loader2, AlertCircle, CheckCircle2, RotateCcw,
  ChevronRight, ChevronLeft, ArrowRight, X, Megaphone,
  ThumbsUp, ThumbsDown, Clock, Calendar, Hash, FileText,
} from 'lucide-react'
import type {
  Brand, Agent, StrategySession, StrategyPostWithCopies,
  CopyOption, Campaign, CampaignPost, FormatInsights, ContentFormat,
} from '@/lib/types'
import {
  getBrands, getBrandAgentsByRole, getStrategySession,
  saveStrategySession, clearStrategySession, upsertCampaign,
  getSelectedBrandId, getFormatInsights, saveFormatInsights,
} from '@/lib/storage'

// ─── Format badge ─────────────────────────────────────────────────────────────

function FormatBadge({ format }: { format: string }) {
  const cls = `badge-${format.toLowerCase()}` as string
  return <span className={`text-2xs px-2 py-0.5 rounded-full border font-medium uppercase ${cls}`}>{format}</span>
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'text-pink-400 bg-pink-500/10 border-pink-500/20',
  facebook:  'text-blue-400 bg-blue-500/10 border-blue-500/20',
  linkedin:  'text-sky-400 bg-sky-500/10 border-sky-500/20',
  twitter:   'text-zinc-300 bg-zinc-500/10 border-zinc-500/20',
  tiktok:    'text-red-400 bg-red-500/10 border-red-500/20',
  youtube:   'text-red-500 bg-red-500/10 border-red-500/20',
}

const PLATFORMS = ['instagram','facebook','linkedin','twitter','tiktok','youtube'] as const
type Platform = typeof PLATFORMS[number]

const STEPS = ['Métricas', 'Configurar', 'Plan', 'Copies', 'Supervisor']

// ─── Step 0 — Métricas (auto) ─────────────────────────────────────────────────

function Step0Metrics({ brand, onNext }: {
  brand: Brand
  onNext: (fi: FormatInsights) => void
}) {
  const [status,  setStatus]  = useState<'idle' | 'loading' | 'done' | 'manual'>('idle')
  const [fi,      setFi]      = useState<FormatInsights | null>(null)
  const [error,   setError]   = useState('')
  // Manual form
  const [followers, setFollowers] = useState('')
  const [bestFmt,   setBestFmt]   = useState<ContentFormat>('reel')
  const [avgLikes,  setAvgLikes]  = useState('')
  const [avgER,     setAvgER]     = useState('')
  const [bestHour,  setBestHour]  = useState('18')
  const [topTags,   setTopTags]   = useState('')

  const handle = brand.instagram_handle?.replace('@', '')

  useEffect(() => {
    // Try cached first
    const cached = getFormatInsights(brand.id)
    if (cached) { setFi(cached); setStatus('done'); return }
    // Auto-load if has handle + APIFY
    if (handle) loadApify()
  }, [brand.id, handle])

  async function loadApify() {
    setStatus('loading'); setError('')
    try {
      const res = await fetch('/api/metrics/format-insights', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'apify', brand_id: brand.id, username: handle }),
      })
      const d = await res.json()
      if (!res.ok) { setError(d.error ?? 'Error'); setStatus('manual'); return }
      saveFormatInsights(d.format_insights)
      setFi(d.format_insights); setStatus('done')
    } catch { setError('Error de red'); setStatus('manual') }
  }

  async function submitManual() {
    const res = await fetch('/api/metrics/format-insights', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'manual', brand_id: brand.id, username: handle,
        manual: {
          followers_count:   parseInt(followers) || 0,
          best_format:       bestFmt,
          avg_likes:         parseInt(avgLikes) || 0,
          avg_er:            parseFloat(avgER) || 0,
          best_posting_hour: parseInt(bestHour) || 18,
          top_hashtags:      topTags.split(',').map(t => t.trim()).filter(Boolean),
        },
      }),
    })
    const d = await res.json()
    if (res.ok) { saveFormatInsights(d.format_insights); setFi(d.format_insights); setStatus('done') }
  }

  if (status === 'loading') return (
    <div className="flex flex-col items-center gap-4 py-20">
      <Loader2 size={28} className="animate-spin text-[#5b6ef5]" />
      <p className="text-white font-medium">Cargando métricas de @{handle}...</p>
      <p className="text-xs text-[#666]">Apify tarda ~30-60 segundos · Los resultados se guardan para futuras estrategias</p>
    </div>
  )

  if (status === 'done' && fi) return (
    <div className="max-w-xl space-y-5 fade-up">
      <div className="bg-[#5b6ef5]/10 border border-[#5b6ef5]/25 rounded-xl p-4 flex items-start gap-3">
        <CheckCircle2 size={16} className="text-[#5b6ef5] shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-white">Métricas cargadas {fi.source === 'apify' ? 'desde Apify' : 'manualmente'}</p>
          <p className="text-xs text-[#666] mt-0.5">
            {fi.posts_count > 0 ? `${fi.posts_count} posts analizados · ` : ''}
            Mejor formato: <span className="text-[#5b6ef5] font-semibold">{fi.best_format.toUpperCase()}</span>
          </p>
        </div>
      </div>

      {/* Format stats */}
      <div className="grid gap-2">
        {Object.entries(fi.format_stats ?? {}).map(([fmt, stats]) => {
          if (!stats) return null
          return (
            <div key={fmt} className="bg-[#161616] border border-[#2a2a2a] rounded-lg px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FormatBadge format={fmt === 'Video' ? 'reel' : fmt === 'Sidecar' ? 'carousel' : 'post'} />
                <span className="text-xs text-[#a1a1a1]">{stats.count} posts</span>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold font-mono text-white">{stats.avg_er}% ER</p>
                <p className="text-2xs text-[#444]">{stats.avg_likes.toLocaleString()} likes avg</p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex gap-2">
        <button onClick={loadApify} className="btn btn-secondary text-xs"><RotateCcw size={11} /> Recargar</button>
        <button onClick={() => onNext(fi)} className="btn btn-primary">
          Continuar con estas métricas <ChevronRight size={15} />
        </button>
      </div>
    </div>
  )

  // Manual form
  return (
    <div className="max-w-xl space-y-5">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex gap-2">
          <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-5 space-y-4">
        <p className="text-sm font-semibold text-white">Ingresá los datos de la cuenta manualmente</p>
        <p className="text-xs text-[#666]">El Estratega usará estos datos para elegir los formatos más efectivos.</p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-[#666] mb-1.5">Seguidores</label>
            <input value={followers} onChange={e => setFollowers(e.target.value)} placeholder="50000" className="input" />
          </div>
          <div>
            <label className="block text-xs text-[#666] mb-1.5">Formato con más ER</label>
            <select value={bestFmt} onChange={e => setBestFmt(e.target.value as ContentFormat)} className="input">
              {['reel','story','carousel','post','video'].map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#666] mb-1.5">Likes promedio</label>
            <input value={avgLikes} onChange={e => setAvgLikes(e.target.value)} placeholder="450" className="input" />
          </div>
          <div>
            <label className="block text-xs text-[#666] mb-1.5">Engagement Rate % promedio</label>
            <input value={avgER} onChange={e => setAvgER(e.target.value)} placeholder="2.8" className="input" />
          </div>
          <div>
            <label className="block text-xs text-[#666] mb-1.5">Mejor hora de publicación</label>
            <input value={bestHour} onChange={e => setBestHour(e.target.value)} placeholder="18" className="input" />
          </div>
          <div>
            <label className="block text-xs text-[#666] mb-1.5">Top hashtags (separados por coma)</label>
            <input value={topTags} onChange={e => setTopTags(e.target.value)} placeholder="#marketing, #branding" className="input" />
          </div>
        </div>

        <button onClick={submitManual} disabled={!followers || !avgLikes} className="btn btn-primary w-full">
          Usar estos datos <ChevronRight size={15} />
        </button>
      </div>
    </div>
  )
}

// ─── Step 1 — Configure ───────────────────────────────────────────────────────

function Step1Config({ brand, formatInsights, onNext, loading }: {
  brand:          Brand
  formatInsights: FormatInsights | null
  onNext: (cfg: { estratega: Agent; copyAgent: Agent; supervisor: Agent; numDays: number; periodLabel: string; selectedPlatforms: Platform[] }) => void
  loading: boolean
}) {
  const [estrategas,   setEstrategas]   = useState<Agent[]>([])
  const [copyAgents,   setCopyAgents]   = useState<Agent[]>([])
  const [supervisors,  setSupervisors]  = useState<Agent[]>([])
  const [estrategaId,  setEstrategaId]  = useState('')
  const [copyId,       setCopyId]       = useState('')
  const [supervisorId, setSupervisorId] = useState('')
  const [numDays,      setNumDays]      = useState(15)
  const [periodLabel,  setPeriodLabel]  = useState('')
  const [platforms,    setPlatforms]    = useState<Platform[]>(['instagram'])

  useEffect(() => {
    const e = getBrandAgentsByRole(brand.id, 'estratega')
    const c = getBrandAgentsByRole(brand.id, 'copy')
    const s = getBrandAgentsByRole(brand.id, 'supervisor')
    setEstrategas(e);  setEstrategaId(e[0]?.id ?? '')
    setCopyAgents(c);  setCopyId(c[0]?.id ?? '')
    setSupervisors(s); setSupervisorId(s[0]?.id ?? '')
  }, [brand.id])

  function togglePlatform(p: Platform) {
    setPlatforms(prev => prev.includes(p) ? (prev.length > 1 ? prev.filter(x => x !== p) : prev) : [...prev, p])
  }

  const missing = !estrategas.length || !copyAgents.length || !supervisors.length
  const canGo   = !missing && estrategaId && copyId && supervisorId

  function go() {
    const estratega  = estrategas.find(a => a.id === estrategaId)!
    const copyAgent  = copyAgents.find(a => a.id === copyId)!
    const supervisor = supervisors.find(a => a.id === supervisorId)!
    onNext({ estratega, copyAgent, supervisor, numDays, periodLabel: periodLabel || `Plan ${numDays} días`, selectedPlatforms: platforms })
  }

  if (missing) return (
    <div className="max-w-lg bg-amber-500/10 border border-amber-500/20 rounded-xl p-5 flex gap-3">
      <AlertCircle size={16} className="text-amber-400 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-amber-300">Faltan agentes para {brand.name}</p>
        <p className="text-xs text-amber-400/80 mt-1">Necesitás 1 Estratega, 1 Copy Agent y 1 Supervisor.</p>
        <a href="/dashboard/agents" className="inline-flex items-center gap-1 text-xs text-amber-300 hover:underline mt-2">
          Configurar agentes <ChevronRight size={11} />
        </a>
      </div>
    </div>
  )

  function AgentPicker({ agents, selectedId, onSelect, label }: { agents: Agent[]; selectedId: string; onSelect: (id: string) => void; label: string }) {
    return (
      <div>
        <label className="block text-xs text-[#666] mb-2">{label}</label>
        <div className="space-y-1.5">
          {agents.map(a => (
            <button key={a.id} onClick={() => onSelect(a.id)}
              className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all ${selectedId === a.id ? 'border-[#5b6ef5] bg-[#5b6ef5]/10' : 'border-[#2a2a2a] bg-[#161616] hover:border-[#3a3a3a]'}`}>
              <div className="flex items-center justify-between">
                <span className={`text-sm font-medium ${selectedId === a.id ? 'text-[#5b6ef5]' : 'text-white'}`}>{a.name}</span>
                {selectedId === a.id && <CheckCircle2 size={13} className="text-[#5b6ef5]" />}
              </div>
              {a.description && <p className="text-2xs text-[#666] mt-0.5 truncate">{a.description}</p>}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      {formatInsights && (
        <div className="bg-[#5b6ef5]/10 border border-[#5b6ef5]/20 rounded-xl px-4 py-3 text-xs text-[#5b6ef5]">
          ✓ Métricas cargadas · Mejor formato: <strong>{formatInsights.best_format.toUpperCase()}</strong> · El Estratega usará estos datos para elegir formatos
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <AgentPicker agents={estrategas} selectedId={estrategaId} onSelect={setEstrategaId} label="Estratega" />
        <AgentPicker agents={copyAgents} selectedId={copyId} onSelect={setCopyId} label="Copy Agent" />
        <AgentPicker agents={supervisors} selectedId={supervisorId} onSelect={setSupervisorId} label="Supervisor" />
      </div>

      {/* Platforms */}
      <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-4">
        <label className="block text-xs text-[#666] mb-3">Redes para esta estrategia <span className="text-[#444]">({platforms.length} seleccionadas)</span></label>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map(p => (
            <button key={p} onClick={() => togglePlatform(p)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium capitalize transition-all ${platforms.includes(p) ? PLATFORM_COLORS[p] : 'border-[#2a2a2a] text-[#444] hover:border-[#3a3a3a] hover:text-[#666]'}`}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Days + label */}
      <div className="grid grid-cols-2 gap-4 bg-[#161616] border border-[#2a2a2a] rounded-xl p-4">
        <div>
          <label className="block text-xs text-[#666] mb-3">
            Duración <span className="text-xl font-bold font-mono text-white ml-1">{numDays}</span> <span className="text-[#666] text-xs">días</span>
          </label>
          <input type="range" min={1} max={30} value={numDays} onChange={e => setNumDays(Number(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer" style={{ accentColor: '#5b6ef5' }} />
          <div className="flex justify-between text-2xs text-[#444] mt-1"><span>1</span><span>15</span><span>30</span></div>
        </div>
        <div>
          <label className="block text-xs text-[#666] mb-3">Nombre del período</label>
          <input value={periodLabel} onChange={e => setPeriodLabel(e.target.value)} placeholder={`Plan ${numDays} días`} className="input" />
        </div>
      </div>

      <button onClick={go} disabled={!canGo || loading} className="btn btn-primary">
        {loading ? <><Loader2 size={15} className="animate-spin" /> Generando plan...</> : <><Sparkles size={15} /> Generar plan <ChevronRight size={15} /></>}
      </button>
    </div>
  )
}

// ─── Step 2 — Plan ────────────────────────────────────────────────────────────

function Step2Plan({ session, onApprove, onRegenerate, loading }: {
  session: StrategySession; onApprove: () => void; onRegenerate: () => void; loading: boolean
}) {
  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold text-lg text-white">{session.period_label}</h2>
          <p className="text-sm text-[#666] mt-0.5">{session.posts.length} posts · {session.estratega_name}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={onRegenerate} disabled={loading} className="btn btn-secondary text-xs">
            <RotateCcw size={12} /> Regenerar
          </button>
          <button onClick={onApprove} disabled={loading} className="btn btn-primary">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Aprobar y generar copies
          </button>
        </div>
      </div>

      {session.strategy_rationale && (
        <div className="bg-[#5b6ef5]/10 border border-[#5b6ef5]/20 rounded-xl px-4 py-3">
          <p className="text-xs text-[#5b6ef5] italic">💡 {session.strategy_rationale}</p>
        </div>
      )}

      {session.pillars.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {session.pillars.map((p, i) => (
            <span key={i} className="text-xs text-[#a1a1a1] bg-[#2a2a2a] px-3 py-1 rounded-full">{p}</span>
          ))}
        </div>
      )}

      {/* Day cards - horizontal scroll layout like the screenshot */}
      <div className="grid gap-3">
        {session.posts.sort((a, b) => a.day - b.day).map((post, i) => (
          <div key={i} className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-4 hover:border-[#3a3a3a] transition-colors">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-xs font-mono text-[#444] bg-[#1a1a1a] px-2 py-0.5 rounded border border-[#2a2a2a]">Día {post.day}</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded border capitalize ${PLATFORM_COLORS[post.platform] ?? 'text-[#666] bg-[#1a1a1a] border-[#2a2a2a]'}`}>{post.platform}</span>
              <FormatBadge format={post.format} />
              <span className="text-2xs text-[#444] bg-[#1a1a1a] px-2 py-0.5 rounded border border-[#2a2a2a] capitalize">{post.content_type}</span>
            </div>
            <p className="text-sm font-medium text-white">{post.topic}</p>
            {post.format_rationale && <p className="text-xs text-[#5b6ef5] mt-1 italic">📊 {post.format_rationale}</p>}
            <p className="text-xs text-[#666] italic mt-1">"{post.hook_suggestion}"</p>
            {post.keywords?.length > 0 && (
              <div className="flex items-center gap-1 mt-2 flex-wrap">
                <Hash size={10} className="text-[#444]" />
                {post.keywords.map((k, ki) => (
                  <span key={ki} className="text-2xs font-mono text-[#5b6ef5] bg-[#5b6ef5]/10 px-1.5 py-0.5 rounded">{k}</span>
                ))}
              </div>
            )}
            {post.visual_direction && <p className="text-2xs text-[#444] mt-1">🎨 {post.visual_direction}</p>}
            {post.script_outline && (
              <div className="mt-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-2">
                <p className="text-2xs text-[#666] mb-1">📝 Guión outline · {post.script_outline.total_duration_sec}s</p>
                {(post.script_outline.scenes ?? []).slice(0, 3).map((sc, si) => (
                  <p key={si} className="text-2xs text-[#444]">Escena {sc.order}: {sc.visual?.slice(0, 60)}</p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Step 3 — Copies ──────────────────────────────────────────────────────────

function Step3Copies({ session, onUpdate, onApprove, loading }: {
  session: StrategySession; onUpdate: (posts: StrategyPostWithCopies[]) => void
  onApprove: () => void; loading: boolean
}) {
  const [regenerating, setRegenerating] = useState<Record<number, boolean>>({})
  const [selected,     setSelected]     = useState<number | null>(null)   // selected post day

  const total    = session.posts.length
  const done     = session.posts.filter(p => p.copies_done).length
  const picked   = session.posts.filter(p => p.selected_copy_index !== undefined).length
  const allPicked = picked === total

  function pickCopy(day: number, index: number) {
    onUpdate(session.posts.map(p => p.day === day ? { ...p, selected_copy_index: index } : p))
  }

  async function regenerate(post: StrategyPostWithCopies, instruction: string) {
    setRegenerating(prev => ({ ...prev, [post.day]: true }))
    try {
      const brand     = getBrands().find(b => b.id === session.brand_id)
      const copyAgent = getBrandAgentsByRole(session.brand_id, 'copy').find(a => a.id === session.copy_agent_id)
      if (!brand || !copyAgent) return
      const enhanced = { ...post, topic: `${post.topic} — INSTRUCCIÓN: ${instruction}` }
      const res = await fetch('/api/strategy/copies', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand, copy_agent: copyAgent, post: enhanced }),
      })
      const data = await res.json()
      if (res.ok && data.copies) {
        onUpdate(session.posts.map(p => p.day === post.day ? { ...p, copies: data.copies, selected_copy_index: undefined } : p))
      }
    } finally { setRegenerating(prev => ({ ...prev, [post.day]: false })) }
  }

  const selectedPost = session.posts.find(p => p.day === selected)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-lg text-white">Elegí los copies</h2>
          <p className="text-sm text-[#666] mt-0.5">{done}/{total} generados · {picked}/{total} elegidos</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-36 h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
            <div className="h-full bg-[#5b6ef5] rounded-full transition-all" style={{ width: `${(done/total)*100}%` }} />
          </div>
          <button onClick={onApprove} disabled={!allPicked || loading} className="btn btn-primary">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Enviar al Supervisor
          </button>
        </div>
      </div>

      {/* Day selector strip (like the screenshot) */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {session.posts.sort((a, b) => a.day - b.day).map(post => {
          const done   = post.copies_done
          const chosen = post.selected_copy_index !== undefined
          return (
            <button key={post.day} onClick={() => setSelected(post.day)}
              className={`shrink-0 rounded-xl border p-3 text-left transition-all min-w-[120px] ${selected === post.day ? 'border-[#5b6ef5] bg-[#5b6ef5]/10' : chosen ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-[#2a2a2a] bg-[#161616] hover:border-[#3a3a3a]'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-mono text-[#666]">Día {post.day}</span>
                {chosen ? <CheckCircle2 size={12} className="text-emerald-400" /> : !done ? <Loader2 size={11} className="text-[#5b6ef5] animate-spin" /> : null}
              </div>
              <p className="text-xs text-white font-medium truncate">{post.topic}</p>
              <div className="flex gap-1 mt-1">
                <FormatBadge format={post.format} />
              </div>
              <p className="text-2xs text-[#444] mt-1 capitalize">{post.platform}</p>
            </button>
          )
        })}
      </div>

      {/* Detail panel for selected post */}
      {selectedPost && (
        <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl overflow-hidden fade-up">
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-[#2a2a2a] bg-[#1a1a1a]">
            <span className="text-xs font-mono text-[#444]">Día {selectedPost.day}</span>
            <span className={`text-xs border px-2 py-0.5 rounded capitalize ${PLATFORM_COLORS[selectedPost.platform] ?? ''}`}>{selectedPost.platform}</span>
            <FormatBadge format={selectedPost.format} />
            <span className="text-sm font-medium text-white flex-1 truncate">{selectedPost.topic}</span>
            {selectedPost.selected_copy_index !== undefined && (
              <span className="text-xs text-emerald-400 flex items-center gap-1 shrink-0"><CheckCircle2 size={12} /> Opción {selectedPost.selected_copy_index}</span>
            )}
            {selectedPost.copies_done && (
              <button
                onClick={() => {
                  const reason = window.prompt('¿Qué querés mejorar? (ej: más corto, sin emojis, más urgente)')
                  if (reason?.trim()) regenerate(selectedPost, reason.trim())
                }}
                disabled={regenerating[selectedPost.day]}
                className="btn btn-secondary text-2xs py-1 px-2.5">
                <RotateCcw size={10} />
                {regenerating[selectedPost.day] ? 'Regenerando...' : 'Regenerar'}
              </button>
            )}
            {!selectedPost.copies_done && (
              <span className="text-xs text-[#666] flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> Generando...</span>
            )}
          </div>

          {/* 3 copy options */}
          {selectedPost.copies && selectedPost.copies.length > 0 ? (
            <div className="grid md:grid-cols-3 divide-x divide-[#2a2a2a]">
              {selectedPost.copies.map((option: CopyOption) => (
                <div key={option.index}
                  onClick={() => pickCopy(selectedPost.day, option.index)}
                  className={`p-5 cursor-pointer transition-all hover:bg-white/[0.02] ${selectedPost.selected_copy_index === option.index ? 'bg-[#5b6ef5]/5' : ''}`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-2xs font-bold font-mono text-[#444]">OPCIÓN {option.index}</span>
                    <span className="text-2xs bg-[#2a2a2a] text-[#666] px-2 py-0.5 rounded-full">{option.angle}</span>
                  </div>
                  <p className="text-sm text-[#a1a1a1] leading-relaxed mb-3 whitespace-pre-wrap">{option.copy}</p>

                  {/* Keywords */}
                  {option.keywords?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {option.keywords.map((k, i) => <span key={i} className="text-2xs font-mono text-[#5b6ef5] bg-[#5b6ef5]/10 px-1.5 py-0.5 rounded">{k}</span>)}
                    </div>
                  )}

                  {/* Hashtags */}
                  {option.hashtags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {option.hashtags.slice(0, 5).map((h, i) => <span key={i} className="text-2xs font-mono text-[#666]">{h}</span>)}
                    </div>
                  )}

                  {/* Script if available */}
                  {option.script && (
                    <details className="mb-3">
                      <summary className="text-2xs text-[#5b6ef5] cursor-pointer hover:underline flex items-center gap-1">
                        <FileText size={10} /> Ver guión ({option.script.total_duration_sec}s)
                      </summary>
                      <div className="mt-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3 space-y-2">
                        {option.script.voiceover_full && (
                          <div>
                            <p className="text-2xs text-[#666] mb-1">Voiceover completo:</p>
                            <p className="text-xs text-[#a1a1a1] italic">"{option.script.voiceover_full}"</p>
                          </div>
                        )}
                        {option.script.scenes?.map(sc => (
                          <div key={sc.order} className="border-t border-[#2a2a2a] pt-2">
                            <p className="text-2xs text-[#5b6ef5] font-mono mb-1">Escena {sc.order} · {sc.duration_sec}s</p>
                            <p className="text-2xs text-[#a1a1a1]">🎬 {sc.visual}</p>
                            {sc.text_overlay && <p className="text-2xs text-white font-medium">📝 "{sc.text_overlay}"</p>}
                            {sc.voiceover   && <p className="text-2xs text-[#666] italic">🎙 {sc.voiceover}</p>}
                            {sc.cta         && <p className="text-2xs text-[#5b6ef5]">→ {sc.cta}</p>}
                          </div>
                        ))}
                        {option.script.music_mood && <p className="text-2xs text-[#444]">🎵 {option.script.music_mood}</p>}
                      </div>
                    </details>
                  )}

                  <p className="text-2xs text-[#444] italic mb-3">{option.rationale}</p>

                  <button
                    onClick={e => { e.stopPropagation(); pickCopy(selectedPost.day, option.index) }}
                    className={`w-full text-xs py-2 rounded-lg border transition-all font-medium ${selectedPost.selected_copy_index === option.index ? 'bg-[#5b6ef5] text-white border-[#5b6ef5]' : 'border-[#2a2a2a] text-[#666] hover:border-[#5b6ef5] hover:text-[#5b6ef5]'}`}>
                    {selectedPost.selected_copy_index === option.index ? '✓ Seleccionada' : 'Elegir esta'}
                  </button>
                </div>
              ))}
            </div>
          ) : selectedPost.copies_done ? (
            <div className="p-8 text-center text-[#666] text-sm">
              Error al generar copies.
              <button onClick={() => regenerate(selectedPost, 'regenerar')} className="ml-2 text-[#5b6ef5] hover:underline">Reintentar</button>
            </div>
          ) : (
            <div className="p-8 text-center text-[#666] text-sm flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin text-[#5b6ef5]" /> Generando copies...
            </div>
          )}
        </div>
      )}

      {!selectedPost && (
        <div className="text-center py-8 text-[#444] text-sm">
          ← Seleccioná un día para ver y elegir el copy
        </div>
      )}
    </div>
  )
}

// ─── Step 4 — Supervisor ──────────────────────────────────────────────────────

function Step4Report({ session, onBack, onFinish, loading }: {
  session: StrategySession; onBack: () => void; onFinish: () => void; loading: boolean
}) {
  const report = session.supervisor_report
  if (!report) return null
  const scoreColor = report.overall_score >= 8 ? 'text-emerald-400' : report.overall_score >= 6 ? 'text-amber-400' : 'text-red-400'

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-lg text-white">Reporte del Supervisor</h2>
          <p className="text-sm text-[#666] mt-0.5">{session.supervisor_name}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onBack} className="btn btn-secondary text-xs"><ChevronLeft size={13} /> Volver</button>
          <button onClick={onFinish} disabled={loading} className="btn btn-primary">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Megaphone size={14} />}
            Crear campaña
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Score general',     value: `${report.overall_score}/10`,   color: scoreColor },
          { label: 'Alineación marca',  value: `${report.brand_alignment}/10`, color: 'text-[#5b6ef5]' },
          { label: 'Score formatos',    value: `${report.format_score ?? '-'}/10`, color: 'text-purple-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="metric-card text-center">
            <p className="text-xs text-[#666] mb-2">{label}</p>
            <p className={`text-4xl font-bold font-mono ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3"><ThumbsUp size={13} className="text-emerald-400" /><span className="text-sm font-semibold text-emerald-400">Puntos fuertes</span></div>
          {report.strengths.map((s, i) => <p key={i} className="text-xs text-emerald-300/80 py-0.5">• {s}</p>)}
        </div>
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3"><ThumbsDown size={13} className="text-red-400" /><span className="text-sm font-semibold text-red-400">Puntos débiles</span></div>
          {report.weaknesses.map((w, i) => <p key={i} className="text-xs text-red-300/80 py-0.5">• {w}</p>)}
        </div>
      </div>

      {report.improvements?.length > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
          <p className="text-xs font-semibold text-amber-400 mb-2">⚡ Mejoras accionables</p>
          {report.improvements.map((imp, i) => <p key={i} className="text-xs text-amber-300/80 py-0.5">• {imp}</p>)}
        </div>
      )}

      {report.calendar_suggestion?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-[#666] mb-3 flex items-center gap-1"><Calendar size={12} /> Calendarización sugerida</p>
          <div className="space-y-2">
            {report.calendar_suggestion.slice(0, 8).map((c, i) => (
              <div key={i} className="flex items-center gap-3 bg-[#161616] border border-[#2a2a2a] rounded-lg px-4 py-2.5">
                <span className="text-xs font-mono text-[#444] w-12 shrink-0">Día {c.day}</span>
                <span className={`text-xs border px-2 py-0.5 rounded capitalize ${PLATFORM_COLORS[c.platform] ?? 'text-[#666] border-[#2a2a2a]'}`}>{c.platform}</span>
                <span className="flex items-center gap-1 text-xs text-white font-medium"><Clock size={11} /> {c.recommended_time}</span>
                <span className="text-xs text-[#444] flex-1 truncate">{c.reasoning}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {report.post_feedback?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-[#666] mb-3">Feedback por post</p>
          <div className="space-y-1.5">
            {report.post_feedback.map((f, i) => (
              <div key={i} className={`flex items-start gap-2 text-xs px-3 py-2 rounded-lg border ${f.passed ? 'bg-emerald-500/5 text-emerald-300 border-emerald-500/20' : 'bg-red-500/5 text-red-300 border-red-500/20'}`}>
                {f.passed ? <CheckCircle2 size={12} className="mt-0.5 shrink-0" /> : <X size={12} className="mt-0.5 shrink-0" />}
                <span><strong>Día {f.day}:</strong> {f.topic}{f.comment ? ` — ${f.comment}` : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function StrategyPage() {
  const [brand,   setBrand]   = useState<Brand | null>(null)
  const [session, setSession] = useState<StrategySession | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [fi,      setFi]      = useState<FormatInsights | null>(null)

  useEffect(() => {
    // Carga inicial — preserva la sesión guardada
    function loadInitial() {
      const brands     = getBrands()
      const selectedId = getSelectedBrandId()
      const found      = brands.find(b => b.id === selectedId) ?? brands[0] ?? null
      setBrand(found)
      if (found) setFi(getFormatInsights(found.id))
    }
    // FIX: al cambiar de cliente desde la sidebar, limpia la sesión activa
    function onBrandChanged() {
      const brands     = getBrands()
      const selectedId = getSelectedBrandId()
      const found      = brands.find(b => b.id === selectedId) ?? brands[0] ?? null
      setBrand(found)
      setFi(found ? getFormatInsights(found.id) : null)
      clearStrategySession()
      setSession(null)
      setError('')
    }
    loadInitial()
    const saved = getStrategySession()
    if (saved) setSession(saved)
    window.addEventListener('brandChanged', onBrandChanged)
    return () => window.removeEventListener('brandChanged', onBrandChanged)
  }, [])

  function updateSession(updates: Partial<StrategySession>) {
    setSession(prev => {
      if (!prev) return prev
      const next = { ...prev, ...updates }
      saveStrategySession(next)
      return next
    })
  }

  // ── Step 0 → 1 ──────────────────────────────────────────────────────────────
  function handleMetricsDone(insights: FormatInsights) {
    setFi(insights)
    updateSession({ step: 1, format_insights: insights } as Partial<StrategySession>)
    if (!session) {
      const s: StrategySession = {
        id: crypto.randomUUID(), brand_id: brand!.id, brand_name: brand!.name,
        estratega_id: '', estratega_name: '', copy_agent_id: '', copy_agent_name: '',
        supervisor_id: '', supervisor_name: '', num_days: 15, period_label: '',
        step: 1, pillars: [], strategy_rationale: '', posts: [],
        format_insights: insights, created_at: new Date().toISOString(),
      }
      saveStrategySession(s); setSession(s)
    }
  }

  // ── Step 1 → 2 ──────────────────────────────────────────────────────────────
  async function handleConfig(cfg: { estratega: Agent; copyAgent: Agent; supervisor: Agent; numDays: number; periodLabel: string; selectedPlatforms: Platform[] }) {
    if (!brand) return
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/strategy/plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand, estratega: cfg.estratega, num_days: cfg.numDays,
          period_label: cfg.periodLabel, selected_platforms: cfg.selectedPlatforms,
          format_insights: fi,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al generar el plan'); return }

      const newSession: StrategySession = {
        id: session?.id ?? crypto.randomUUID(),
        brand_id: brand.id, brand_name: brand.name,
        estratega_id: cfg.estratega.id, estratega_name: cfg.estratega.name,
        copy_agent_id: cfg.copyAgent.id, copy_agent_name: cfg.copyAgent.name,
        supervisor_id: cfg.supervisor.id, supervisor_name: cfg.supervisor.name,
        num_days: cfg.numDays, period_label: cfg.periodLabel,
        selected_platforms: cfg.selectedPlatforms,
        format_insights: fi ?? undefined,
        step: 2, pillars: data.pillars ?? [],
        strategy_rationale: data.strategy_rationale ?? '',
        posts: (data.posts ?? []).map((p: StrategyPostWithCopies) => ({ ...p, copies_done: false })),
        created_at: session?.created_at ?? new Date().toISOString(),
      }
      saveStrategySession(newSession); setSession(newSession)
    } catch { setError('Error de red.') }
    finally { setLoading(false) }
  }

  // ── Step 2 → 3 ──────────────────────────────────────────────────────────────
  async function handleApprovePlan() {
    if (!session) return
    const step3 = { ...session, step: 3 as const }
    saveStrategySession(step3); setSession(step3)

    const brand     = getBrands().find(b => b.id === step3.brand_id)
    const copyAgent = getBrandAgentsByRole(step3.brand_id, 'copy').find(a => a.id === step3.copy_agent_id)
    if (!brand || !copyAgent) { setError('Marca o copy agent no encontrado'); return }

    for (const post of step3.posts) {
      try {
        const res  = await fetch('/api/strategy/copies', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ brand, copy_agent: copyAgent, post }),
        })
        const data = await res.json()
        setSession(prev => {
          if (!prev) return prev
          const nextPosts = prev.posts.map(p => p.day === post.day ? { ...p, copies: data.copies ?? [], copies_done: true } : p)
          const next = { ...prev, posts: nextPosts }
          saveStrategySession(next); return next
        })
      } catch {
        setSession(prev => {
          if (!prev) return prev
          const nextPosts = prev.posts.map(p => p.day === post.day ? { ...p, copies: [], copies_done: true } : p)
          const next = { ...prev, posts: nextPosts }
          saveStrategySession(next); return next
        })
      }
    }
  }

  // ── Step 3 → 4 ──────────────────────────────────────────────────────────────
  async function handleSendToSupervisor() {
    if (!session) return
    setLoading(true); setError('')
    try {
      const brand      = getBrands().find(b => b.id === session.brand_id)
      const supervisor = getBrandAgentsByRole(session.brand_id, 'supervisor').find(a => a.id === session.supervisor_id)
      if (!brand || !supervisor) { setError('Marca o supervisor no encontrado'); return }
      const res  = await fetch('/api/strategy/review', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand, supervisor, posts: session.posts, num_days: session.num_days, period_label: session.period_label, format_insights: session.format_insights }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error'); return }
      updateSession({ step: 4, supervisor_report: data.report })
    } catch { setError('Error de red.') }
    finally { setLoading(false) }
  }

  // ── Step 4 → Campaign ────────────────────────────────────────────────────────
  function handleFinish() {
    if (!session?.supervisor_report) return
    setLoading(true)
    const campaignPosts: CampaignPost[] = session.posts.map(p => {
      const chosen = p.copies?.find(c => c.index === p.selected_copy_index)
      return {
        id: crypto.randomUUID(), day: p.day, platform: p.platform, format: p.format,
        topic: p.topic, content_type: p.content_type, hook_suggestion: p.hook_suggestion,
        visual_direction: p.visual_direction ?? '', copy: chosen?.copy ?? '',
        hashtags: chosen?.hashtags ?? [], keywords: chosen?.keywords ?? p.keywords ?? [],
        script: chosen?.script,
        status: 'draft' as const,
      }
    })
    const campaign: Campaign = {
      id: crypto.randomUUID(), brand_id: session.brand_id, brand_name: session.brand_name,
      period_label: session.period_label, estratega_name: session.estratega_name,
      supervisor_name: session.supervisor_name,
      overall_score: session.supervisor_report.overall_score,
      format_score: session.supervisor_report.format_score ?? 0,
      strengths: session.supervisor_report.strengths,
      weaknesses: session.supervisor_report.weaknesses,
      posts: campaignPosts, created_at: new Date().toISOString(), status: 'draft',
    }
    upsertCampaign(campaign)
    clearStrategySession(); setSession(null); setLoading(false)
    window.location.href = '/dashboard/campaigns'
  }

  const step = session?.step ?? 0

  if (!brand) return (
    <div className="flex flex-col items-center justify-center py-24 text-[#666]">
      <Sparkles size={32} className="mb-3 opacity-20" />
      <p className="text-sm mb-3">Seleccioná un cliente en el sidebar para comenzar</p>
      <a href="/dashboard/brands" className="btn btn-primary text-sm">Configurar cliente →</a>
    </div>
  )

  return (
    <div>
      <div className="mb-2">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={18} className="text-[#5b6ef5]" />
          <h1 className="text-xl font-semibold text-white">Estrategia de Contenido</h1>
          <span className="text-sm text-[#666]">— {brand.name}</span>
        </div>
        <p className="text-xs text-[#666]">Métricas → Configurar → Plan → Copies con guión → Supervisor → Campaña</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-0 my-6">
        {STEPS.map((label, i) => {
          const s = i; const done = s < step; const active = s === step
          return (
            <div key={s} className="flex items-center">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${active ? 'bg-[#5b6ef5] text-white font-medium' : done ? 'text-emerald-400' : 'text-[#444]'}`}>
                {done ? <CheckCircle2 size={12} /> : <span className="font-mono w-4 text-center">{s + 1}</span>}
                {label}
              </div>
              {i < STEPS.length - 1 && <ArrowRight size={12} className={`mx-1.5 ${s < step ? 'text-emerald-400' : 'text-[#2a2a2a]'}`} />}
            </div>
          )
        })}
        {session && (
          <button onClick={() => { clearStrategySession(); setSession(null) }}
            className="ml-5 text-2xs text-[#444] hover:text-red-400 border border-[#2a2a2a] rounded px-2.5 py-1 hover:border-red-500/30 transition flex items-center gap-1">
            <X size={10} /> Reiniciar
          </button>
        )}
      </div>

      {error && (
        <div className="mb-5 bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex gap-2 max-w-2xl">
          <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {step === 0 && brand && <Step0Metrics brand={brand} onNext={handleMetricsDone} />}
      {step === 1 && brand && <Step1Config brand={brand} formatInsights={fi} onNext={handleConfig} loading={loading} />}
      {step === 2 && session && <Step2Plan session={session} loading={loading} onApprove={handleApprovePlan} onRegenerate={() => updateSession({ step: 1 })} />}
      {step === 3 && session && <Step3Copies session={session} loading={loading} onUpdate={posts => updateSession({ posts })} onApprove={handleSendToSupervisor} />}
      {step === 4 && session && <Step4Report session={session} loading={loading} onBack={() => updateSession({ step: 3 })} onFinish={handleFinish} />}
    </div>
  )
}
