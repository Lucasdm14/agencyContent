'use client'

import { useState, useCallback } from 'react'
import {
  BarChart3, Loader2, AlertCircle, RefreshCw, Download,
  Heart, MessageCircle, Eye, Play, Image as ImageIcon,
  Sparkles, TrendingUp, Clock, Hash, ChevronRight,
} from 'lucide-react'
import type { Brand, InstagramAccountMetrics, InstagramPost, FormatInsights } from '@/lib/types'
import { saveFormatInsights } from '@/lib/storage'
import { useBrand } from '@/lib/hooks/useBrand'

// ─── Image proxy ──────────────────────────────────────────────────────────────
function proxyUrl(url: string | undefined): string | undefined {
  if (!url) return undefined
  if (url.includes('cdninstagram.com') || url.includes('fbcdn.net')) {
    return `/api/proxy/image?url=${encodeURIComponent(url)}`
  }
  return url
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

const FORMAT_BADGE: Record<string, string> = {
  Video: 'badge-reel', Sidecar: 'badge-carousel', Image: 'badge-post',
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KPICard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="metric-card">
      <p className="text-xs text-[#666] mb-2">{label}</p>
      <p className={`text-2xl font-bold font-mono ${accent ? 'text-[#5b6ef5]' : 'text-white'}`}>{value}</p>
      {sub && <p className="text-xs text-[#444] mt-1">{sub}</p>}
    </div>
  )
}

// ─── Post card ────────────────────────────────────────────────────────────────
function PostCard({ post, rank }: { post: InstagramPost; rank?: number }) {
  const imgSrc = proxyUrl(post.displayUrl)
  return (
    <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl overflow-hidden hover:border-[#3a3a3a] transition-colors group">
      <div className="relative aspect-square bg-[#1a1a1a] overflow-hidden">
        {imgSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imgSrc} alt={post.caption?.slice(0, 40)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {post.type === 'Video' ? <Play size={28} className="text-[#333]" /> : <ImageIcon size={28} className="text-[#333]" />}
          </div>
        )}
        {rank && (
          <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-[#5b6ef5] text-white text-xs font-bold flex items-center justify-center">{rank}</div>
        )}
        <div className={`absolute top-2 right-2 text-2xs px-1.5 py-0.5 rounded font-medium ${FORMAT_BADGE[post.type] ?? 'badge-post'}`}>
          {post.type === 'Video' ? 'REEL' : post.type === 'Sidecar' ? 'CARR' : 'POST'}
        </div>
        {post.er !== undefined && (
          <div className="absolute bottom-2 left-2 bg-black/70 text-white text-2xs px-2 py-0.5 rounded font-mono">ER {post.er}%</div>
        )}
      </div>
      <div className="p-3 space-y-2">
        <p className="text-xs text-[#a1a1a1] leading-relaxed line-clamp-2">{post.caption || '(sin caption)'}</p>
        <div className="flex items-center gap-3 text-xs text-[#666]">
          <span className="flex items-center gap-1"><Heart size={10} className="text-red-400" /> {fmtNum(post.likesCount)}</span>
          <span className="flex items-center gap-1"><MessageCircle size={10} className="text-blue-400" /> {post.commentsCount}</span>
          {post.videoViewCount && <span className="flex items-center gap-1"><Eye size={10} className="text-purple-400" /> {fmtNum(post.videoViewCount)}</span>}
        </div>
        <div className="flex items-center justify-between">
          <p className="text-2xs text-[#444]">{new Date(post.timestamp).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}</p>
          <a href={post.url} target="_blank" rel="noreferrer" className="text-2xs text-[#5b6ef5] hover:underline">Ver ↗</a>
        </div>
      </div>
    </div>
  )
}

// ─── Format bar ───────────────────────────────────────────────────────────────
function FormatBar({ fi }: { fi: FormatInsights }) {
  const formats = Object.entries(fi.format_stats ?? {}).sort(([, a], [, b]) => (b?.avg_er ?? 0) - (a?.avg_er ?? 0))
  return (
    <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-white">Performance por formato</p>
        <span className="text-2xs text-[#5b6ef5] bg-[#5b6ef5]/10 border border-[#5b6ef5]/20 px-2 py-0.5 rounded-full">Mejor: {fi.best_format.toUpperCase()} ★</span>
      </div>
      {formats.map(([fmt, stats]) => {
        if (!stats) return null
        const pct = Math.round((stats.avg_er / (formats[0][1]?.avg_er ?? 1)) * 100)
        return (
          <div key={fmt} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-[#a1a1a1]">{fmt === 'Video' ? 'Reel/Video' : fmt === 'Sidecar' ? 'Carrusel' : 'Post'}</span>
              <span className="text-white font-mono">{stats.avg_er}% ER · {fmtNum(stats.avg_likes)} likes · {stats.count} posts</span>
            </div>
            <div className="h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
              <div className="h-full bg-[#5b6ef5] rounded-full" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      })}
      {fi.best_posting_hours.length > 0 && (
        <div className="flex items-center gap-2 pt-2 border-t border-[#2a2a2a]">
          <Clock size={11} className="text-[#666]" />
          <p className="text-xs text-[#666]">Mejores horarios: <span className="text-white">{fi.best_posting_hours.map(h => `${h}:00`).join(', ')}</span></p>
        </div>
      )}
    </div>
  )
}

// ─── AI Analysis ──────────────────────────────────────────────────────────────
function AIAnalysis({ metrics }: { metrics: InstagramAccountMetrics }) {
  const [data,    setData]    = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  async function run() {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/metrics/apify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'ai_analysis', account_metrics: metrics }),
      })
      const d = await res.json()
      if (!res.ok) { setError(d.error ?? 'Error'); return }
      setData(d.ai_analysis)
    } catch { setError('Error de red') }
    finally { setLoading(false) }
  }

  if (!data && !loading) return (
    <div className="text-center py-12">
      <Sparkles size={28} className="mx-auto mb-3 text-[#5b6ef5] opacity-60" />
      <p className="text-sm text-[#a1a1a1] mb-2">Análisis IA de {metrics.posts.length} posts</p>
      <p className="text-xs text-[#666] mb-5 max-w-sm mx-auto">GPT-4o analiza los datos reales y extrae insights accionables: hooks, formatos, temas y recomendaciones.</p>
      <button onClick={run} className="btn btn-primary mx-auto"><Sparkles size={14} /> Generar análisis IA</button>
    </div>
  )
  if (loading) return (
    <div className="flex flex-col items-center gap-3 py-12 text-[#666]">
      <Loader2 size={22} className="animate-spin text-[#5b6ef5]" />
      <p className="text-sm">Analizando {metrics.posts.length} posts...</p>
    </div>
  )
  if (error) return <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-4">{error}</p>
  if (!data) return null

  const sections = [
    { title: '🎣 Hooks que funcionan',    key: 'top_hook_patterns' },
    { title: '📊 Formatos con mejor ER',  key: 'best_formats' },
    { title: '📌 Temas recurrentes',       key: 'content_themes' },
    { title: '💪 Fortalezas',             key: 'strengths' },
    { title: '⚠️ Áreas de mejora',         key: 'weaknesses' },
    { title: '💡 Recomendaciones',         key: 'recommendations' },
    { title: '📈 Insights de engagement',  key: 'engagement_insights' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-[#5b6ef5]" />
          <span className="text-sm font-semibold text-white">Análisis IA</span>
          {typeof data.posting_frequency === 'string' && <span className="text-xs text-[#666]">· {data.posting_frequency}</span>}
        </div>
        <button onClick={run} className="btn btn-secondary text-xs"><RefreshCw size={11} /> Regenerar</button>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        {sections.map(({ title, key }) => {
          const items = Array.isArray(data[key]) ? data[key] as string[] : []
          return (
            <div key={key} className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-4">
              <p className="text-xs font-semibold text-white mb-2">{title}</p>
              {items.length > 0 ? items.map((item, i) => <p key={i} className="text-xs text-[#a1a1a1] py-0.5">• {item}</p>) : <p className="text-xs text-[#444] italic">Sin datos suficientes</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Ads section ──────────────────────────────────────────────────────────────
function AdsSection({ handle }: { handle: string }) {
  const [data,    setData]    = useState<{ active_ads: unknown[]; new_ads: unknown[]; main_messages: string[]; cta_patterns: string[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  async function load() {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/metrics/apify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'meta_ads', page_name: handle }),
      })
      const d = await res.json()
      if (!res.ok) { setError(d.error ?? 'Error'); return }
      setData(d.data)
    } catch { setError('Error de red') }
    finally { setLoading(false) }
  }

  if (!data && !loading) return (
    <div className="text-center py-10">
      <TrendingUp size={28} className="mx-auto mb-3 text-[#666] opacity-50" />
      <p className="text-sm text-[#666] mb-4">Ads activos en Meta Ad Library</p>
      <button onClick={load} className="btn btn-secondary mx-auto">Cargar ads</button>
    </div>
  )
  if (loading) return <div className="flex items-center gap-2 py-10 justify-center text-[#666] text-sm"><Loader2 size={16} className="animate-spin" /> Buscando...</div>
  if (error)   return <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-4">{error}</p>
  if (!data)   return null

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <KPICard label="Ads activos"    value={String(data.active_ads.length)} accent />
        <KPICard label="Nuevos (7 días)" value={String(data.new_ads.length)} />
      </div>
      {data.main_messages.length > 0 && (
        <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-white mb-3">Mensajes detectados</p>
          {data.main_messages.slice(0, 6).map((m, i) => (
            <div key={i} className="flex gap-2 text-xs"><span className="text-[#444] font-mono shrink-0">{i + 1}.</span><p className="text-[#a1a1a1]">"{m}"</p></div>
          ))}
        </div>
      )}
      {data.cta_patterns.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.cta_patterns.map((c, i) => <span key={i} className="text-xs bg-[#5b6ef5]/10 text-[#5b6ef5] border border-[#5b6ef5]/20 px-2.5 py-1 rounded-full">{c}</span>)}
        </div>
      )}
    </div>
  )
}

// ─── Account view ─────────────────────────────────────────────────────────────
type Tab = 'posts' | 'historial' | 'ads' | 'analisis_ia'

function AccountView({ brand, periodDays }: { brand: Brand; periodDays: number }) {
  const [metrics, setMetrics] = useState<InstagramAccountMetrics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [tab,     setTab]     = useState<Tab>('posts')

  const handle = brand.instagram_handle?.replace('@', '')

  const load = useCallback(async () => {
    if (!handle) return
    setLoading(true); setError(''); setMetrics(null)
    try {
      const res = await fetch('/api/metrics/apify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'account', username: handle, brand_id: brand.id, period_days: periodDays }),
      })
      const d = await res.json()
      if (!res.ok) { setError(d.error ?? 'Error'); return }
      setMetrics(d.metrics)
      if (d.metrics?.format_insights) saveFormatInsights(d.metrics.format_insights)
    } catch { setError('Error de red') }
    finally { setLoading(false) }
  }, [handle, brand.id, periodDays])

  // Load when brand or period changes
  useState(() => { if (handle) load() })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  if (metrics === null && !loading && !error && handle) { load() }

  function exportJSON() {
    if (!metrics) return
    const blob = new Blob([JSON.stringify(metrics, null, 2)], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${handle}-metrics.json`; a.click()
  }

  if (!handle) return (
    <div className="flex flex-col items-center justify-center py-20 text-[#666]">
      <BarChart3 size={32} className="mb-3 opacity-30" />
      <p className="text-sm mb-3">Este cliente no tiene Instagram configurado</p>
      <a href="/dashboard/brands" className="btn btn-secondary text-xs">Configurar handle →</a>
    </div>
  )

  if (loading) return (
    <div className="flex flex-col items-center gap-3 py-20 text-[#666]">
      <Loader2 size={24} className="animate-spin text-[#5b6ef5]" />
      <p className="text-sm">Cargando @{handle} desde Apify...</p>
      <p className="text-xs text-[#444]">El actor puede tardar hasta 60 segundos</p>
    </div>
  )

  if (error) return (
    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-5 flex gap-3">
      <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-medium text-red-400">{error}</p>
        <button onClick={load} className="text-xs text-red-400 hover:underline mt-1">Reintentar</button>
      </div>
    </div>
  )

  if (!metrics) return null

  const { profile } = metrics
  const avgLikes    = Math.round(metrics.posts.reduce((s, p) => s + p.likesCount,    0) / Math.max(metrics.posts.length, 1))
  const avgComments = Math.round(metrics.posts.reduce((s, p) => s + p.commentsCount, 0) / Math.max(metrics.posts.length, 1))
  const avgER       = Math.round(metrics.posts.reduce((s, p) => s + (p.er ?? 0),     0) / Math.max(metrics.posts.length, 1) * 100) / 100

  return (
    <div className="space-y-5 fade-up">
      {/* Account header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {profile.profilePicUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={proxyUrl(profile.profilePicUrl)} alt={handle} className="w-12 h-12 rounded-full border-2 border-[#5b6ef5]/30" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#5b6ef5] to-purple-500 flex items-center justify-center">
              <span className="text-white font-bold">{handle[0]?.toUpperCase()}</span>
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-white text-lg">@{handle}</p>
              {profile.isVerified && <span className="text-2xs bg-[#5b6ef5]/15 text-[#5b6ef5] border border-[#5b6ef5]/25 px-2 py-0.5 rounded-full">✓ Verificado</span>}
            </div>
            {profile.fullName && <p className="text-xs text-[#666]">{profile.fullName}</p>}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={load}       className="btn btn-secondary text-xs"><RefreshCw size={12} /> Actualizar</button>
          <button onClick={exportJSON} className="btn btn-secondary text-xs"><Download  size={12} /> JSON</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-6 gap-3">
        <KPICard label="Seguidores"       value={fmtNum(profile.followersCount)} accent />
        <KPICard label="Publicaciones"    value={fmtNum(profile.postsCount)} />
        <KPICard label="Avg. Likes"       value={fmtNum(avgLikes)} />
        <KPICard label="Avg. Comentarios" value={fmtNum(avgComments)} />
        <KPICard label="Avg. ER"          value={`${avgER}%`} />
        <KPICard label="Posts analizados" value={String(metrics.posts.length)} sub={`${periodDays} días`} />
      </div>

      {/* Format bar */}
      <FormatBar fi={metrics.format_insights} />

      {/* Top hashtags */}
      {metrics.format_insights.top_hashtags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Hash size={12} className="text-[#444]" />
          {metrics.format_insights.top_hashtags.slice(0, 12).map((h, i) => (
            <span key={i} className="text-xs font-mono text-[#5b6ef5] bg-[#5b6ef5]/10 border border-[#5b6ef5]/20 px-2 py-0.5 rounded">{h}</span>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="tab-bar w-fit">
        {([['posts','Posts'],['historial','Historial'],['ads','Ads'],['analisis_ia','Análisis IA']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`tab ${tab === id ? 'active' : ''}`}>{label}</button>
        ))}
      </div>

      {/* Posts */}
      {tab === 'posts' && (
        <div>
          <p className="text-xs font-semibold text-[#666] mb-4">Top {metrics.top_posts.length} posts por score</p>
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {metrics.top_posts.map((post, i) => <PostCard key={i} post={post} rank={i + 1} />)}
          </div>
        </div>
      )}

      {/* Historial */}
      {tab === 'historial' && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[#666] mb-3">{metrics.posts.length} posts — últimos {periodDays} días</p>
          {metrics.posts
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .map((post, i) => (
              <div key={i} className="flex items-start gap-4 bg-[#161616] border border-[#2a2a2a] rounded-xl p-4 hover:border-[#3a3a3a] transition-colors">
                <div className="shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-[#1a1a1a]">
                  {proxyUrl(post.displayUrl)
                    ? <img src={proxyUrl(post.displayUrl)} alt="" className="w-full h-full object-cover" loading="lazy" /> // eslint-disable-line @next/next/no-img-element
                    : <div className="w-full h-full flex items-center justify-center">{post.type === 'Video' ? <Play size={16} className="text-[#444]" /> : <ImageIcon size={16} className="text-[#444]" />}</div>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-2xs px-1.5 py-0.5 rounded ${FORMAT_BADGE[post.type] ?? 'badge-post'}`}>
                      {post.type === 'Video' ? 'REEL' : post.type === 'Sidecar' ? 'CARRUSEL' : 'POST'}
                    </span>
                    <span className="text-2xs text-[#444]">{new Date(post.timestamp).toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: 'short' })}</span>
                  </div>
                  <p className="text-xs text-[#a1a1a1] line-clamp-2">{post.caption || '(sin caption)'}</p>
                  <div className="flex gap-3 mt-1.5 text-2xs text-[#666]">
                    <span className="flex items-center gap-0.5"><Heart size={9} className="text-red-400" /> {fmtNum(post.likesCount)}</span>
                    <span className="flex items-center gap-0.5"><MessageCircle size={9} className="text-blue-400" /> {post.commentsCount}</span>
                    {post.videoViewCount && <span className="flex items-center gap-0.5"><Eye size={9} className="text-purple-400" /> {fmtNum(post.videoViewCount)}</span>}
                    {post.er !== undefined && <span className="text-[#5b6ef5]">ER {post.er}%</span>}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold font-mono text-white">{Math.round(post.score)}</p>
                  <p className="text-2xs text-[#444]">score</p>
                  <a href={post.url} target="_blank" rel="noreferrer" className="text-2xs text-[#5b6ef5] hover:underline">↗</a>
                </div>
              </div>
            ))}
        </div>
      )}

      {tab === 'ads'        && <AdsSection handle={handle} />}
      {tab === 'analisis_ia' && <AIAnalysis metrics={metrics} />}
    </div>
  )
}

// ─── Competitor row ───────────────────────────────────────────────────────────
function CompetitorRow({ name, handle, brandId }: { name: string; handle: string; brandId: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl overflow-hidden">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-[#2a2a2a] flex items-center justify-center">
            <span className="text-xs font-bold text-[#666]">{name[0]?.toUpperCase()}</span>
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-white">{name}</p>
            <p className="text-xs text-[#666]">@{handle}</p>
          </div>
        </div>
        <ChevronRight size={15} className={`text-[#444] transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="border-t border-[#2a2a2a] p-5">
          <AccountView brand={{ id: brandId, instagram_handle: handle } as Brand} periodDays={30} />
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function MetricsPage() {
  const { brand, brands, selectBrand } = useBrand()
  const [periodDays, setPeriodDays]    = useState(30)
  const [tab,        setTab]           = useState<'propia' | 'competidores'>('propia')

  // Reset tab when brand changes
  const [prevBrandId, setPrevBrandId] = useState('')
  if (brand && brand.id !== prevBrandId) {
    setPrevBrandId(brand.id)
    setTab('propia')
  }

  if (!brand) return (
    <div className="flex flex-col items-center justify-center py-24 text-[#666]">
      <BarChart3 size={32} className="mb-3 opacity-30" />
      <p className="text-sm mb-3">No hay clientes configurados</p>
      <a href="/dashboard/brands" className="btn btn-primary text-sm">Crear cliente →</a>
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 size={18} className="text-[#5b6ef5]" />
            <h1 className="text-xl font-semibold text-white">Métricas</h1>
          </div>
          <p className="text-xs text-[#666]">Datos en tiempo real desde Apify · Se guardan para la Estrategia</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Brand selector */}
          {brands.length > 1 && (
            <select
              value={brand.id}
              onChange={e => selectBrand(e.target.value)}
              className="input text-sm py-1.5 px-3 w-44">
              {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          {/* Period selector */}
          <div className="flex items-center gap-1 bg-[#161616] border border-[#2a2a2a] rounded-lg p-1">
            {[7, 15, 30, 60, 90].map(d => (
              <button key={d} onClick={() => setPeriodDays(d)}
                className={`px-3 py-1 text-xs rounded transition-all font-mono ${periodDays === d ? 'bg-[#2a2a2a] text-white' : 'text-[#444] hover:text-[#a1a1a1]'}`}>
                {d}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main tabs */}
      <div className="tab-bar w-fit mb-6">
        <button className={`tab ${tab === 'propia' ? 'active' : ''}`} onClick={() => setTab('propia')}>
          Cuenta propia
          {brand.instagram_handle && <span className="ml-1.5 text-2xs text-[#666]">@{brand.instagram_handle.replace('@','')}</span>}
        </button>
        <button className={`tab ${tab === 'competidores' ? 'active' : ''}`} onClick={() => setTab('competidores')}>
          Competidores
          {(brand.competitors?.length ?? 0) > 0 && (
            <span className="ml-1.5 text-2xs bg-[#2a2a2a] px-1.5 py-0.5 rounded">{brand.competitors.length}</span>
          )}
        </button>
      </div>

      {tab === 'propia' && (
        <AccountView key={`${brand.id}-${periodDays}`} brand={brand} periodDays={periodDays} />
      )}

      {tab === 'competidores' && (
        <div className="space-y-3">
          {!brand.competitors?.length ? (
            <div className="text-center py-16 text-[#666]">
              <p className="text-sm mb-3">No hay competidores configurados para {brand.name}</p>
              <a href="/dashboard/brands" className="btn btn-secondary text-xs">Agregar competidores →</a>
            </div>
          ) : (
            brand.competitors.map((c, i) => (
              <CompetitorRow
                key={i}
                name={c.name}
                handle={c.instagram_handle?.replace('@','') ?? c.name.toLowerCase().replace(/\s/g, '')}
                brandId={brand.id}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}
