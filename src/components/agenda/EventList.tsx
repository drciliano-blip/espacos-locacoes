'use client'

import { Clock, MapPin } from 'lucide-react'
import type { Evento } from '@/types'
import { formatDate, formatCurrency } from '@/lib/utils'

const statusBadge: Record<string, string> = {
  confirmado: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  tentativo: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  cancelado: 'bg-red-500/10 text-red-400 border-red-500/20',
}

const espacoColors: Record<string, string> = {
  'Usine': 'border-l-violet-500',
  'Fabrique': 'border-l-indigo-500',
  'House Pacaembu': 'border-l-sky-500',
  'Complexo Jussara': 'border-l-emerald-500',
  'Espaço Solon': 'border-l-orange-500',
}

interface EventListProps {
  eventos: Evento[]
  selectedDate?: Date | null
}

export default function EventList({ eventos, selectedDate }: EventListProps) {
  const filtered = selectedDate
    ? eventos.filter((e) => {
        const [y, m, d] = e.data.split('-').map(Number)
        const date = new Date(y, m - 1, d)
        return (
          date.getFullYear() === selectedDate.getFullYear() &&
          date.getMonth() === selectedDate.getMonth() &&
          date.getDate() === selectedDate.getDate()
        )
      })
    : [...eventos].sort((a, b) => a.data.localeCompare(b.data))

  return (
    <div className="rounded-xl border border-app-border bg-app-surface p-5">
      <h3 className="text-sm font-semibold text-app-text mb-4">
        {selectedDate ? `Eventos em ${formatDate(selectedDate.toISOString().split('T')[0])}` : 'Próximos Eventos'}
      </h3>

      {filtered.length === 0 ? (
        <p className="text-sm text-app-subtle py-6 text-center">Nenhum evento nesta data.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((evento) => (
            <div
              key={evento.id}
              className={`rounded-lg border border-app-border2/50 bg-app-surface2/50 p-3.5 border-l-2 ${espacoColors[evento.espaco] ?? 'border-l-zinc-500'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-app-text truncate">{evento.cliente}</p>
                  <p className="text-xs text-app-muted mt-0.5">{evento.tipo}</p>
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadge[evento.status]}`}>
                  {evento.status}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap gap-3">
                <div className="flex items-center gap-1 text-xs text-app-subtle">
                  <MapPin className="h-3 w-3" />
                  {evento.espaco}
                </div>
                <div className="flex items-center gap-1 text-xs text-app-subtle">
                  <Clock className="h-3 w-3" />
                  {formatDate(evento.data)} · {evento.horaInicio}–{evento.horaFim}
                </div>
                <div className="ml-auto text-xs font-semibold text-violet-400">
                  {formatCurrency(evento.valor)}
                </div>
              </div>

              {evento.observacoes && (
                <p className="mt-2 text-xs text-app-subtle bg-app-surface/50 rounded px-2 py-1 border border-app-border2/30">
                  {evento.observacoes}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
