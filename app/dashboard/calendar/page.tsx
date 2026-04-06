'use client'

import { useState, useEffect } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import type { Post } from '@/lib/types'
import { getPosts } from '@/lib/storage'
import { useBrand } from '@/lib/hooks/useBrand'

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DAYS   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

const STATUS_COLOR: Record<string, string> = {
  pm_review:         'bg-warning/20 text-warning border-warning/40',
  supervisor_review: 'bg-orange-100 text-orange-700 border-orange-300',
  approved:          'bg-success/20 text-success border-success/40',
  webhook_sent:      'bg-green-100 text-green-800 border-green-300',
  rejected:          'bg-red-100 text-red-700 border-red-300',
}

function exportToCSV(posts: Post[], month: string) {
  const rows = [
    ['Fecha', 'Hora', 'Marca', 'Plataforma', 'Estado', 'Copy', 'Hashtags'],
    ...posts.map(p => {
      const d = new Date(p.scheduled_date)
      return [
        d.toLocaleDateString('es-AR'),
        d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
        p.brand_name,
        p.platform,
        p.status,
        `"${(p.final_copy || p.generated_copy).replace(/"/g, '""')}"`,
        (p.hashtags ?? []).join(' '),
      ]
    }),
  ]
  const csv = rows.map(r => r.join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `grilla-${month.toLowerCase().replace(/ /g, '-')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function CalendarPage() {
  const { brand } = useBrand()
  const [posts, setPosts] = useState<Post[]>([])
  const [now] = useState(new Date())
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

  // FIX: [brand?.id] como dependencia para re-filtrar al cambiar cliente
  useEffect(() => {
    setPosts(brand ? getPosts().filter(p => p.brand_id === brand.id) : getPosts())
  }, [brand?.id])

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const scheduled = posts.filter(p => {
    if (!p.scheduled_date) return false
    const d = new Date(p.scheduled_date)
    return d.getFullYear() === year && d.getMonth() === month
  })

  const approvedThisMonth = scheduled.filter(p =>
    p.status === 'approved' || p.status === 'webhook_sent'
  )

  function postsOnDay(day: number) {
    return scheduled.filter(p => new Date(p.scheduled_date).getDate() === day)
  }

  function prev() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1)
  }
  function next() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1)
  }

  const cells = Array(firstDay).fill(null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1))
  while (cells.length % 7 !== 0) cells.push(null)

  const monthLabel = `${MONTHS[month]} ${year}`

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <CalendarDays size={24} className="text-accent" />
          <h1 className="font-display text-3xl text-ink">Calendario</h1>
        </div>
        <div className="flex items-center gap-3">
          {approvedThisMonth.length > 0 && (
            <button
              onClick={() => exportToCSV(approvedThisMonth, monthLabel)}
              className="flex items-center gap-2 text-xs border border-border rounded px-3 py-2 hover:bg-card transition-colors">
              <Download size={14} /> Exportar CSV ({approvedThisMonth.length} posts)
            </button>
          )}
          <button onClick={prev} className="p-2 hover:bg-card border border-border rounded transition-colors"><ChevronLeft size={16} /></button>
          <span className="font-display text-xl text-ink min-w-40 text-center">{monthLabel}</span>
          <button onClick={next} className="p-2 hover:bg-card border border-border rounded transition-colors"><ChevronRight size={16} /></button>
        </div>
      </div>

      <div className="flex gap-3 mb-4 flex-wrap">
        {Object.entries({ 'Pendiente': 'bg-warning/20 text-warning', 'Aprobado': 'bg-success/20 text-success', 'Enviado': 'bg-green-100 text-green-800' }).map(([label, cls]) => (
          <span key={label} className={`text-xs px-2 py-0.5 rounded ${cls}`}>{label}</span>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border">
          {DAYS.map(d => (
            <div key={d} className="py-3 text-center text-xs font-medium text-muted uppercase tracking-wider">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            const dayPosts = day ? postsOnDay(day) : []
            const isToday = day === now.getDate() && month === now.getMonth() && year === now.getFullYear()
            return (
              <div key={i}
                className={`min-h-24 p-2 border-b border-r border-border last:border-r-0 transition-colors
                  ${day ? 'hover:bg-paper' : 'bg-paper/50'}
                  ${i % 7 === 6 ? 'border-r-0' : ''}`}
              >
                {day && (
                  <>
                    <span className={`text-xs font-mono inline-flex items-center justify-center w-6 h-6 rounded-full mb-1
                      ${isToday ? 'bg-accent text-white font-bold' : 'text-muted'}`}>
                      {day}
                    </span>
                    <div className="space-y-1">
                      {dayPosts.map(p => (
                        <div key={p.id}
                          className={`text-xs px-1.5 py-0.5 rounded border truncate ${STATUS_COLOR[p.status] ?? 'bg-paper'}`}
                          title={`${p.brand_name}: ${p.final_copy || p.generated_copy}`}>
                          <span className="font-medium">{p.brand_name}</span>
                          <span className="text-muted ml-1 font-mono">{p.platform}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {scheduled.length === 0 && (
        <p className="text-center text-muted text-sm mt-6">
          No hay posts programados este mes. Aprobá posts desde la Bandeja para verlos acá.
        </p>
      )}
    </div>
  )
}
