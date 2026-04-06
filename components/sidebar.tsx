'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Sparkles, Inbox, Zap, CalendarDays, LogOut, Bot,
  TrendingUp, BarChart3, Megaphone, Share2, Users, ChevronDown, Check,
} from 'lucide-react'
import { getBrands, getSelectedBrandId, setSelectedBrandId } from '@/lib/storage'
import type { Brand } from '@/lib/types'

const NAV = [
  { href: '/dashboard/strategy',   label: 'Estrategia',   icon: Sparkles },
  { href: '/dashboard/campaigns',  label: 'Campañas',     icon: Megaphone },
  { href: '/dashboard/inbox',      label: 'Bandeja',      icon: Inbox },
  { href: '/dashboard/calendar',   label: 'Calendario',   icon: CalendarDays },
]
const NAV_ANALYSIS = [
  { href: '/dashboard/metrics',     label: 'Métricas',     icon: BarChart3 },
  { href: '/dashboard/competitors', label: 'Competidores', icon: TrendingUp },
]
const NAV_CONFIG = [
  { href: '/dashboard/brands', label: 'Clientes',        icon: Users },
  { href: '/dashboard/agents', label: 'Agentes IA',      icon: Bot },
  { href: '/dashboard/social', label: 'Redes sociales',  icon: Share2 },
]

export function Sidebar({ email }: { email: string }) {
  const path   = usePathname()
  const router = useRouter()
  const [brands,          setBrands]          = useState<Brand[]>([])
  const [selectedBrandId, setSelectedBrandIdState] = useState('')
  const [brandOpen,       setBrandOpen]       = useState(false)

  useEffect(() => {
    const all = getBrands()
    setBrands(all)
    const stored = getSelectedBrandId()
    if (stored && all.find(b => b.id === stored)) {
      setSelectedBrandIdState(stored)
    } else if (all.length > 0) {
      setSelectedBrandIdState(all[0].id)
      setSelectedBrandId(all[0].id)
    }
  }, [])

  function selectBrand(id: string) {
    setSelectedBrandIdState(id)
    setSelectedBrandId(id)
    setBrandOpen(false)
    // Dispatch custom event so pages can react
    window.dispatchEvent(new CustomEvent('brandChanged', { detail: { brand_id: id } }))
  }

  async function logout() {
    await fetch('/api/auth', { method: 'DELETE' })
    router.push('/auth/login'); router.refresh()
  }

  const selectedBrand = brands.find(b => b.id === selectedBrandId)

  function NavItem({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) {
    const active = path === href || (href !== '/dashboard' && path.startsWith(href))
    return (
      <Link href={href}
        className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-all ${active ? 'bg-[#5b6ef5]/15 text-[#5b6ef5] font-medium' : 'text-[#666] hover:text-[#a1a1a1] hover:bg-white/5'}`}>
        <Icon size={14} />
        {label}
      </Link>
    )
  }

  return (
    <aside className="fixed left-0 top-0 h-full w-52 bg-[#111111] border-r border-[#1e1e1e] flex flex-col z-30">
      {/* Logo */}
      <div className="px-4 pt-5 pb-3 border-b border-[#1e1e1e]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-[#5b6ef5] flex items-center justify-center">
            <Sparkles size={13} className="text-white" />
          </div>
          <span className="text-white font-semibold text-sm">AgencyCopilot</span>
        </div>
      </div>

      {/* Brand picker */}
      <div className="px-3 py-3 border-b border-[#1e1e1e]">
        <p className="text-[10px] font-medium text-[#444] uppercase tracking-widest mb-1.5 px-1">Cliente activo</p>
        {brands.length === 0 ? (
          <Link href="/dashboard/brands"
            className="flex items-center gap-2 px-3 py-2 rounded-md border border-dashed border-[#2a2a2a] text-[#444] text-xs hover:border-[#5b6ef5] hover:text-[#5b6ef5] transition-colors">
            <Users size={12} /> Configurar cliente
          </Link>
        ) : (
          <div className="relative">
            <button onClick={() => setBrandOpen(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-md bg-[#1a1a1a] border border-[#2a2a2a] hover:border-[#3a3a3a] transition-colors">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-5 h-5 rounded-sm bg-[#5b6ef5]/20 flex items-center justify-center shrink-0">
                  <span className="text-[#5b6ef5] text-[9px] font-bold">{selectedBrand?.name?.[0]?.toUpperCase()}</span>
                </div>
                <span className="text-xs text-white font-medium truncate">{selectedBrand?.name ?? 'Seleccionar...'}</span>
              </div>
              <ChevronDown size={12} className={`text-[#444] transition-transform shrink-0 ${brandOpen ? 'rotate-180' : ''}`} />
            </button>
            {brandOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-md shadow-float z-50 overflow-hidden">
                {brands.map(b => (
                  <button key={b.id} onClick={() => selectBrand(b.id)}
                    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/5 transition-colors text-left">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-5 h-5 rounded-sm bg-[#5b6ef5]/20 flex items-center justify-center shrink-0">
                        <span className="text-[#5b6ef5] text-[9px] font-bold">{b.name[0]?.toUpperCase()}</span>
                      </div>
                      <span className="text-xs text-white truncate">{b.name}</span>
                    </div>
                    {b.id === selectedBrandId && <Check size={11} className="text-[#5b6ef5] shrink-0" />}
                  </button>
                ))}
                <div className="border-t border-[#2a2a2a]">
                  <Link href="/dashboard/brands" onClick={() => setBrandOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-xs text-[#666] hover:text-[#a1a1a1] transition-colors">
                    <Users size={11} /> Administrar clientes
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        <div className="space-y-0.5">
          {NAV.map(item => <NavItem key={item.href} {...item} />)}
        </div>
        <div>
          <p className="px-3 text-[10px] font-medium text-[#444] uppercase tracking-widest mb-1">Análisis</p>
          <div className="space-y-0.5">
            {NAV_ANALYSIS.map(item => <NavItem key={item.href} {...item} />)}
          </div>
        </div>
        <div>
          <p className="px-3 text-[10px] font-medium text-[#444] uppercase tracking-widest mb-1">Configuración</p>
          <div className="space-y-0.5">
            {NAV_CONFIG.map(item => <NavItem key={item.href} {...item} />)}
          </div>
        </div>
      </nav>

      {/* Footer */}
      <div className="px-2 py-3 border-t border-[#1e1e1e]">
        <div className="px-3 py-2 rounded-md hover:bg-white/5 transition-colors">
          <p className="text-xs text-[#444] truncate font-mono mb-1">{email}</p>
          <button onClick={logout} className="flex items-center gap-1.5 text-xs text-[#444] hover:text-[#a1a1a1] transition-colors">
            <LogOut size={11} /> Cerrar sesión
          </button>
        </div>
      </div>
    </aside>
  )
}
