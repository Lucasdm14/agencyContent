'use client'

import { useState, useEffect } from 'react'
import {
  TrendingUp, Loader2, AlertCircle, CheckCircle2,
  ChevronDown, ChevronUp, RefreshCw, Database, Target, ShieldAlert, Instagram,
} from 'lucide-react'
import type { Brand, CompetitorHandle, CompetitorAnalysis, RealContext } from '@/lib/types'
import { getCompetitorAnalyses, addCompetitorAnalysis } from '@/lib/storage'
import { useBrand } from '@/lib/hooks/useBrand'

function DataBadge({ label, count, active, icon }: { label: string; count: number; active: boolean; icon?: React.ReactNode }) {
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full border font-mono ${
      active && count > 0
        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
        : 'bg-[#1a1a1a] text-[#444] border-[#2a2a2a]'
    }`}>
      {active && count > 0 ? '✓' : '○'} {label}: {count}
    </span>
  )
}

export default function CompetitorsPage() {
  const { brand, brands, selectBrand } = useBrand()
  const [selectedCompetitor, setSelectedCompetitor] = useState<CompetitorHandle | null>(null)
  const [analyses,     setAnalyses]     = useState<CompetitorAnalysis[]>([])
  const [fetching,     setFetching]     = useState(false)
  const [analyzing,    setAnalyzing]    = useState(false)
  const [fetchSummary, setFetchSummary] = useState<{
    meta_ads_found: number; news_found: number; rss_found: number
    youtube_found: number; instagram_found: number; has_any_data: boolean
  } | null>(null)
  const [realData,   setRealData]   = useState<RealContext | null>(null)
  const [error,      setError]      = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    setAnalyses(getCompetitorAnalyses())
    setSelectedCompetitor(null)
    setFetchSummary(null)
    setRealData(null)
  }, [brand?.id])

  const competitors      = brand?.competitors ?? []
  const filteredAnalyses = analyses.filter(a => a.brand_id === brand?.id)

  async function fetchData() {
    if (!selectedCompetitor || !brand) return
    setFetching(true); setError(''); setFetchSummary(null); setRealData(null)
    try {
      const res = await fetch('/api/competitor/fetch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          competitor: selectedCompetitor,
          keywords:   brand.news_keywords ?? [],
          rss_feeds:  brand.rss_feeds ?? [],
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al buscar datos'); return }
      setFetchSummary(data.summary)
      setRealData(data.context)
    } finally { setFetching(false) }
  }

  async function runAnalysis() {
    if (!selectedCompetitor || !brand || !realData) return
    setAnalyzing(true); setError('')
    try {
      const res = await fetch('/api/competitor/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_id:        brand.id,
          brand_name:      brand.name,
          competitor_name: selectedCompetitor.name,
          real_data:       realData,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al analizar'); return }
      const analysis: CompetitorAnalysis = {
        id:              crypto.randomUUID(),
        brand_id:        brand.id,
        brand_name:      brand.name,
        competitor_name: selectedCompetitor.name,
        analyzed_at:     new Date().toISOString(),
        raw_data:        realData,
        insights:        data.insights,
      }
      addCompetitorAnalysis(analysis)
      setAnalyses(getCompetitorAnalyses())
      setExpandedId(analysis.id)
    } finally { setAnalyzing(false) }
  }

  if (!brand) return (
    <div className="flex flex-col items-center justify-center py-24 text-[#666]">
      <TrendingUp size={32} className="mb-3 opacity-20" />
      <p className="text-sm mb-3">Seleccioná un cliente en el sidebar</p>
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={18} className="text-[#5b6ef5]" />
            <h1 className="text-xl font-semibold text-white">Competidores</h1>
            <span className="text-sm text-[#666]">— {brand.name}</span>
          </div>
          <p className="text-xs text-[#666]">Análisis basado en datos reales: Instagram, Meta Ads, YouTube, noticias</p>
        </div>
        {brands.length > 1 && (
          <select value={brand.id} onChange={e => selectBrand(e.target.value)} className="input text-sm py-1.5 px-3 w-44">
            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
      </div>

      {/* Info box */}
      <div className="bg-[#5b6ef5]/10 border border-[#5b6ef5]/20 rounded-xl p-4 mb-6 flex gap-3">
        <Database size={15} className="text-[#5b6ef5] mt-0.5 shrink-0" />
        <p className="text-xs text-[#5b6ef5]">
          <strong>Anti-alucinación activo.</strong> El análisis usa ÚNICAMENTE datos reales de APIs.
          Configura el Instagram del competidor en Clientes para obtener métricas de posts.
        </p>
      </div>

      {/* Selector + fetch */}
      <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-5 space-y-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          {/* Brand */}
          <div>
            <label className="block text-xs font-medium text-[#666] mb-2">Cliente</label>
            <select value={brand.id}
              onChange={e => { selectBrand(e.target.value); setSelectedCompetitor(null); setFetchSummary(null); setRealData(null) }}
              className="input">
              {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          {/* Competitor */}
          <div>
            <label className="block text-xs font-medium text-[#666] mb-2">Competidor a analizar</label>
            <select
              value={selectedCompetitor?.name ?? ''}
              onChange={e => {
                const c = competitors.find(x => x.name === e.target.value) ?? null
                setSelectedCompetitor(c); setFetchSummary(null); setRealData(null)
              }}
              className="input">
              <option value="">Seleccioná un competidor</option>
              {competitors.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
          </div>
        </div>

        {/* No competitors warning */}
        {competitors.length === 0 && (
          <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
            <AlertCircle size={14} className="text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-400">
              No hay competidores configurados para este cliente.{' '}
              <a href="/dashboard/brands" className="underline font-medium">Ir a Clientes →</a>
            </p>
          </div>
        )}

        {/* Competitor detail + data badges */}
        {selectedCompetitor && (
          <div className="space-y-3">
            {/* Sources configured */}
            <div className="flex flex-wrap gap-2">
              {selectedCompetitor.instagram_handle && (
                <span className="flex items-center gap-1 text-xs text-pink-400 bg-pink-500/10 border border-pink-500/20 px-2.5 py-1 rounded-full">
                  <Instagram size={11} /> @{selectedCompetitor.instagram_handle.replace('@','')}
                </span>
              )}
              {selectedCompetitor.facebook_page_name && (
                <span className="text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-full">
                  FB: {selectedCompetitor.facebook_page_name}
                </span>
              )}
              {selectedCompetitor.youtube_channel && (
                <span className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-full">
                  YT: {selectedCompetitor.youtube_channel}
                </span>
              )}
              {!selectedCompetitor.instagram_handle && !selectedCompetitor.facebook_page_name && (
                <span className="text-xs text-[#444] bg-[#1a1a1a] border border-[#2a2a2a] px-2.5 py-1 rounded-full">
                  Solo búsqueda por nombre — configurá Instagram para más datos
                </span>
              )}
            </div>

            {/* Fetch results badges */}
            {fetchSummary && (
              <div className="flex flex-wrap gap-2">
                <DataBadge label="Instagram"  count={fetchSummary.instagram_found} active={!!selectedCompetitor.instagram_handle} />
                <DataBadge label="Meta Ads"   count={fetchSummary.meta_ads_found}  active={!!selectedCompetitor.facebook_page_name} />
                <DataBadge label="YouTube"    count={fetchSummary.youtube_found}   active={!!selectedCompetitor.youtube_channel} />
                <DataBadge label="Noticias"   count={fetchSummary.news_found}      active={true} />
                <DataBadge label="RSS"        count={fetchSummary.rss_found}       active={!!selectedCompetitor.website_url} />
              </div>
            )}
          </div>
        )}

        {error && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
            <AlertCircle size={13} /> {error}
          </p>
        )}

        <div className="flex gap-3">
          <button onClick={fetchData} disabled={fetching || !selectedCompetitor} className="btn btn-secondary disabled:opacity-40">
            {fetching ? <><Loader2 size={14} className="animate-spin" /> Buscando...</> : <><Database size={14} /> 1. Buscar datos reales</>}
          </button>
          <button onClick={runAnalysis} disabled={analyzing || !realData || !fetchSummary?.has_any_data} className="btn btn-primary disabled:opacity-40">
            {analyzing ? <><Loader2 size={14} className="animate-spin" /> Analizando...</> : <><TrendingUp size={14} /> 2. Analizar con IA</>}
          </button>
        </div>

        {fetchSummary && !fetchSummary.has_any_data && (
          <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
            No se encontraron datos para este competidor. Configurá su Instagram, Facebook o YouTube en la sección Clientes.
          </p>
        )}
      </div>

      {/* Analyses list */}
      {filteredAnalyses.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-[#666] uppercase tracking-wider">Análisis anteriores</p>
          {filteredAnalyses.map(a => (
            <div key={a.id} className="bg-[#161616] border border-[#2a2a2a] rounded-xl overflow-hidden">
              <button onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors text-left">
                <div>
                  <div className="flex items-center gap-2">
                    <Target size={14} className="text-[#5b6ef5]" />
                    <span className="font-medium text-white">{a.competitor_name}</span>
                    <span className={`text-2xs px-2 py-0.5 rounded-full border ${
                      a.insights.confidence === 'high'   ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10' :
                      a.insights.confidence === 'medium' ? 'text-amber-400 border-amber-500/20 bg-amber-500/10' :
                      'text-red-400 border-red-500/20 bg-red-500/10'
                    }`}>{a.insights.confidence}</span>
                  </div>
                  <p className="text-xs text-[#444] mt-0.5">{new Date(a.analyzed_at).toLocaleString('es-AR')}</p>
                </div>
                {expandedId === a.id ? <ChevronUp size={15} className="text-[#444]" /> : <ChevronDown size={15} className="text-[#444]" />}
              </button>

              {expandedId === a.id && (
                <div className="border-t border-[#2a2a2a] p-5 space-y-4 fade-up">
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Ads */}
                    {a.insights.main_messages.length > 0 && (
                      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4">
                        <p className="text-xs font-semibold text-white mb-2 flex items-center gap-1"><Database size={11} /> {a.insights.active_ads_count} ads activos</p>
                        {a.insights.main_messages.slice(0, 4).map((m, i) => (
                          <p key={i} className="text-xs text-[#a1a1a1] py-0.5">• {m}</p>
                        ))}
                      </div>
                    )}

                    {/* Opportunities */}
                    {a.insights.differentiation_opportunities.length > 0 && (
                      <div className="bg-[#5b6ef5]/5 border border-[#5b6ef5]/20 rounded-xl p-4">
                        <p className="text-xs font-semibold text-[#5b6ef5] mb-2 flex items-center gap-1"><ShieldAlert size={11} /> Oportunidades de diferenciación</p>
                        {a.insights.differentiation_opportunities.slice(0, 4).map((o, i) => (
                          <p key={i} className="text-xs text-[#a1a1a1] py-0.5">• {o}</p>
                        ))}
                      </div>
                    )}

                    {/* Topics to avoid */}
                    {a.insights.topics_to_avoid.length > 0 && (
                      <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
                        <p className="text-xs font-semibold text-red-400 mb-2">⚠️ Temas a evitar (saturados)</p>
                        {a.insights.topics_to_avoid.slice(0, 4).map((t, i) => (
                          <p key={i} className="text-xs text-[#a1a1a1] py-0.5">• {t}</p>
                        ))}
                      </div>
                    )}

                    {/* Recommended angles */}
                    {a.insights.recommended_angles.length > 0 && (
                      <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
                        <p className="text-xs font-semibold text-emerald-400 mb-2">✓ Ángulos recomendados para vos</p>
                        {a.insights.recommended_angles.slice(0, 4).map((r, i) => (
                          <p key={i} className="text-xs text-[#a1a1a1] py-0.5">• {r}</p>
                        ))}
                      </div>
                    )}
                  </div>

                  <p className="text-2xs text-[#444] italic">{a.insights.disclaimer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
