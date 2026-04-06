'use client'

import { useState, useRef } from 'react'
import { Zap, Upload, Loader2, CheckCircle2, ImagePlus, Info, Database, Bot, ChevronDown } from 'lucide-react'
import type { Agent, Post } from '@/lib/types'
import { getBrandAgents, addPost } from '@/lib/storage'
import { useBrand } from '@/lib/hooks/useBrand'

const PLATFORMS = ['instagram', 'linkedin', 'facebook', 'twitter', 'tiktok']

function AgentSelector({ agents, selectedId, onChange }: {
  agents: Agent[]; selectedId: string; onChange: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const selected = agents.find(a => a.id === selectedId)

  if (agents.length === 0) return (
    <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-400">
      <Bot size={14} className="mt-0.5 shrink-0" />
      <span>Sin agentes de copy para este cliente. <a href="/dashboard/agents" className="underline font-medium">Crear agente →</a></span>
    </div>
  )

  return (
    <div className="space-y-2 relative">
      <label className="block text-xs font-medium text-[#666] uppercase tracking-wider">Agente (segmento)</label>
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-sm bg-[#1e1e1e] hover:bg-[#242424] transition outline-none focus:border-[#5b6ef5]">
        <div className="flex items-center gap-2">
          <Bot size={14} className={selected ? 'text-[#5b6ef5]' : 'text-[#444]'} />
          {selected
            ? <span className="text-white font-medium">{selected.name}</span>
            : <span className="text-[#444]">Sin agente — copy genérico</span>
          }
        </div>
        <ChevronDown size={14} className="text-[#444] shrink-0" />
      </button>
      {open && (
        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-float overflow-hidden">
          <button onClick={() => { onChange(''); setOpen(false) }}
            className={`w-full text-left px-4 py-3 text-sm hover:bg-white/5 transition flex items-center gap-2 ${!selectedId ? 'bg-white/5' : ''}`}>
            <Bot size={14} className="text-[#444]" />
            <div>
              <span className="text-[#666]">Sin agente</span>
              <p className="text-xs text-[#444] mt-0.5">Copy genérico basado en el brandbook</p>
            </div>
          </button>
          <div className="border-t border-[#2a2a2a]" />
          {agents.map(a => (
            <button key={a.id} onClick={() => { onChange(a.id); setOpen(false) }}
              className={`w-full text-left px-4 py-3 text-sm hover:bg-white/5 transition ${selectedId === a.id ? 'bg-[#5b6ef5]/10' : ''}`}>
              <div className="flex items-center gap-2">
                <Bot size={14} className="text-[#5b6ef5] shrink-0" />
                <div>
                  <span className={`font-medium ${selectedId === a.id ? 'text-[#5b6ef5]' : 'text-white'}`}>{a.name}</span>
                  {a.description && <span className="text-[#444] text-xs ml-2">{a.description}</span>}
                  <p className="text-xs text-[#444] mt-0.5 truncate max-w-xs">{a.segment}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function GeneratePage() {
  const { brand } = useBrand()
  const [agents,      setAgents]      = useState<Agent[]>([])
  const [agentId,     setAgentId]     = useState('')
  const [platform,    setPlatform]    = useState('instagram')
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [imageName,   setImageName]   = useState('')
  const [loading,     setLoading]     = useState(false)
  const [result,      setResult]      = useState<{ score: number; context: { sources: string[]; news_count: number; rss_count: number; competitor_ads_count: number }; agent?: string } | null>(null)
  const [error,       setError]       = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // Load agents when brand changes
  const prevBrandId = useState('')
  if (brand && brand.id !== prevBrandId[0]) {
    prevBrandId[1](brand.id)
    const brandAgents = getBrandAgents(brand.id).filter(a => a.role === 'copy' || !a.role)
    setAgents(brandAgents)
    setAgentId('')
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { setError('La imagen supera 10MB'); return }
    setImageName(file.name)
    const reader = new FileReader()
    reader.onload = () => setImageBase64(reader.result as string)
    reader.readAsDataURL(file)
  }

  async function generate() {
    if (!brand || !imageBase64 || !platform) return
    setLoading(true); setError(''); setResult(null)
    const agent = agents.find(a => a.id === agentId) ?? null
    try {
      const res = await fetch('/api/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand, image_base64: imageBase64, platform, agent }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al generar'); setLoading(false); return }

      const post: Post = {
        id: crypto.randomUUID(), brand_id: brand.id, brand_name: brand.name,
        agent_id: agent?.id, agent_name: agent?.name,
        image_url: imageBase64, platform,
        generated_copy: data.creator.generated_copy, final_copy: data.creator.generated_copy,
        hashtags: data.creator.hashtags ?? [], ai_rationale: data.creator.rationale ?? '',
        supervisor_score: data.supervisor.score ?? 5,
        supervisor_validation: data.supervisor.clause_validations ?? [],
        critical_violations: data.supervisor.critical_violations ?? 0,
        suggested_fix: data.supervisor.suggested_fix ?? null,
        scheduled_date: '', status: (data.supervisor.critical_violations ?? 0) > 2 ? 'supervisor_review' : 'pm_review',
        context_used: data.context, created_at: new Date().toISOString(),
      }
      addPost(post)
      setResult({ score: post.supervisor_score, context: data.context, agent: agent?.name })
      setImageBase64(null); setImageName('')
      if (fileRef.current) fileRef.current.value = ''
    } catch { setError('Error de red.') }
    finally { setLoading(false) }
  }

  if (!brand) return (
    <div className="flex flex-col items-center justify-center py-24 text-[#666]">
      <Zap size={32} className="mb-3 opacity-20" />
      <p className="text-sm mb-3">Seleccioná un cliente en el sidebar para comenzar</p>
      <a href="/dashboard/brands" className="btn btn-primary text-sm">Configurar cliente →</a>
    </div>
  )

  const hasContext = (brand.news_keywords?.length ?? 0) > 0 || (brand.rss_feeds?.length ?? 0) > 0 || (brand.competitors?.length ?? 0) > 0

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-2 mb-8">
        <Zap size={18} className="text-[#5b6ef5]" />
        <h1 className="text-xl font-semibold text-white">Generar Contenido</h1>
        <span className="text-sm text-[#666]">— {brand.name}</span>
      </div>

      <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-6 space-y-5">
        <AgentSelector agents={agents} selectedId={agentId} onChange={setAgentId} />

        {/* Context indicator */}
        <div className={`flex items-start gap-2 rounded-lg p-3 text-xs ${hasContext ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'}`}>
          <Database size={14} className="mt-0.5 shrink-0" />
          <div>
            {hasContext
              ? <><span className="font-medium">Contexto real configurado</span> — {[(brand.news_keywords?.length ?? 0) > 0 && `${brand.news_keywords.length} keywords`, (brand.competitors?.length ?? 0) > 0 && `${brand.competitors.length} competidores`].filter(Boolean).join(', ')}</>
              : <><span className="font-medium">Sin contexto de mercado</span> — <a href="/dashboard/brands" className="underline">Configurar →</a></>
            }
          </div>
        </div>

        {/* Platform */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-[#666] uppercase tracking-wider">Plataforma</label>
          <div className="flex gap-2 flex-wrap">
            {PLATFORMS.map(p => (
              <button key={p} onClick={() => setPlatform(p)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-all font-mono capitalize ${platform === p ? 'bg-[#5b6ef5] text-white border-[#5b6ef5]' : 'border-[#2a2a2a] text-[#666] hover:border-[#3a3a3a] hover:text-[#a1a1a1]'}`}>
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Image upload */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-[#666] uppercase tracking-wider">Imagen</label>
          <div onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${imageBase64 ? 'border-[#5b6ef5] bg-[#5b6ef5]/5' : 'border-[#2a2a2a] hover:border-[#3a3a3a]'}`}>
            {imageBase64 ? (
              <div className="space-y-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageBase64} alt="preview" className="max-h-40 mx-auto rounded-lg object-contain" />
                <p className="text-xs text-[#5b6ef5] font-medium">{imageName}</p>
              </div>
            ) : (
              <div className="space-y-2">
                <ImagePlus size={32} className="mx-auto text-[#333]" />
                <p className="text-sm text-[#666]">Clic para subir imagen</p>
                <p className="text-xs text-[#444]">JPG, PNG, WebP hasta 10MB</p>
              </div>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
        </div>

        {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}

        {result && (
          <div className="space-y-2 fade-up">
            <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
              <CheckCircle2 size={16} />
              Post generado · Score {result.score}/10{result.agent ? ` · ${result.agent}` : ''} · <a href="/dashboard/inbox" className="underline">Ver en Bandeja →</a>
            </div>
            {result.context.sources.length > 0 && (
              <div className="flex items-start gap-2 text-xs bg-[#5b6ef5]/10 border border-[#5b6ef5]/20 rounded-lg px-3 py-2 text-[#5b6ef5]">
                <Info size={13} className="mt-0.5 shrink-0" />
                <span>Contexto: {result.context.news_count} noticias, {result.context.rss_count} RSS, {result.context.competitor_ads_count} ads competidores</span>
              </div>
            )}
          </div>
        )}

        <button onClick={generate} disabled={loading || !imageBase64}
          className="btn btn-primary w-full justify-center disabled:opacity-40">
          {loading ? <><Loader2 size={16} className="animate-spin" /> Generando...</> : <><Zap size={16} /> Generar Copy</>}
        </button>
      </div>
    </div>
  )
}
