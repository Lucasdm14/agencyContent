'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Users, Plus, Trash2, Edit2, Save, X, ChevronDown, ChevronUp,
  Globe, Bot, Upload, FileText, Image as ImageIcon, Link, Loader2,
  CheckCircle2, RefreshCw, Sparkles,
} from 'lucide-react'
import type { Brand, BrandbookRules, CompetitorHandle, BrandImage, BrandAssets } from '@/lib/types'
import { getBrands, upsertBrand, deleteBrand, getBrandAgents } from '@/lib/storage'

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_BB: BrandbookRules = {
  tone: { voice: 'profesional', pronouns: 'vos', examples_good: [], examples_bad: [] },
  emojis: { allowed: true, max_per_post: 3, banned_list: [] },
  hashtags: { always_include: [], banned: [], max_count: 5 },
  content_rules: [],
}

const DEFAULT_ASSETS: BrandAssets = {
  drive_folder_url: '',
  drive_images:     [],
  uploaded_images:  [],
  manual_url:       '',
  manual_base64:    '',
  use_ai_matching:  false,
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ChipInput({ label, values, onChange, placeholder }: {
  label: string; values: string[]; onChange: (v: string[]) => void; placeholder?: string
}) {
  const [input, setInput] = useState('')
  function add() {
    const v = input.trim()
    if (v && !values.includes(v)) { onChange([...values, v]); setInput('') }
  }
  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-[#666] uppercase tracking-wider">{label}</label>
      <div className="flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder={placeholder ?? 'Escribí y Enter'}
          className="input flex-1" />
        <button type="button" onClick={add}
          className="border border-[#2a2a2a] bg-[#1a1a1a] rounded-lg px-3 py-2 hover:bg-[#2a2a2a] transition text-[#666] hover:text-white">
          <Plus size={14} />
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v, i) => (
          <span key={i} className="flex items-center gap-1 text-xs bg-[#2a2a2a] text-[#a1a1a1] rounded-full px-2.5 py-0.5">
            {v}
            <button onClick={() => onChange(values.filter((_, j) => j !== i))} className="text-[#666] hover:text-white">
              <X size={9} />
            </button>
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── Asset Bank ───────────────────────────────────────────────────────────────

function AssetBank({ assets, onChange }: { assets: BrandAssets; onChange: (a: BrandAssets) => void }) {
  const [driveUrl,     setDriveUrl]     = useState(assets.drive_folder_url ?? '')
  const [loadingDrive, setLoadingDrive] = useState(false)
  const [driveError,   setDriveError]   = useState('')
  const uploadRef = useRef<HTMLInputElement>(null)
  const manualRef = useRef<HTMLInputElement>(null)

  const allImages = [...(assets.uploaded_images ?? []), ...(assets.drive_images ?? [])]

  async function fetchDrive() {
    if (!driveUrl.trim()) return
    setLoadingDrive(true); setDriveError('')
    try {
      const res  = await fetch('/api/brand/assets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_url: driveUrl.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setDriveError(data.error ?? 'Error al conectar Drive'); return }
      const driveImages: BrandImage[] = data.files.map((f: { id: string; name: string; mimeType: string; viewUrl: string }) => ({
        id: f.id, name: f.name, url: f.viewUrl,
        source: 'drive' as const, mime_type: f.mimeType,
        created_at: new Date().toISOString(),
      }))
      onChange({ ...assets, drive_folder_url: driveUrl.trim(), drive_images: driveImages })
    } catch { setDriveError('Error de red') }
    finally { setLoadingDrive(false) }
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    files.forEach(file => {
      if (file.size > 5 * 1024 * 1024) { alert(`${file.name} supera 5MB`); return }
      const reader = new FileReader()
      reader.onload = () => {
        const img: BrandImage = {
          id: crypto.randomUUID(), name: file.name, url: reader.result as string,
          source: 'upload', mime_type: file.type, created_at: new Date().toISOString(),
        }
        onChange({ ...assets, uploaded_images: [...(assets.uploaded_images ?? []), img] })
      }
      reader.readAsDataURL(file)
    })
    if (uploadRef.current) uploadRef.current.value = ''
  }

  function handleManual(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = () => onChange({ ...assets, manual_base64: reader.result as string, manual_url: file.name })
    reader.readAsDataURL(file)
    if (manualRef.current) manualRef.current.value = ''
  }

  function removeImage(id: string) {
    onChange({
      ...assets,
      uploaded_images: (assets.uploaded_images ?? []).filter(i => i.id !== id),
      drive_images:    (assets.drive_images    ?? []).filter(i => i.id !== id),
    })
  }

  return (
    <div className="space-y-5">
      <p className="text-xs text-[#666] bg-[#5b6ef5]/10 border border-[#5b6ef5]/20 rounded-lg p-3 leading-relaxed">
        El banco de imágenes se usa al generar copies: la IA propone la imagen más relevante o el PM la elige manualmente.
        Podés subir imágenes directamente o conectar una carpeta de Google Drive pública.
      </p>

      {/* AI toggle */}
      <div className="flex items-center justify-between bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className={assets.use_ai_matching ? 'text-[#5b6ef5]' : 'text-[#444]'} />
          <div>
            <p className="text-sm font-medium text-white">Selección de imagen con IA</p>
            <p className="text-xs text-[#666]">La IA elige la imagen más relevante según el tema del post</p>
          </div>
        </div>
        <button onClick={() => onChange({ ...assets, use_ai_matching: !assets.use_ai_matching })}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${assets.use_ai_matching ? 'bg-[#5b6ef5]' : 'bg-[#2a2a2a]'}`}>
          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${assets.use_ai_matching ? 'translate-x-4' : 'translate-x-1'}`} />
        </button>
      </div>

      {/* Manual de marca */}
      <div>
        <label className="block text-xs font-medium text-[#666] uppercase tracking-wider mb-2">Manual de marca / Logo</label>
        {assets.manual_base64 ? (
          <div className="flex items-center gap-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2">
            {assets.manual_base64.startsWith('data:image')
              ? <img src={assets.manual_base64} alt="manual" className="h-8 w-8 object-contain rounded" /> // eslint-disable-line @next/next/no-img-element
              : <FileText size={16} className="text-[#666]" />
            }
            <span className="text-xs text-[#a1a1a1] truncate flex-1">{assets.manual_url}</span>
            <button onClick={() => onChange({ ...assets, manual_base64: '', manual_url: '' })}>
              <X size={13} className="text-[#444] hover:text-red-400 transition" />
            </button>
          </div>
        ) : (
          <button onClick={() => manualRef.current?.click()}
            className="flex items-center gap-2 border border-dashed border-[#3a3a3a] rounded-lg px-4 py-2.5 hover:border-[#5b6ef5] hover:bg-[#5b6ef5]/5 transition text-sm text-[#666] hover:text-[#5b6ef5]">
            <Upload size={14} /> Subir logo o manual (PDF / imagen)
          </button>
        )}
        <input ref={manualRef} type="file" accept="image/*,.pdf" onChange={handleManual} className="hidden" />
      </div>

      {/* Drive */}
      <div>
        <label className="block text-xs font-medium text-[#666] uppercase tracking-wider mb-2 flex items-center gap-1">
          <Link size={11} /> Carpeta Google Drive (pública)
        </label>
        <div className="flex gap-2">
          <input value={driveUrl} onChange={e => setDriveUrl(e.target.value)}
            placeholder="https://drive.google.com/drive/folders/..."
            className="input flex-1 font-mono text-xs" />
          <button onClick={fetchDrive} disabled={!driveUrl.trim() || loadingDrive}
            className="btn btn-secondary text-xs disabled:opacity-40">
            {loadingDrive ? <><Loader2 size={12} className="animate-spin" /> Cargando...</> : <><RefreshCw size={12} /> Sincronizar</>}
          </button>
        </div>
        {driveError && <p className="text-xs text-red-400 mt-1">{driveError}</p>}
        {(assets.drive_images?.length ?? 0) > 0 && (
          <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
            <CheckCircle2 size={11} /> {assets.drive_images!.length} imágenes sincronizadas desde Drive
          </p>
        )}
        <p className="text-2xs text-[#444] mt-1">Requiere GOOGLE_API_KEY en Vercel. La carpeta debe estar compartida como "Cualquiera con el enlace".</p>
      </div>

      {/* Upload */}
      <div>
        <label className="block text-xs font-medium text-[#666] uppercase tracking-wider mb-2 flex items-center gap-1">
          <ImageIcon size={11} /> Subir imágenes directamente
        </label>
        <button onClick={() => uploadRef.current?.click()}
          className="flex items-center gap-2 border border-dashed border-[#3a3a3a] rounded-lg px-4 py-3 hover:border-[#5b6ef5] hover:bg-[#5b6ef5]/5 transition text-sm text-[#666] hover:text-[#5b6ef5] w-full justify-center">
          <Upload size={14} /> Subir fotos del cliente (JPG, PNG, WebP — máx 5MB c/u)
        </button>
        <input ref={uploadRef} type="file" accept="image/*" multiple onChange={handleUpload} className="hidden" />
      </div>

      {/* Image grid */}
      {allImages.length > 0 && (
        <div>
          <p className="text-xs font-medium text-[#666] uppercase tracking-wider mb-2">
            Banco de imágenes ({allImages.length})
          </p>
          <div className="grid grid-cols-5 gap-2">
            {allImages.map(img => (
              <div key={img.id} className="relative group rounded-lg overflow-hidden border border-[#2a2a2a] aspect-square bg-[#1a1a1a]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.name} className="w-full h-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center">
                  <button onClick={() => removeImage(img.id)}
                    className="opacity-0 group-hover:opacity-100 bg-red-600 text-white rounded-full p-1 transition-all">
                    <X size={11} />
                  </button>
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-all">
                  <p className="text-2xs text-white truncate">{img.name}</p>
                </div>
                {img.source === 'drive' && (
                  <div className="absolute top-1 right-1">
                    <span className="text-2xs bg-[#5b6ef5] text-white px-1 py-0.5 rounded">Drive</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Competitor add ───────────────────────────────────────────────────────────

function CompetitorAdd({ onAdd }: { onAdd: (c: CompetitorHandle) => void }) {
  const [name,   setName]   = useState('')
  const [fb,     setFb]     = useState('')
  const [ig,     setIg]     = useState('')
  function add() {
    if (!name.trim()) return
    onAdd({ name: name.trim(), facebook_page_name: fb.trim() || undefined, instagram_handle: ig.trim() || undefined })
    setName(''); setFb(''); setIg('')
  }
  return (
    <div className="grid grid-cols-3 gap-2">
      <input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre *" className="input" />
      <input value={ig}   onChange={e => setIg(e.target.value)}   placeholder="@instagram" className="input" />
      <div className="flex gap-1.5">
        <input value={fb}  onChange={e => setFb(e.target.value)}  placeholder="Facebook Page" className="input flex-1" />
        <button onClick={add} disabled={!name.trim()}
          className="border border-[#2a2a2a] rounded-lg px-2.5 hover:bg-[#2a2a2a] transition disabled:opacity-40 text-[#666]">
          <Plus size={14} />
        </button>
      </div>
    </div>
  )
}

// ─── Brand Form ───────────────────────────────────────────────────────────────

function BrandForm({ brand, onSave, onCancel }: {
  brand?: Brand; onSave: (b: Brand) => void; onCancel: () => void
}) {
  const [name,            setName]            = useState(brand?.name ?? '')
  const [industry,        setIndustry]        = useState(brand?.industry ?? '')
  const [audience,        setAudience]        = useState(brand?.target_audience ?? '')
  const [instagramHandle, setInstagramHandle] = useState(brand?.instagram_handle?.replace('@', '') ?? '')
  const [webhook,         setWebhook]         = useState(brand?.webhook_url ?? '')
  const [brandPrompt,     setBrandPrompt]     = useState(brand?.brand_prompt ?? '')
  const [brandAssets,     setBrandAssets]     = useState<BrandAssets>(brand?.brand_assets ?? { ...DEFAULT_ASSETS })
  const [newsKeywords,    setNewsKeywords]    = useState<string[]>(brand?.news_keywords ?? [])
  const [competitors,     setCompetitors]     = useState<CompetitorHandle[]>(brand?.competitors ?? [])
  const [rssFeeds,        setRssFeeds]        = useState<string[]>(brand?.rss_feeds ?? [])
  const [bb,              setBb]              = useState<BrandbookRules>(brand?.brandbook_rules ?? { ...DEFAULT_BB })
  const [showBb,          setShowBb]          = useState(false)
  const [showContext,     setShowContext]      = useState(false)
  const [showAssets,      setShowAssets]      = useState(true)
  const [showPrompt,      setShowPrompt]      = useState(true)
  const importRef = useRef<HTMLInputElement>(null)

  function updateBb(path: string[], value: unknown) {
    setBb(prev => {
      const next = JSON.parse(JSON.stringify(prev))
      let obj: Record<string, unknown> = next
      for (let i = 0; i < path.length - 1; i++) obj = obj[path[i]] as Record<string, unknown>
      obj[path[path.length - 1]] = value
      return next
    })
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const text = reader.result as string
        if (file.name.endsWith('.csv')) { setBrandPrompt(text); return }
        const data = JSON.parse(text)
        const d = Array.isArray(data) ? data[0] : data
        if (d.name)              setName(d.name)
        if (d.industry)          setIndustry(d.industry)
        if (d.brand_prompt)      setBrandPrompt(d.brand_prompt)
        if (d.instagram_handle)  setInstagramHandle(d.instagram_handle.replace('@',''))
        if (d.news_keywords)     setNewsKeywords(d.news_keywords)
        if (d.brandbook_rules)   setBb(d.brandbook_rules)
      } catch { alert('Error al leer el archivo') }
    }
    reader.readAsText(file)
    if (importRef.current) importRef.current.value = ''
  }

  function save() {
    if (!name.trim()) return
    onSave({
      id:               brand?.id ?? crypto.randomUUID(),
      name,
      industry,
      target_audience:  audience,
      instagram_handle: instagramHandle.trim() ? `@${instagramHandle.trim().replace('@','')}` : '',
      brandbook_rules:  bb,
      brand_prompt:     brandPrompt,
      brand_assets:     brandAssets,
      webhook_url:      webhook,
      news_keywords:    newsKeywords,
      competitors,
      rss_feeds:        rssFeeds,
      created_at:       brand?.created_at ?? new Date().toISOString(),
    })
  }

  function Section({ title, open, onToggle, accent, children }: {
    title: React.ReactNode; open: boolean; onToggle: () => void; accent?: boolean; children: React.ReactNode
  }) {
    return (
      <div className={`border rounded-xl overflow-hidden ${accent ? 'border-[#5b6ef5]/30' : 'border-[#2a2a2a]'}`}>
        <button onClick={onToggle}
          className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors ${accent ? 'bg-[#5b6ef5]/10 hover:bg-[#5b6ef5]/15 text-[#5b6ef5]' : 'bg-[#1a1a1a] hover:bg-[#222] text-[#a1a1a1]'}`}>
          {title}
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {open && <div className="p-4 border-t border-[#2a2a2a] space-y-4 bg-[#161616]">{children}</div>}
      </div>
    )
  }

  return (
    <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">{brand ? `Editando: ${brand.name}` : 'Nuevo cliente'}</h3>
        <div className="flex gap-2">
          <button onClick={() => importRef.current?.click()} className="btn btn-secondary text-xs">
            <Upload size={11} /> Importar JSON/CSV
          </button>
          <input ref={importRef} type="file" accept=".json,.csv" onChange={handleImport} className="hidden" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-[#666] mb-1.5">Nombre *</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Marca XYZ" className="input" />
        </div>
        <div>
          <label className="block text-xs text-[#666] mb-1.5">Rubro</label>
          <input value={industry} onChange={e => setIndustry(e.target.value)} placeholder="Gastronomía" className="input" />
        </div>
      </div>

      <div>
        <label className="block text-xs text-[#666] mb-1.5">Audiencia general</label>
        <input value={audience} onChange={e => setAudience(e.target.value)} placeholder="Adultos 25-45..." className="input" />
      </div>

      {/* Instagram handle — links to Metrics + Strategy */}
      <div>
        <label className="block text-xs text-[#666] mb-1.5">Instagram handle</label>
        <div className="flex items-center border border-[#2a2a2a] bg-[#1e1e1e] rounded-lg overflow-hidden focus-within:border-[#5b6ef5] focus-within:ring-1 focus-within:ring-[#5b6ef5]/20">
          <span className="px-3 py-2 text-sm text-[#444] border-r border-[#2a2a2a]">@</span>
          <input value={instagramHandle} onChange={e => setInstagramHandle(e.target.value.replace('@', ''))}
            placeholder="usuario" className="flex-1 px-3 py-2 text-sm outline-none bg-transparent text-white placeholder-[#444]" />
        </div>
        <p className="text-2xs text-[#444] mt-1">Se usa para cargar métricas automáticamente en Estrategia y Métricas.</p>
      </div>

      <div>
        <label className="block text-xs text-[#666] mb-1.5">Webhook URL (Zapier/Make)</label>
        <input value={webhook} onChange={e => setWebhook(e.target.value)}
          placeholder="https://hooks.zapier.com/..." className="input font-mono text-xs" />
      </div>

      {/* Brand Prompt */}
      <Section title={<span className="flex items-center gap-2"><FileText size={13} /> Prompt de la marca ★</span>} open={showPrompt} onToggle={() => setShowPrompt(v => !v)} accent>
        <p className="text-xs text-[#666] leading-relaxed">
          Contexto maestro inyectado en todos los agentes. Incluí misión, valores, colores, voz, productos, diferenciadores, restricciones, etc.
        </p>
        <textarea value={brandPrompt} onChange={e => setBrandPrompt(e.target.value)} rows={10}
          placeholder="MISIÓN: ...\nVALORES: ...\nCOLORES: ...\nVOZ: ...\nPRODUCTOS: ..."
          className="input resize-y font-mono text-xs" />
        <p className="text-2xs text-[#444]">{brandPrompt.length} caracteres</p>
      </Section>

      {/* Assets */}
      <Section title={<span className="flex items-center gap-2"><ImageIcon size={13} /> Banco de imágenes y assets visuales</span>} open={showAssets} onToggle={() => setShowAssets(v => !v)}>
        <AssetBank assets={brandAssets} onChange={setBrandAssets} />
      </Section>

      {/* Context */}
      <Section title={<span className="flex items-center gap-2"><Globe size={13} /> APIs de contexto de mercado</span>} open={showContext} onToggle={() => setShowContext(v => !v)}>
        <ChipInput label="Keywords NewsAPI" values={newsKeywords} onChange={setNewsKeywords} placeholder="gastronomía argentina" />
        <ChipInput label="Feeds RSS" values={rssFeeds} onChange={setRssFeeds} placeholder="https://blog.ejemplo.com/rss" />
        <div className="space-y-3">
          <label className="block text-xs font-medium text-[#666] uppercase tracking-wider">Competidores</label>
          {competitors.map((c, i) => (
            <div key={i} className="flex items-center justify-between bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2">
              <div>
                <p className="text-sm font-medium text-white">{c.name}</p>
                <p className="text-xs text-[#444]">
                  {[c.instagram_handle && `IG: ${c.instagram_handle}`, c.facebook_page_name && `FB: ${c.facebook_page_name}`].filter(Boolean).join(' · ') || 'Sin redes'}
                </p>
              </div>
              <button onClick={() => setCompetitors(competitors.filter((_, j) => j !== i))}>
                <X size={13} className="text-[#444] hover:text-red-400 transition" />
              </button>
            </div>
          ))}
          <CompetitorAdd onAdd={c => setCompetitors([...competitors, c])} />
        </div>
      </Section>

      {/* Brandbook */}
      <Section title={<span className="flex items-center gap-2"><FileText size={13} /> Brandbook estructurado</span>} open={showBb} onToggle={() => setShowBb(v => !v)}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-[#666] mb-1.5">Tono base</label>
            <select value={bb.tone.voice} onChange={e => updateBb(['tone', 'voice'], e.target.value)} className="input">
              {['profesional','informal','técnico','cercano','inspiracional','humorístico'].map(v => (
                <option key={v} value={v}>{v.charAt(0).toUpperCase()+v.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#666] mb-1.5">Pronombres</label>
            <select value={bb.tone.pronouns} onChange={e => updateBb(['tone', 'pronouns'], e.target.value)} className="input">
              <option value="vos">Vos</option>
              <option value="tú">Tú</option>
              <option value="usted">Usted</option>
            </select>
          </div>
        </div>
        <ChipInput label="Hashtags siempre incluir" values={bb.hashtags.always_include} onChange={v => updateBb(['hashtags', 'always_include'], v)} placeholder="#MarcaXYZ" />
        <ChipInput label="Hashtags prohibidos" values={bb.hashtags.banned} onChange={v => updateBb(['hashtags', 'banned'], v)} placeholder="#viral" />
        <ChipInput label="Reglas de contenido" values={bb.content_rules} onChange={v => updateBb(['content_rules'], v)} placeholder="Nunca mencionar precios sin aprobación" />
        <ChipInput label="Emojis prohibidos" values={bb.emojis.banned_list} onChange={v => updateBb(['emojis', 'banned_list'], v)} placeholder="🔥" />
      </Section>

      <div className="flex gap-2 pt-2">
        <button onClick={onCancel} className="btn btn-secondary">
          <X size={13} /> Cancelar
        </button>
        <button onClick={save} disabled={!name.trim()} className="btn btn-primary disabled:opacity-40">
          <Save size={13} /> Guardar cliente
        </button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BrandsPage() {
  const [brands,  setBrands]  = useState<Brand[]>([])
  const [editing, setEditing] = useState<Brand | null | 'new'>(null)

  useEffect(() => { setBrands(getBrands()) }, [])

  function save(b: Brand) { upsertBrand(b); setBrands(getBrands()); setEditing(null) }
  function remove(id: string) { deleteBrand(id); setBrands(getBrands()) }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-[#5b6ef5]" />
          <h1 className="text-xl font-semibold text-white">Clientes</h1>
        </div>
        {editing === null && (
          <button onClick={() => setEditing('new')} className="btn btn-primary">
            <Plus size={14} /> Nuevo cliente
          </button>
        )}
      </div>

      {editing === 'new' && (
        <div className="mb-5 fade-up">
          <BrandForm onSave={save} onCancel={() => setEditing(null)} />
        </div>
      )}

      <div className="space-y-3">
        {brands.length === 0 && editing !== 'new' && (
          <div className="text-center py-16 text-[#333]">
            <Users size={40} className="mx-auto mb-3 opacity-20" />
            <p className="text-lg font-medium text-[#444]">Sin clientes</p>
            <p className="text-sm text-[#333] mt-1">Creá el primer cliente para empezar</p>
          </div>
        )}

        {brands.map(b => {
          const agentCount = getBrandAgents(b.id).length
          const imageCount = (b.brand_assets?.uploaded_images?.length ?? 0) + (b.brand_assets?.drive_images?.length ?? 0)
          return (
            <div key={b.id}>
              {editing && typeof editing === 'object' && editing.id === b.id ? (
                <div className="fade-up">
                  <BrandForm brand={b} onSave={save} onCancel={() => setEditing(null)} />
                </div>
              ) : (
                <div className="bg-[#161616] border border-[#2a2a2a] rounded-xl px-5 py-4 flex items-center justify-between hover:border-[#3a3a3a] transition-colors">
                  <div>
                    <p className="font-semibold text-white">{b.name}</p>
                    <p className="text-xs text-[#444] mt-0.5 flex items-center gap-2">
                      <span>{b.industry || 'Sin rubro'}</span>
                      <span>·</span>
                      {b.instagram_handle && <span className="text-[#5b6ef5]">@{b.instagram_handle.replace('@','')}</span>}
                      {b.instagram_handle && <span>·</span>}
                      <span className="flex items-center gap-0.5"><Bot size={10} /> {agentCount} agentes</span>
                      <span>·</span>
                      <span className="flex items-center gap-0.5"><ImageIcon size={10} /> {imageCount} imgs</span>
                      <span>·</span>
                      {b.brand_prompt
                        ? <span className="text-emerald-500 flex items-center gap-0.5"><CheckCircle2 size={10} /> Prompt</span>
                        : <span className="text-amber-500">Sin prompt</span>
                      }
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setEditing(b)}
                      className="p-2 rounded-lg hover:bg-[#2a2a2a] text-[#444] hover:text-white transition">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => remove(b.id)}
                      className="p-2 rounded-lg hover:bg-red-500/10 text-[#444] hover:text-red-400 transition">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
