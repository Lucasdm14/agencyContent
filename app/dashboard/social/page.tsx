'use client'

import { useState, useEffect } from 'react'
import {
  Share2, Plus, Trash2, Edit2, Save, X, CheckCircle2, AlertCircle,
  Instagram, Linkedin, Twitter, Facebook,
} from 'lucide-react'
import type { Brand, SocialAccount, SocialPlatform } from '@/lib/types'
import { getBrandSocialAccounts, upsertSocialAccount, deleteSocialAccount } from '@/lib/storage'
import { useBrand } from '@/lib/hooks/useBrand'

// ─── Platform config ──────────────────────────────────────────────────────────

const PLATFORMS: { id: SocialPlatform; label: string; color: string; icon: React.ReactNode; tokenLabel: string; tokenHelp: string; needsPageId: boolean }[] = [
  {
    id: 'instagram', label: 'Instagram', color: 'text-pink-600 bg-pink-50 border-pink-200',
    icon: <Instagram size={16} />,
    tokenLabel: 'Access Token (Graph API)',
    tokenHelp: 'Facebook Developer App → Graph API Explorer → token con permisos instagram_basic, instagram_content_publish',
    needsPageId: true,
  },
  {
    id: 'facebook', label: 'Facebook', color: 'text-blue-600 bg-blue-50 border-blue-200',
    icon: <Facebook size={16} />,
    tokenLabel: 'Page Access Token',
    tokenHelp: 'Facebook Developer App → Graph API Explorer → seleccioná tu página → token con pages_manage_posts',
    needsPageId: true,
  },
  {
    id: 'linkedin', label: 'LinkedIn', color: 'text-sky-700 bg-sky-50 border-sky-200',
    icon: <Linkedin size={16} />,
    tokenLabel: 'Access Token (OAuth 2.0)',
    tokenHelp: 'LinkedIn Developer App → Products → Share on LinkedIn + Sign In → OAuth 2.0 token',
    needsPageId: false,
  },
  {
    id: 'twitter', label: 'Twitter / X', color: 'text-zinc-800 bg-zinc-50 border-zinc-200',
    icon: <Twitter size={16} />,
    tokenLabel: 'Bearer Token (API v2)',
    tokenHelp: 'developer.twitter.com → tu App → Keys and Tokens → Bearer Token',
    needsPageId: false,
  },
  {
    id: 'tiktok', label: 'TikTok', color: 'text-red-600 bg-red-50 border-red-200',
    icon: <Share2 size={16} />,
    tokenLabel: 'Access Token (TikTok for Business)',
    tokenHelp: 'business.tiktok.com → Developer portal → App → Access Token',
    needsPageId: false,
  },
]

// ─── Account form ─────────────────────────────────────────────────────────────

function AccountForm({ account, brandId, onSave, onCancel }: {
  account?: SocialAccount; brandId: string; onSave: (a: SocialAccount) => void; onCancel: () => void
}) {
  const [platform,     setPlatform]     = useState<SocialPlatform>(account?.platform ?? 'instagram')
  const [handle,       setHandle]       = useState(account?.handle ?? '')
  const [displayName,  setDisplayName]  = useState(account?.display_name ?? '')
  const [accessToken,  setAccessToken]  = useState(account?.access_token ?? '')
  const [pageId,       setPageId]       = useState(account?.page_id ?? '')
  const [webhookUrl,   setWebhookUrl]   = useState(account?.webhook_url ?? '')
  const [showToken,    setShowToken]    = useState(false)

  const cfg = PLATFORMS.find(p => p.id === platform)!

  function save() {
    if (!handle.trim() || !brandId) return
    onSave({
      id:           account?.id ?? crypto.randomUUID(),
      brand_id:     brandId,
      platform,
      handle:       handle.trim().replace('@', ''),
      display_name: displayName.trim() || handle.trim(),
      access_token: accessToken.trim(),
      page_id:      pageId.trim() || undefined,
      webhook_url:  webhookUrl.trim() || undefined,
      connected_at: account?.connected_at ?? new Date().toISOString(),
    })
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4 fade-up shadow-card">
      {/* Platform selector */}
      <div>
        <label className="block text-xs font-medium text-secondary mb-2">Plataforma</label>
        <div className="grid grid-cols-5 gap-2">
          {PLATFORMS.map(p => (
            <button key={p.id} onClick={() => setPlatform(p.id)}
              className={`flex flex-col items-center gap-1.5 p-2.5 rounded-lg border text-xs font-medium transition-all ${platform === p.id ? p.color : 'border-border text-tertiary hover:border-border hover:text-secondary bg-canvas'}`}>
              {p.icon}
              <span className="text-2xs">{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-secondary mb-1.5">Handle / Usuario *</label>
          <div className="flex items-center border border-border rounded overflow-hidden focus-within:border-accent focus-within:ring-1 focus-within:ring-accent/20">
            <span className="px-2.5 py-2 text-sm text-tertiary bg-canvas border-r border-border">@</span>
            <input value={handle} onChange={e => setHandle(e.target.value.replace('@', ''))}
              placeholder="usuario" className="flex-1 px-3 py-2 text-sm outline-none bg-white" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-secondary mb-1.5">Nombre para mostrar</label>
          <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder={handle || 'Mi empresa'}
            className="w-full border border-border rounded px-3 py-2 text-sm outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition bg-white" />
        </div>
      </div>

      {/* Token */}
      <div>
        <label className="block text-xs font-medium text-secondary mb-1.5">{cfg.tokenLabel}</label>
        <div className="relative">
          <input
            type={showToken ? 'text' : 'password'}
            value={accessToken} onChange={e => setAccessToken(e.target.value)}
            placeholder="Pegá el token aquí"
            className="w-full border border-border rounded px-3 py-2 text-sm font-mono outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition bg-white pr-16" />
          <button onClick={() => setShowToken(v => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-tertiary hover:text-secondary transition px-1">
            {showToken ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>
        <p className="text-2xs text-tertiary mt-1.5 leading-relaxed">{cfg.tokenHelp}</p>
      </div>

      {cfg.needsPageId && (
        <div>
          <label className="block text-xs font-medium text-secondary mb-1.5">Page ID (requerido para publicar)</label>
          <input value={pageId} onChange={e => setPageId(e.target.value)} placeholder="123456789012345"
            className="w-full border border-border rounded px-3 py-2 text-sm font-mono outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition bg-white" />
          <p className="text-2xs text-tertiary mt-1">
            Encontralo en: facebook.com/tu-pagina/about → URL (el número al final)
          </p>
        </div>
      )}

      {/* Webhook alternative */}
      <div>
        <label className="block text-xs font-medium text-secondary mb-1.5">Webhook alternativo (Zapier / Make)</label>
        <input value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} placeholder="https://hooks.zapier.com/..."
          className="w-full border border-border rounded px-3 py-2 text-sm font-mono outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition bg-white" />
        <p className="text-2xs text-tertiary mt-1">Si configurás un webhook, la publicación se delegará a él en lugar de usar el token directo.</p>
      </div>

      <div className="flex gap-2 pt-1">
        <button onClick={onCancel}
          className="flex items-center gap-1.5 text-sm border border-border rounded px-4 py-2 hover:bg-canvas transition text-secondary">
          <X size={13} /> Cancelar
        </button>
        <button onClick={save} disabled={!handle.trim()}
          className="flex items-center gap-1.5 text-sm bg-primary text-white rounded px-4 py-2 hover:bg-zinc-800 transition disabled:opacity-40">
          <Save size={13} /> Guardar cuenta
        </button>
      </div>
    </div>
  )
}

// ─── Account card ─────────────────────────────────────────────────────────────

function AccountCard({ account, onEdit, onDelete }: {
  account: SocialAccount; onEdit: () => void; onDelete: () => void
}) {
  const cfg = PLATFORMS.find(p => p.id === account.platform)
  const hasToken   = !!account.access_token
  const hasWebhook = !!account.webhook_url

  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-card hover:border-zinc-300 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg border ${cfg?.color ?? 'text-secondary bg-canvas border-border'}`}>
            {cfg?.icon}
          </div>
          <div>
            <p className="font-medium text-sm text-primary">{account.display_name}</p>
            <p className="text-2xs font-mono text-tertiary">@{account.handle}</p>
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={onEdit}   className="p-1.5 rounded hover:bg-canvas text-tertiary hover:text-primary transition"><Edit2  size={13} /></button>
          <button onClick={onDelete} className="p-1.5 rounded hover:bg-red-50 text-tertiary hover:text-danger transition"><Trash2 size={13} /></button>
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        {hasToken && (
          <span className="flex items-center gap-1 text-2xs text-success bg-green-50 border border-green-100 rounded px-2 py-0.5">
            <CheckCircle2 size={10} /> Token configurado
          </span>
        )}
        {hasWebhook && (
          <span className="flex items-center gap-1 text-2xs text-sky-700 bg-sky-50 border border-sky-100 rounded px-2 py-0.5">
            <Share2 size={10} /> Webhook activo
          </span>
        )}
        {!hasToken && !hasWebhook && (
          <span className="flex items-center gap-1 text-2xs text-warning bg-amber-50 border border-amber-100 rounded px-2 py-0.5">
            <AlertCircle size={10} /> Sin credenciales
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SocialPage() {
  const { brand, brands, selectBrand } = useBrand()
  const [accounts, setAccounts]       = useState<SocialAccount[]>([])
  const [editing,  setEditing]        = useState<SocialAccount | null | 'new'>(null)

  useEffect(() => {
    if (brand) setAccounts(getBrandSocialAccounts(brand.id))
  }, [brand?.id])

  function handleBrandChange(id: string) {
    selectBrand(id)
    setEditing(null)
  }

  function save(a: SocialAccount) {
    upsertSocialAccount(a)
    setAccounts(getBrandSocialAccounts(brand?.id ?? ''))
    setEditing(null)
  }

  function remove(id: string) {
    deleteSocialAccount(id)
    setAccounts(getBrandSocialAccounts(brand?.id ?? ''))
  }

  return (
    <div className="p-8 max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <Share2 size={18} className="text-accent" />
          <h1 className="text-xl font-semibold text-primary">Redes sociales</h1>
        </div>
        <p className="text-sm text-secondary">
          Configurá las cuentas de cada cliente para publicar desde las campañas aprobadas.
          Los tokens se guardan localmente en tu navegador.
        </p>
      </div>

      {brands.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
          <AlertCircle size={24} className="mx-auto mb-3 text-amber-400" />
          <p className="text-sm font-medium text-amber-800 mb-3">Primero configurá un cliente</p>
          <a href="/dashboard/brands" className="inline-block text-sm bg-primary text-white px-4 py-2 rounded hover:bg-zinc-800 transition">Ir a Clientes →</a>
        </div>
      ) : (
        <>
          {/* Brand tabs */}
          <div className="flex gap-1 mb-6 bg-canvas border border-border rounded-lg p-1 w-fit">
            {brands.map(b => (
              <button key={b.id} onClick={() => handleBrandChange(b.id)}
                className={`px-3 py-1.5 text-sm rounded transition-all font-medium ${brand?.id ?? '' === b.id ? 'bg-primary text-white' : 'text-secondary hover:text-primary'}`}>
                {b.name}
                <span className="ml-1.5 text-xs opacity-60">({getBrandSocialAccounts(b.id).length})</span>
              </button>
            ))}
          </div>

          {/* Actions */}
          {editing !== 'new' && (
            <button onClick={() => setEditing('new')}
              className="flex items-center gap-2 text-sm bg-primary text-white rounded-lg px-4 py-2 hover:bg-zinc-800 transition mb-5">
              <Plus size={15} /> Conectar cuenta
            </button>
          )}

          {/* New form */}
          {editing === 'new' && (
            <div className="mb-5">
              <AccountForm brandId={brand?.id ?? ''} onSave={save} onCancel={() => setEditing(null)} />
            </div>
          )}

          {/* Account list */}
          {accounts.length === 0 && editing !== 'new' ? (
            <div className="border-2 border-dashed border-border rounded-xl p-12 text-center">
              <Share2 size={28} className="mx-auto mb-3 text-tertiary opacity-50" />
              <p className="text-sm text-secondary mb-1">Sin cuentas conectadas</p>
              <p className="text-xs text-tertiary">Conectá las redes sociales de este cliente para poder publicar desde las campañas.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {accounts.map(a =>
                editing && typeof editing === 'object' && editing.id === a.id ? (
                  <div key={a.id} className="sm:col-span-2">
                    <AccountForm account={a} brandId={brand?.id ?? ''} onSave={save} onCancel={() => setEditing(null)} />
                  </div>
                ) : (
                  <AccountCard key={a.id} account={a} onEdit={() => setEditing(a)} onDelete={() => remove(a.id)} />
                )
              )}
            </div>
          )}

          {/* Info box */}
          <div className="mt-8 bg-canvas border border-border rounded-xl p-4">
            <p className="text-xs font-medium text-secondary mb-2">¿Cómo funciona la publicación?</p>
            <div className="space-y-1.5 text-xs text-tertiary">
              <p>1. Configurás las credenciales de cada red social aquí.</p>
              <p>2. En <a href="/dashboard/campaigns" className="text-accent hover:underline">Campañas</a>, aprobás una estrategia y editás los copies finales.</p>
              <p>3. Agendás cada post con fecha y hora y hacés Submit.</p>
              <p>4. Si hay webhook configurado, se dispara automáticamente. Si hay token, se publica directo vía API.</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
