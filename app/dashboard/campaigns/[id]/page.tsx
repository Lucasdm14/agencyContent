'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Megaphone, ChevronLeft, Edit2, Save, X, Send, Loader2,
  CheckCircle2, AlertCircle, Hash, FileText, Clock,
} from 'lucide-react'
import type { Campaign, CampaignPost, SocialAccount, Script } from '@/lib/types'
import { getCampaigns, upsertCampaign, getBrandSocialAccounts } from '@/lib/storage'

const FORMAT_CLASSES: Record<string, string> = {
  reel: 'badge-reel', story: 'badge-story', carousel: 'badge-carousel',
  post: 'badge-post', video: 'badge-video', live: 'badge-live',
}

const STATUS_CONFIG = {
  draft:     { label: 'Borrador',  cls: 'text-[#666] bg-[#1a1a1a] border-[#2a2a2a]' },
  scheduled: { label: 'Agendado', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  published: { label: 'Publicado',cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  failed:    { label: 'Error',    cls: 'text-red-400 bg-red-500/10 border-red-500/20' },
}

function ScriptViewer({ script }: { script: Script }) {
  return (
    <details className="mt-3">
      <summary className="text-xs text-[#5b6ef5] cursor-pointer hover:underline flex items-center gap-1 list-none">
        <FileText size={11} /> Ver guión completo ({script.total_duration_sec}s)
      </summary>
      <div className="mt-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3 space-y-3">
        {script.voiceover_full && (
          <div>
            <p className="text-2xs text-[#666] mb-1 uppercase tracking-wider">Guión de voz</p>
            <p className="text-xs text-[#a1a1a1] italic leading-relaxed">"{script.voiceover_full}"</p>
          </div>
        )}
        {script.music_mood && <p className="text-2xs text-[#444]">🎵 Música: {script.music_mood}</p>}
        <div className="space-y-2">
          {script.scenes?.map(sc => (
            <div key={sc.order} className="border border-[#2a2a2a] rounded-lg p-2.5 space-y-1">
              <p className="text-2xs font-mono text-[#5b6ef5]">Escena {sc.order} · {sc.duration_sec}s</p>
              <p className="text-xs text-[#a1a1a1]">🎬 {sc.visual}</p>
              {sc.text_overlay && <p className="text-xs text-white font-medium">📝 "{sc.text_overlay}"</p>}
              {sc.voiceover   && <p className="text-xs text-[#666] italic">🎙 {sc.voiceover}</p>}
              {sc.cta         && <p className="text-xs text-[#5b6ef5]">→ CTA: {sc.cta}</p>}
            </div>
          ))}
        </div>
      </div>
    </details>
  )
}

function PostEditor({ post, accounts, onSave }: {
  post: CampaignPost; accounts: SocialAccount[]; onSave: (p: CampaignPost) => void
}) {
  const [editing,    setEditing]    = useState(false)
  const [copy,       setCopy]       = useState(post.copy)
  const [hashtags,   setHashtags]   = useState(post.hashtags.join(' '))
  const [keywords,   setKeywords]   = useState(post.keywords?.join(', ') ?? '')
  const [schedAt,    setSchedAt]    = useState(post.scheduled_at ?? '')
  const [publishing, setPublishing] = useState(false)
  const [msg,        setMsg]        = useState('')

  const acct      = accounts.find(a => a.platform === post.platform)
  const statusCfg = STATUS_CONFIG[post.status]
  const isPublished = post.status === 'published'

  function saveEdit() {
    onSave({ ...post, copy, hashtags: hashtags.split(/\s+/).filter(h => h.startsWith('#')), keywords: keywords.split(',').map(k => k.trim()).filter(Boolean), scheduled_at: schedAt || undefined })
    setEditing(false)
  }

  async function publish() {
    if (!schedAt) { setMsg('Seleccioná fecha y hora'); return }
    setPublishing(true); setMsg('')
    try {
      const payload = { platform: post.platform, copy, hashtags: post.hashtags, scheduled_at: schedAt, post_id: post.id, handle: acct?.handle ?? '', page_id: acct?.page_id, access_token: acct?.access_token }
      if (acct?.webhook_url) {
        await fetch(acct.webhook_url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(10_000) })
        onSave({ ...post, status: 'scheduled', scheduled_at: schedAt }); setMsg('✓ Enviado al webhook'); return
      }
      const res  = await fetch('/api/publish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) { onSave({ ...post, status: 'failed', error_msg: data.error }); setMsg(`Error: ${data.error}`); return }
      onSave({ ...post, status: data.scheduled ? 'scheduled' : 'published', scheduled_at: schedAt }); setMsg('✓ Publicado')
    } catch (e) { setMsg(`Error: ${e instanceof Error ? e.message : 'desconocido'}`) }
    finally { setPublishing(false) }
  }

  return (
    <div className={`bg-[#161616] border rounded-xl overflow-hidden transition-colors ${post.status === 'failed' ? 'border-red-500/30' : 'border-[#2a2a2a] hover:border-[#3a3a3a]'}`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-[#1a1a1a] border-b border-[#2a2a2a]">
        <span className="text-xs font-mono text-[#444]">Día {post.day}</span>
        <span className="text-xs font-semibold text-[#5b6ef5] capitalize">{post.platform}</span>
        {post.format && <span className={`text-2xs px-1.5 py-0.5 rounded border ${FORMAT_CLASSES[post.format] ?? 'badge-post'}`}>{post.format}</span>}
        <span className="text-xs text-[#666] flex-1 truncate">{post.topic}</span>
        <span className={`text-2xs px-2 py-0.5 rounded border ${statusCfg.cls}`}>{statusCfg.label}</span>
      </div>

      <div className="p-4 space-y-3">
        {editing ? (
          <div className="space-y-2">
            <textarea value={copy} onChange={e => setCopy(e.target.value)} rows={5} className="input resize-none" />
            <input value={hashtags} onChange={e => setHashtags(e.target.value)} placeholder="#hashtag1 #hashtag2" className="input font-mono text-xs" />
            <input value={keywords} onChange={e => setKeywords(e.target.value)} placeholder="keyword1, keyword2, keyword3" className="input text-xs" />
          </div>
        ) : (
          <div>
            <p className="text-sm text-[#a1a1a1] leading-relaxed whitespace-pre-wrap">{post.copy}</p>
            {post.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {post.hashtags.map((h, i) => <span key={i} className="text-2xs font-mono text-[#5b6ef5] bg-[#5b6ef5]/10 border border-[#5b6ef5]/20 px-1.5 py-0.5 rounded">{h}</span>)}
              </div>
            )}
            {post.keywords?.length > 0 && (
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <Hash size={10} className="text-[#444]" />
                {post.keywords.map((k, i) => <span key={i} className="text-2xs text-[#666] bg-[#2a2a2a] px-1.5 py-0.5 rounded">{k}</span>)}
              </div>
            )}
          </div>
        )}

        {post.visual_direction && <p className="text-2xs text-[#444] border-l-2 border-[#2a2a2a] pl-2 italic">🎨 {post.visual_direction}</p>}
        {post.script && <ScriptViewer script={post.script} />}

        {!isPublished && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-2xs text-[#666] mb-1.5 flex items-center gap-1"><Clock size={9} /> Fecha y hora</label>
              <input type="datetime-local" value={schedAt} onChange={e => setSchedAt(e.target.value)} className="input text-xs" />
            </div>
            <div>
              <label className="block text-2xs text-[#666] mb-1.5">Cuenta</label>
              {acct ? (
                <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2.5 py-2 text-xs text-[#666]">
                  @{acct.handle} {(acct.access_token || acct.webhook_url) ? <span className="text-emerald-400">✓</span> : <span className="text-amber-400">sin creds</span>}
                </div>
              ) : (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded px-2.5 py-2 text-2xs text-amber-400">
                  Sin cuenta. <a href="/dashboard/social" className="underline">Configurar →</a>
                </div>
              )}
            </div>
          </div>
        )}

        {msg && <p className={`text-xs rounded px-3 py-2 ${msg.startsWith('✓') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>{msg}</p>}
        {post.error_msg && !msg && <p className="text-xs rounded px-3 py-2 bg-red-500/10 text-red-400 border border-red-500/20">{post.error_msg}</p>}

        {!isPublished && (
          <div className="flex gap-2">
            {editing ? (
              <>
                <button onClick={() => setEditing(false)} className="btn btn-secondary text-xs"><X size={11} /> Cancelar</button>
                <button onClick={saveEdit} className="btn btn-secondary text-xs"><Save size={11} /> Guardar</button>
              </>
            ) : (
              <>
                <button onClick={() => setEditing(true)} className="btn btn-secondary text-xs"><Edit2 size={11} /> Editar</button>
                <button onClick={publish} disabled={publishing || !schedAt} className="btn btn-primary text-xs ml-auto disabled:opacity-40">
                  {publishing ? <><Loader2 size={11} className="animate-spin" /> Enviando...</> : <><Send size={11} /> Publicar</>}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function CampaignDetailPage() {
  const params = useParams(); const router = useRouter()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [accounts, setAccounts] = useState<SocialAccount[]>([])

  useEffect(() => {
    const found = getCampaigns().find(c => c.id === params.id)
    if (found) { setCampaign(found); setAccounts(getBrandSocialAccounts(found.brand_id)) }
  }, [params.id])

  function updatePost(updated: CampaignPost) {
    if (!campaign) return
    const posts    = campaign.posts.map(p => p.id === updated.id ? updated : p)
    const allDone  = posts.every(p => p.status === 'published' || p.status === 'scheduled')
    const next     = { ...campaign, posts, status: allDone ? 'done' as const : 'publishing' as const }
    setCampaign(next); upsertCampaign(next)
  }

  if (!campaign) return (
    <div className="flex items-center justify-center py-24 text-[#666]">
      <AlertCircle size={18} className="mr-2" /> Campaña no encontrada
    </div>
  )

  const published  = campaign.posts.filter(p => p.status === 'published' || p.status === 'scheduled').length
  const pct        = Math.round((published / campaign.posts.length) * 100)
  const scoreColor = campaign.overall_score >= 8 ? 'text-emerald-400' : campaign.overall_score >= 6 ? 'text-amber-400' : 'text-red-400'

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push('/dashboard/campaigns')} className="btn btn-secondary p-2"><ChevronLeft size={16} /></button>
        <div>
          <div className="flex items-center gap-2">
            <Megaphone size={16} className="text-[#5b6ef5]" />
            <h1 className="text-xl font-semibold text-white">{campaign.brand_name}</h1>
            <span className="text-[#444]">·</span>
            <span className="text-[#666]">{campaign.period_label}</span>
          </div>
          <p className="text-xs text-[#444] mt-0.5">
            {campaign.estratega_name} · {campaign.supervisor_name} · {new Date(campaign.created_at).toLocaleDateString('es-AR')}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="metric-card"><p className="text-xs text-[#666] mb-1">Score</p><p className={`text-3xl font-bold font-mono ${scoreColor}`}>{campaign.overall_score}<span className="text-sm text-[#444] font-normal">/10</span></p></div>
        <div className="metric-card"><p className="text-xs text-[#666] mb-1">Formatos</p><p className={`text-3xl font-bold font-mono ${scoreColor}`}>{campaign.format_score}<span className="text-sm text-[#444] font-normal">/10</span></p></div>
        <div className="metric-card"><p className="text-xs text-[#666] mb-1">Total posts</p><p className="text-3xl font-bold font-mono text-white">{campaign.posts.length}</p></div>
        <div className="metric-card">
          <p className="text-xs text-[#666] mb-2">Progreso</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-[#2a2a2a] rounded-full overflow-hidden">
              <div className="h-full bg-[#5b6ef5] rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-sm font-bold font-mono text-white">{pct}%</span>
          </div>
        </div>
      </div>

      {(campaign.strengths.length > 0 || campaign.weaknesses.length > 0) && (
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
            <p className="text-xs font-semibold text-emerald-400 mb-2">👍 Fortalezas</p>
            {campaign.strengths.map((s,i) => <p key={i} className="text-xs text-emerald-300/70">• {s}</p>)}
          </div>
          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
            <p className="text-xs font-semibold text-red-400 mb-2">⚠️ Áreas de mejora</p>
            {campaign.weaknesses.map((w,i) => <p key={i} className="text-xs text-red-300/70">• {w}</p>)}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {campaign.posts.sort((a, b) => a.day - b.day).map(post => (
          <PostEditor key={post.id} post={post} accounts={accounts} onSave={updatePost} />
        ))}
      </div>
    </div>
  )
}
