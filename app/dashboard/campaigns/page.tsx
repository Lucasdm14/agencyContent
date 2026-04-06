'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Megaphone, Trash2, ChevronRight, ThumbsUp, ThumbsDown } from 'lucide-react'
import type { Campaign } from '@/lib/types'
import { getCampaigns, deleteCampaign } from '@/lib/storage'
import { useBrand } from '@/lib/hooks/useBrand'

export default function CampaignsPage() {
  const { brand, brands, selectBrand } = useBrand()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [filter,    setFilter]    = useState<'all' | 'draft' | 'publishing' | 'done'>('all')
  const router = useRouter()

  useEffect(() => {
    const all = getCampaigns()
    setCampaigns(brand ? all.filter(c => c.brand_id === brand.id) : all)
  }, [brand?.id])

  function remove(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('¿Eliminar esta campaña?')) return
    deleteCampaign(id); setCampaigns(getCampaigns())
  }

  const filtered = campaigns.filter(c => filter === 'all' || c.status === filter)
  const counts   = { all: campaigns.length, draft: campaigns.filter(c => c.status === 'draft').length, publishing: campaigns.filter(c => c.status === 'publishing').length, done: campaigns.filter(c => c.status === 'done').length }

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1"><Megaphone size={18} className="text-[#5b6ef5]" /><h1 className="text-xl font-semibold text-white">Campañas</h1></div>
        <p className="text-xs text-[#666]">Estrategias aprobadas. Hacé clic para editar, agendar y publicar.</p>
      </div>
        {brands.length > 1 && (
          <select value={brand?.id ?? ''} onChange={e => selectBrand(e.target.value)}
            className="input text-sm py-1.5 px-3 w-44">
            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}

      {campaigns.length === 0 ? (
        <div className="border-2 border-dashed border-[#2a2a2a] rounded-2xl p-16 text-center">
          <Megaphone size={32} className="mx-auto mb-4 text-[#333]" />
          <p className="text-base font-medium text-[#444] mb-1">Sin campañas</p>
          <p className="text-sm text-[#333] mb-5">Generá una estrategia y finalizala.</p>
          <a href="/dashboard/strategy" className="btn btn-primary mx-auto">Crear estrategia →</a>
        </div>
      ) : (
        <>
          <div className="tab-bar w-fit mb-6">
            {([['all','Todas'],['draft','Borrador'],['publishing','En progreso'],['done','Completadas']] as const).map(([key, label]) => (
              <button key={key} onClick={() => setFilter(key)} className={`tab ${filter === key ? 'active' : ''}`}>
                {label} {counts[key] > 0 && <span className="ml-1 text-2xs bg-[#3a3a3a] px-1.5 py-0.5 rounded">{counts[key]}</span>}
              </button>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map(c => {
              const published = c.posts.filter(p => p.status === 'published' || p.status === 'scheduled').length
              const pct       = Math.round((published / c.posts.length) * 100)
              const scoreColor = c.overall_score >= 8 ? 'text-emerald-400' : c.overall_score >= 6 ? 'text-amber-400' : 'text-red-400'
              return (
                <div key={c.id} onClick={() => router.push(`/dashboard/campaigns/${c.id}`)}
                  className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-5 hover:border-[#3a3a3a] cursor-pointer transition-all group">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-white">{c.brand_name}</p>
                      <p className="text-sm text-[#666] mt-0.5">{c.period_label}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className={`text-2xl font-bold font-mono ${scoreColor}`}>{c.overall_score}<span className="text-xs text-[#444] font-normal">/10</span></p>
                      <button onClick={e => remove(c.id, e)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-red-500/10 text-[#444] hover:text-red-400 transition-all"><Trash2 size={13} /></button>
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-[#666] mb-1.5"><span>{published}/{c.posts.length} posts</span><span>{pct}%</span></div>
                    <div className="h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
                      <div className="h-full bg-[#5b6ef5] rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>

                  {(c.strengths.length > 0 || c.weaknesses.length > 0) && (
                    <div className="space-y-1 mb-3">
                      {c.strengths.slice(0,1).map((s,i) => <div key={i} className="flex items-start gap-1.5 text-xs"><ThumbsUp size={10} className="text-emerald-400 shrink-0 mt-0.5" /><span className="text-[#666] truncate">{s}</span></div>)}
                      {c.weaknesses.slice(0,1).map((w,i) => <div key={i} className="flex items-start gap-1.5 text-xs"><ThumbsDown size={10} className="text-amber-400 shrink-0 mt-0.5" /><span className="text-[#666] truncate">{w}</span></div>)}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-[#444]">
                    <span>{new Date(c.created_at).toLocaleDateString('es-AR')}</span>
                    <span className="flex items-center gap-1 text-[#5b6ef5] font-medium">Ver y publicar <ChevronRight size={12} /></span>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
