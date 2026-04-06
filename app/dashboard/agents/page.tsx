'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Bot, Plus, Trash2, Edit2, Save, X, ChevronDown, ChevronUp,
  Users, Target, Zap, AlertCircle, Sparkles, CheckCircle2, Upload, Code,
} from 'lucide-react'
import type { Brand, Agent, AgentRole, AgentEnergy, AgentFormality } from '@/lib/types'
import { getBrandAgents, upsertAgent, deleteAgent, getSelectedBrandId } from '@/lib/storage'
import { useBrand } from '@/lib/hooks/useBrand'
import {
  BASE_ESTRATEGA_PROMPT, BASE_COPY_PROMPT, BASE_SUPERVISOR_PROMPT,
} from '@/lib/prompts'

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORMS   = ['instagram', 'linkedin', 'facebook', 'twitter', 'tiktok', 'youtube']
const PRIORITIES  = ['aspiracional', 'precio-valor', 'educativo', 'tendencia', 'comunidad', 'producto', 'humor', 'emocional']
const TONE_VOICES = ['profesional', 'informal', 'técnico', 'cercano', 'inspiracional', 'humorístico', 'empático', 'autoritativo']

const ROLE_CONFIG: Record<AgentRole, { label: string; icon: React.ReactNode; color: string; basePrompt: string; description: string }> = {
  estratega:  { label: 'Estratega',  icon: <Sparkles size={14} />,    color: 'text-purple-600 bg-purple-50 border-purple-200', basePrompt: BASE_ESTRATEGA_PROMPT,  description: 'Genera el plan de contenido de la marca' },
  copy:       { label: 'Copy',       icon: <Bot size={14} />,          color: 'text-accent bg-orange-50 border-orange-200',     basePrompt: BASE_COPY_PROMPT,       description: 'Genera 3 opciones de copy por post para un segmento' },
  supervisor: { label: 'Supervisor', icon: <CheckCircle2 size={14} />, color: 'text-green-600 bg-green-50 border-green-200',    basePrompt: BASE_SUPERVISOR_PROMPT, description: 'Evalúa y audita toda la estrategia globalmente' },
}

const TEMPLATE_VARS: Record<AgentRole, string[]> = {
  estratega:  ['{{brand_name}}', '{{brand_prompt}}', '{{brandbook}}', '{{num_days}}', '{{period}}'],
  copy:       ['{{brand_name}}', '{{brand_prompt}}', '{{brandbook}}', '{{segment}}', '{{tone_voice}}', '{{energy}}', '{{formality}}', '{{extra_rules}}', '{{content_priorities}}', '{{day}}', '{{platform}}', '{{content_type}}', '{{topic}}', '{{hook}}', '{{visual_direction}}'],
  supervisor: ['{{brand_name}}', '{{brand_prompt}}', '{{brandbook}}', '{{num_days}}', '{{period}}', '{{strategy_json}}'],
}

// ─── ChipInput ────────────────────────────────────────────────────────────────

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
      <label className="text-xs text-muted uppercase tracking-wider">{label}</label>
      <div className="flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder={placeholder ?? 'Escribí y Enter'}
          className="flex-1 border border-border rounded px-3 py-1.5 text-sm outline-none focus:border-accent bg-paper" />
        <button type="button" onClick={add} className="border border-border rounded px-3 py-1.5 hover:bg-paper transition-colors">
          <Plus size={14} />
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v, i) => (
          <span key={i} className="flex items-center gap-1 text-xs bg-paper border border-border rounded px-2 py-0.5">
            {v}
            <button onClick={() => onChange(values.filter((_, j) => j !== i))}><X size={10} /></button>
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── Import JSON/CSV helper ───────────────────────────────────────────────────

function ImportButton({ onImport }: { onImport: (data: Partial<Agent>) => void }) {
  const ref = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const text = reader.result as string
        if (file.name.endsWith('.csv')) {
          const lines = text.split('\n').filter(l => l.trim())
          if (lines.length >= 2) {
            const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
            const values  = lines[1].split(',').map(v => v.trim().replace(/^"|"$/g, ''))
            const obj: Record<string, string> = {}
            headers.forEach((h, i) => { obj[h] = values[i] ?? '' })
            onImport({
              name:        obj.name ?? obj.nombre ?? '',
              description: obj.description ?? obj.descripcion ?? '',
              segment:     obj.segment ?? obj.segmento ?? '',
              tone_voice:  obj.tone ?? obj.tono ?? '',
            })
          }
        } else {
          const parsed = JSON.parse(text)
          onImport(Array.isArray(parsed) ? parsed[0] : parsed)
        }
      } catch { alert('Error al leer el archivo. Verificá el formato.') }
    }
    reader.readAsText(file)
    if (ref.current) ref.current.value = ''
  }

  return (
    <>
      <button onClick={() => ref.current?.click()}
        className="flex items-center gap-1.5 text-xs border border-border rounded px-3 py-1.5 hover:bg-paper transition-colors">
        <Upload size={12} /> Importar JSON / CSV
      </button>
      <input ref={ref} type="file" accept=".json,.csv" onChange={handleFile} className="hidden" />
    </>
  )
}

// ─── Agent Form ───────────────────────────────────────────────────────────────

function AgentForm({ agent, brandId, brands, onSave, onCancel }: {
  agent?: Agent; brandId: string; brands: Brand[]; onSave: (a: Agent) => void; onCancel: () => void
}) {
  const [role,            setRole]           = useState<AgentRole>(agent?.role ?? 'copy')
  const [name,            setName]           = useState(agent?.name ?? '')
  const [description,     setDescription]    = useState(agent?.description ?? '')
  const [segment,         setSegment]        = useState(agent?.segment ?? '')
  const [toneVoice,       setToneVoice]      = useState(agent?.tone_voice ?? 'cercano')
  const [energy,          setEnergy]         = useState<AgentEnergy>(agent?.energy ?? 'media')
  const [formality,       setFormality]      = useState<AgentFormality>(agent?.formality ?? 'semiformal')
  const [platformFocus,   setPlatformFocus]  = useState<string[]>(agent?.platform_focus ?? [])
  const [contentPrios,    setContentPrios]   = useState<string[]>(agent?.content_priorities ?? [])
  const [extraRules,      setExtraRules]     = useState<string[]>(agent?.extra_rules ?? [])
  const [customPrompt,    setCustomPrompt]   = useState(agent?.custom_system_prompt ?? ROLE_CONFIG[agent?.role ?? 'copy'].basePrompt)
  const [showPrompt,      setShowPrompt]     = useState(false)
  const [selectedBrandId, setSelectedBrandId] = useState(agent?.brand_id ?? brandId)

  function handleRoleChange(r: AgentRole) {
    setRole(r)
    if (!agent) setCustomPrompt(ROLE_CONFIG[r].basePrompt)
  }

  function handleImport(data: Partial<Agent>) {
    if (data.name)                setName(data.name)
    if (data.description)         setDescription(data.description)
    if (data.segment)             setSegment(data.segment)
    if (data.tone_voice)          setToneVoice(data.tone_voice)
    if (data.energy)              setEnergy(data.energy as AgentEnergy)
    if (data.formality)           setFormality(data.formality as AgentFormality)
    if (data.platform_focus)      setPlatformFocus(data.platform_focus)
    if (data.content_priorities)  setContentPrios(data.content_priorities)
    if (data.extra_rules)         setExtraRules(data.extra_rules)
    if (data.custom_system_prompt) setCustomPrompt(data.custom_system_prompt)
  }

  function save() {
    if (!name.trim() || !selectedBrandId) return
    onSave({
      id:                   agent?.id ?? crypto.randomUUID(),
      brand_id:             selectedBrandId,
      role,
      name:                 name.trim(),
      description:          description.trim(),
      segment:              segment.trim(),
      tone_voice:           toneVoice,
      energy, formality,
      platform_focus:       platformFocus,
      content_priorities:   contentPrios,
      extra_rules:          extraRules,
      custom_system_prompt: customPrompt,
      created_at:           agent?.created_at ?? new Date().toISOString(),
    })
  }

  const isValid     = name.trim() && selectedBrandId
  const roleCfg     = ROLE_CONFIG[role]
  const templateVars = TEMPLATE_VARS[role]

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-5 fade-up">
      {/* Import + role */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(Object.keys(ROLE_CONFIG) as AgentRole[]).map(r => (
            <button key={r} onClick={() => handleRoleChange(r)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border transition-all ${role === r ? ROLE_CONFIG[r].color : 'border-border text-muted hover:border-ink'}`}>
              {ROLE_CONFIG[r].icon} {ROLE_CONFIG[r].label}
            </button>
          ))}
        </div>
        <ImportButton onImport={handleImport} />
      </div>

      <p className="text-xs text-muted italic">{roleCfg.description}</p>

      {/* Brand selector */}
      {!brandId && (
        <div className="space-y-1.5">
          <label className="text-xs text-muted uppercase tracking-wider">Cliente *</label>
          <select value={selectedBrandId} onChange={e => setSelectedBrandId(e.target.value)}
            className="w-full border border-border rounded px-3 py-2 text-sm bg-paper outline-none focus:border-accent">
            <option value="">Seleccioná un cliente</option>
            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs text-muted uppercase tracking-wider">Nombre *</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder={`Ej: ${role === 'estratega' ? 'Estratega Principal' : role === 'supervisor' ? 'Supervisor Marca' : 'Millennials Premium'}`}
            className="w-full border border-border rounded px-3 py-2 text-sm outline-none focus:border-accent bg-paper" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted uppercase tracking-wider">Descripción corta</label>
          <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Una línea para el selector"
            className="w-full border border-border rounded px-3 py-2 text-sm outline-none focus:border-accent bg-paper" />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-muted uppercase tracking-wider">
          {role === 'copy' ? 'Segmento objetivo *' : 'Segmento / Audiencia (referencia)'}
        </label>
        <textarea value={segment} onChange={e => setSegment(e.target.value)}
          placeholder="Ej: Mujeres 25-35, urbanas, ABC1, interesadas en lifestyle y wellness. Activas en Instagram. Valoran la autenticidad."
          rows={2} className="w-full border border-border rounded px-3 py-2 text-sm outline-none focus:border-accent bg-paper resize-none" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs text-muted uppercase tracking-wider">Tono de voz</label>
          <select value={toneVoice} onChange={e => setToneVoice(e.target.value)}
            className="w-full border border-border rounded px-3 py-2 text-sm bg-paper outline-none focus:border-accent">
            {TONE_VOICES.map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted uppercase tracking-wider">Energía</label>
          <select value={energy} onChange={e => setEnergy(e.target.value as AgentEnergy)}
            className="w-full border border-border rounded px-3 py-2 text-sm bg-paper outline-none focus:border-accent">
            <option value="alta">Alta ⚡</option>
            <option value="media">Media</option>
            <option value="baja">Baja 🌿</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted uppercase tracking-wider">Formalidad</label>
          <select value={formality} onChange={e => setFormality(e.target.value as AgentFormality)}
            className="w-full border border-border rounded px-3 py-2 text-sm bg-paper outline-none focus:border-accent">
            <option value="formal">Formal</option>
            <option value="semiformal">Semiformal</option>
            <option value="informal">Informal</option>
          </select>
        </div>
      </div>

      {role === 'copy' && (
        <>
          <div className="space-y-2">
            <label className="text-xs text-muted uppercase tracking-wider">Plataformas preferidas</label>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map(p => (
                <button key={p} type="button"
                  onClick={() => setPlatformFocus(platformFocus.includes(p) ? platformFocus.filter(x => x !== p) : [...platformFocus, p])}
                  className={`text-xs px-3 py-1.5 rounded border font-mono transition-all ${platformFocus.includes(p) ? 'bg-ink text-white border-ink' : 'border-border text-muted hover:border-ink hover:text-ink'}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted uppercase tracking-wider">Prioridades de contenido</label>
            <div className="flex flex-wrap gap-2">
              {PRIORITIES.map(p => (
                <button key={p} type="button"
                  onClick={() => setContentPrios(contentPrios.includes(p) ? contentPrios.filter(x => x !== p) : [...contentPrios, p])}
                  className={`text-xs px-3 py-1.5 rounded border transition-all ${contentPrios.includes(p) ? 'bg-accent text-white border-accent' : 'border-border text-muted hover:border-accent hover:text-accent'}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <ChipInput label="Reglas extra" values={extraRules} onChange={setExtraRules} placeholder='ej: "Nunca usar precios exactos"' />

      <div className="border border-border rounded-lg overflow-hidden">
        <button onClick={() => setShowPrompt(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-paper text-sm font-medium hover:bg-border/30 transition-colors">
          <span className="flex items-center gap-2"><Code size={14} /> Prompt del sistema (editable)</span>
          {showPrompt ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {showPrompt && (
          <div className="border-t border-border p-4 space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {templateVars.map(v => (
                <span key={v} className="text-xs font-mono bg-ink/5 text-ink/60 px-2 py-0.5 rounded border border-border cursor-pointer hover:bg-accent/10"
                  onClick={() => setCustomPrompt(p => p + v)} title="Clic para insertar">
                  {v}
                </span>
              ))}
            </div>
            <p className="text-xs text-muted">Hacé clic en una variable para insertarla. Estas se reemplazan automáticamente al ejecutar.</p>
            <textarea value={customPrompt} onChange={e => setCustomPrompt(e.target.value)}
              rows={18} className="w-full border border-border rounded px-3 py-2 text-xs font-mono outline-none focus:border-accent bg-paper resize-y" />
            <button onClick={() => setCustomPrompt(ROLE_CONFIG[role].basePrompt)}
              className="text-xs border border-border rounded px-3 py-1.5 hover:bg-paper transition-colors">
              Restaurar template base
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-2">
        <button onClick={onCancel} className="flex items-center gap-1.5 text-sm border border-border rounded px-4 py-2 hover:bg-paper transition-colors">
          <X size={14} /> Cancelar
        </button>
        <button onClick={save} disabled={!isValid}
          className="flex items-center gap-1.5 text-sm bg-accent text-white rounded px-4 py-2 hover:bg-orange-700 transition-colors disabled:opacity-40">
          <Save size={14} /> Guardar agente
        </button>
      </div>
    </div>
  )
}

// ─── Agent Card ───────────────────────────────────────────────────────────────

function AgentCard({ agent, brandName, onEdit, onDelete }: {
  agent: Agent; brandName: string; onEdit: () => void; onDelete: () => void
}) {
  const roleCfg = ROLE_CONFIG[agent.role]
  return (
    <div className="bg-card border border-border rounded-xl p-4 hover:border-accent/30 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded border ${roleCfg.color}`}>
            {roleCfg.icon} {roleCfg.label}
          </span>
        </div>
        <div className="flex gap-1">
          <button onClick={onEdit}  className="p-1.5 rounded hover:bg-paper text-muted hover:text-ink transition-colors"><Edit2 size={13} /></button>
          <button onClick={onDelete} className="p-1.5 rounded hover:bg-red-50 text-muted hover:text-red-600 transition-colors"><Trash2 size={13} /></button>
        </div>
      </div>
      <p className="font-medium text-ink text-sm">{agent.name}</p>
      {agent.description && <p className="text-xs text-muted italic mt-0.5">{agent.description}</p>}
      {agent.segment && (
        <div className="flex items-start gap-1 mt-2">
          <Target size={11} className="text-accent mt-0.5 shrink-0" />
          <p className="text-xs text-ink/70 leading-relaxed line-clamp-2">{agent.segment}</p>
        </div>
      )}
      <div className="flex gap-1.5 mt-2 flex-wrap">
        <span className="text-xs font-mono bg-paper border border-border rounded px-1.5 py-0.5">{agent.tone_voice}</span>
        <span className="text-xs bg-paper border border-border rounded px-1.5 py-0.5">{agent.energy}</span>
        {agent.platform_focus.slice(0, 3).map(p => (
          <span key={p} className="text-xs text-accent bg-orange-50 px-1.5 py-0.5 rounded font-mono">{p}</span>
        ))}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AgentsPage() {
  const { brands } = useBrand()
  const [agents,        setAgents]        = useState<Agent[]>([])
  // FIX: inicializar con el cliente activo en lugar de 'all'
  const [filterBrandId, setFilterBrandId] = useState<string>(() => getSelectedBrandId() || 'all')
  const [filterRole,    setFilterRole]    = useState<AgentRole | 'all'>('all')
  const [editing,       setEditing]       = useState<Agent | null | 'new'>(null)
  const [expanded,      setExpanded]      = useState<Record<string, boolean>>({})

  useEffect(() => {
    const all: Agent[] = []
    brands.forEach(b => all.push(...getBrandAgents(b.id)))
    setAgents(all)
    // Auto-expand el cliente activo al cargar
    const selectedId = getSelectedBrandId()
    const targetId   = (selectedId && brands.find(b => b.id === selectedId)) ? selectedId : brands[0]?.id
    if (targetId) {
      setExpanded(prev => Object.keys(prev).length === 0 ? { [targetId]: true } : prev)
    }
  }, [brands])

  // FIX: reaccionar al cambio de cliente desde la sidebar
  useEffect(() => {
    function onBrandChanged(e: Event) {
      const brandId = (e as CustomEvent<{ brand_id: string }>).detail?.brand_id
      if (brandId) {
        setFilterBrandId(brandId)
        setExpanded({ [brandId]: true })
      }
    }
    window.addEventListener('brandChanged', onBrandChanged)
    return () => window.removeEventListener('brandChanged', onBrandChanged)
  }, [])

  function refreshAgents() {
    const all: Agent[] = []
    brands.forEach(b => all.push(...getBrandAgents(b.id)))
    setAgents(all)
  }

  function save(a: Agent) { upsertAgent(a); refreshAgents(); setEditing(null) }
  function remove(id: string) { deleteAgent(id); refreshAgents() }
  function toggle(id: string) { setExpanded(prev => ({ ...prev, [id]: !prev[id] })) }

  const displayedBrands = filterBrandId === 'all' ? brands : brands.filter(b => b.id === filterBrandId)

  if (brands.length === 0) return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-8"><Bot size={24} className="text-accent" /><h1 className="font-display text-3xl text-ink">Agentes</h1></div>
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-8 text-center">
        <AlertCircle size={32} className="mx-auto mb-3 text-orange-400" />
        <p className="font-medium text-orange-800 mb-4">Primero necesitás un cliente</p>
        <a href="/dashboard/brands" className="inline-block text-sm bg-accent text-white px-4 py-2 rounded hover:bg-orange-700 transition-colors">Ir a Clientes →</a>
      </div>
    </div>
  )

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <Bot size={24} className="text-accent" />
          <h1 className="font-display text-3xl text-ink">Agentes</h1>
          <span className="text-xs font-mono bg-ink/5 text-muted px-2 py-0.5 rounded">{agents.length} total</span>
        </div>
        <button onClick={() => setEditing('new')}
          className="flex items-center gap-2 text-sm bg-accent text-white rounded px-4 py-2 hover:bg-orange-700 transition-colors">
          <Plus size={16} /> Nuevo agente
        </button>
      </div>
      <p className="text-sm text-muted mb-6">
        Cada marca necesita al menos 1 <strong>Estratega</strong>, 1 <strong>Supervisor</strong> y N agentes de <strong>Copy</strong>.
        El prompt de cada agente usa variables <code className="text-xs bg-ink/5 px-1 rounded">{'{{como_estas}}'}</code> que se reemplazan automáticamente.
      </p>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        {brands.length > 1 && (
          <div className="flex gap-1 bg-card border border-border rounded-lg p-1">
            <button onClick={() => setFilterBrandId('all')} className={`px-3 py-1 text-xs rounded whitespace-nowrap transition-all font-medium ${filterBrandId === 'all' ? 'bg-ink text-white' : 'text-muted hover:text-ink'}`}>Todos</button>
            {brands.map(b => <button key={b.id} onClick={() => setFilterBrandId(b.id)} className={`px-3 py-1 text-xs rounded whitespace-nowrap transition-all font-medium ${filterBrandId === b.id ? 'bg-ink text-white' : 'text-muted hover:text-ink'}`}>{b.name}</button>)}
          </div>
        )}
        <div className="flex gap-1 bg-card border border-border rounded-lg p-1">
          <button onClick={() => setFilterRole('all')} className={`px-3 py-1 text-xs rounded whitespace-nowrap transition-all font-medium ${filterRole === 'all' ? 'bg-ink text-white' : 'text-muted hover:text-ink'}`}>Todos los roles</button>
          {(Object.keys(ROLE_CONFIG) as AgentRole[]).map(r => <button key={r} onClick={() => setFilterRole(r)} className={`px-3 py-1 text-xs rounded whitespace-nowrap transition-all font-medium ${filterRole === r ? 'bg-ink text-white' : 'text-muted hover:text-ink'}`}>{ROLE_CONFIG[r].label}</button>)}
        </div>
      </div>

      {editing === 'new' && (
        <div className="mb-6">
          <AgentForm brandId={filterBrandId === 'all' ? '' : filterBrandId} brands={brands} onSave={save} onCancel={() => setEditing(null)} />
        </div>
      )}

      <div className="space-y-4">
        {displayedBrands.map(brand => {
          const brandAgents = agents
            .filter(a => a.brand_id === brand.id)
            .filter(a => filterRole === 'all' || a.role === filterRole)
          const isOpen = expanded[brand.id] !== false
          const roleCount = { estratega: 0, copy: 0, supervisor: 0 }
          agents.filter(a => a.brand_id === brand.id).forEach(a => roleCount[a.role]++)

          return (
            <div key={brand.id} className="border border-border rounded-xl overflow-hidden">
              <button onClick={() => toggle(brand.id)}
                className="w-full flex items-center justify-between px-5 py-4 bg-card hover:bg-paper/60 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-ink/5 flex items-center justify-center"><Users size={15} className="text-muted" /></div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-ink">{brand.name}</p>
                    <div className="flex gap-2 mt-0.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${roleCount.estratega > 0 ? 'text-purple-600 bg-purple-50' : 'text-muted bg-ink/5'}`}>E:{roleCount.estratega}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${roleCount.copy > 0 ? 'text-accent bg-orange-50' : 'text-muted bg-ink/5'}`}>C:{roleCount.copy}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${roleCount.supervisor > 0 ? 'text-green-600 bg-green-50' : 'text-muted bg-ink/5'}`}>S:{roleCount.supervisor}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={e => { e.stopPropagation(); setFilterBrandId(brand.id); setEditing('new'); setExpanded(prev => ({ ...prev, [brand.id]: true })) }}
                    className="text-xs flex items-center gap-1 border border-border rounded px-2.5 py-1 hover:border-accent/50 text-muted hover:text-accent transition-all">
                    <Plus size={12} /> Agente
                  </button>
                  {isOpen ? <ChevronUp size={16} className="text-muted" /> : <ChevronDown size={16} className="text-muted" />}
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-border p-4">
                  {brandAgents.length === 0 ? (
                    <div className="text-center py-8 text-muted">
                      <Bot size={28} className="mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Sin agentes{filterRole !== 'all' ? ` de tipo "${ROLE_CONFIG[filterRole as AgentRole]?.label}"` : ''} para esta marca.</p>
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {brandAgents.map(agent =>
                        editing && typeof editing === 'object' && editing.id === agent.id ? (
                          <div key={agent.id} className="sm:col-span-2 lg:col-span-3">
                            <AgentForm agent={agent} brandId={brand.id} brands={brands} onSave={save} onCancel={() => setEditing(null)} />
                          </div>
                        ) : (
                          <AgentCard key={agent.id} agent={agent} brandName={brand.name} onEdit={() => setEditing(agent)} onDelete={() => remove(agent.id)} />
                        )
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
