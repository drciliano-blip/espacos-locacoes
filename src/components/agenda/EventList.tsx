'use client'

import { useState } from 'react'
import { Clock, MapPin } from 'lucide-react'
import type { Evento, TipoEvento } from '@/types'
import { formatDate, formatCurrency } from '@/lib/utils'

const statusBadge: Record<string, string> = {
  confirmado: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  cancelado:  'bg-red-500/10 text-red-400 border-red-500/20',
}

const statusLabel: Record<string, string> = {
  confirmado: 'Confirmado',
  cancelado:  'Cancelado',
}

const espacoColors: Record<string, string> = {
  'Usine': 'border-l-violet-500',
  'Fabrique': 'border-l-indigo-500',
  'House Pacaembu': 'border-l-sky-500',
  'Complexo Jussara': 'border-l-emerald-500',
  'Espaço Solon': 'border-l-orange-500',
}

const tipoEventoColors: Record<TipoEvento, string> = {
  'Festivo': 'bg-pink-500/10 text-pink-400',
  'Corporativo': 'bg-blue-500/10 text-blue-400',
  'Audiovisual': 'bg-orange-500/10 text-orange-400',
}

// Um evento do próprio dia só vira "passado" depois que o horário de término dele já
// passou — antes disso, mesmo sendo hoje, ainda conta como "próximo".
function isEventoPassado(evento: Evento, agora: Date): boolean {
  const [y, m, d] = evento.data.split('-').map(Number)
  const dataEvento = new Date(y, m - 1, d)
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate())
  if (dataEvento.getTime() !== hoje.getTime()) return dataEvento.getTime() < hoje.getTime()
  if (!evento.horaFim) return false
  const [hh, mm] = evento.horaFim.split(':').map(Number)
  const fimEvento = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), hh || 0, mm || 0)
  return agora.getTime() > fimEvento.getTime()
}

interface EventListProps {
  eventos: Evento[]
  selectedDate?: Date | null
  onEventoClick?: (evento: Evento) => void
}

export default function EventList({ eventos, selectedDate, onEventoClick }: EventListProps) {
  const [aba, setAba] = useState<'proximos' | 'passados'>('proximos')

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
    : (() => {
        const agora = new Date()
        const proximos = eventos.filter(e => !isEventoPassado(e, agora)).sort((a, b) => a.data.localeCompare(b.data))
        const passados = eventos.filter(e => isEventoPassado(e, agora)).sort((a, b) => b.data.localeCompare(a.data))
        return aba === 'proximos' ? proximos : passados
      })()

  return (
    <div className="rounded-xl border border-app-border bg-app-surface p-5">
      {selectedDate ? (
        <h3 className="text-sm font-semibold text-app-text mb-4">
          {`Eventos em ${formatDate(selectedDate.toISOString().split('T')[0])}`}
          <span className="ml-2 text-xs font-normal text-app-muted">({filtered.length})</span>
        </h3>
      ) : (
        <div className="flex items-center gap-1 mb-4">
          {(['proximos', 'passados'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setAba(tab)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                aba === tab ? 'text-white' : 'bg-[#F0F2F5] text-[#667781] hover:bg-[#E9EDEF]'
              }`}
              style={aba === tab ? { backgroundColor: '#25D366' } : undefined}
            >
              {tab === 'proximos' ? 'Próximos Eventos' : 'Eventos Passados'}
            </button>
          ))}
          <span className="ml-2 text-xs font-normal text-app-muted">({filtered.length})</span>
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-app-subtle py-6 text-center">
          {selectedDate ? 'Nenhum evento nesta data.' : aba === 'proximos' ? 'Nenhum evento próximo.' : 'Nenhum evento passado.'}
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((evento) => (
            <button
              key={evento.id}
              onClick={() => onEventoClick?.(evento)}
              className={`w-full text-left rounded-lg border border-app-border2/50 bg-app-surface2/50 p-3.5 border-l-2 ${espacoColors[evento.espaco] ?? 'border-l-zinc-500'} hover:bg-app-surface2 transition-colors`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-app-text truncate">{evento.cliente}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-app-muted">{evento.tipo}</p>
                    {evento.tipoEvento && (
                      <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${tipoEventoColors[evento.tipoEvento]}`}>
                        {evento.tipoEvento}
                      </span>
                    )}
                  </div>
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadge[evento.status]}`}>
                  {statusLabel[evento.status] ?? evento.status}
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
                <div className="ml-auto text-xs font-semibold text-[#25D366]">
                  {formatCurrency(evento.valor)}
                </div>
              </div>

              {evento.observacoes && (
                <p className="mt-2 text-xs text-app-subtle bg-app-surface/50 rounded px-2 py-1 border border-app-border2/30 text-left">
                  {evento.observacoes}
                </p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
