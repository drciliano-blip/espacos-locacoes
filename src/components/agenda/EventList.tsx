'use client'

import { Clock, MapPin, User } from 'lucide-react'
import type { Evento, TipoEvento } from '@/types'
import { formatDate, formatCurrency } from '@/lib/utils'

export type AbaAgenda = 'proximos' | 'passados' | 'mes'

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
  'Locação Portaria': 'bg-slate-500/10 text-slate-400',
}

interface EventListProps {
  // Já vem filtrado pelo pai (page.tsx) — dia selecionado, aba
  // próximos/passados ou mês do calendário. Esse é o único lugar onde a
  // lista é calculada, pra "Exportar Relação" nunca divergir do que está
  // sendo mostrado aqui.
  eventos: Evento[]
  selectedDate?: Date | null
  aba: AbaAgenda
  onAbaChange: (aba: AbaAgenda) => void
  mesAnoLabel: string
  onEventoClick?: (evento: Evento) => void
  // Esconde a aba "mês" quando quem usa este componente já mostra os
  // eventos do mês diretamente em outro lugar (ex: calendário com chips na
  // Agenda) — evita repetir a mesma lista duas vezes na tela. A aba
  // continua existindo por baixo (nenhuma prop nem exportação removida),
  // só o botão some.
  mostrarAbaMes?: boolean
}

export default function EventList({ eventos, selectedDate, aba, onAbaChange, mesAnoLabel, onEventoClick, mostrarAbaMes = true }: EventListProps) {
  return (
    <div className="rounded-xl border border-app-border bg-app-surface p-5">
      {selectedDate ? (
        <h3 className="text-sm font-semibold text-app-text mb-4">
          {`Eventos em ${formatDate(selectedDate.toISOString().split('T')[0])}`}
          <span className="ml-2 text-xs font-normal text-app-muted">({eventos.length})</span>
        </h3>
      ) : (
        <div className="flex items-center gap-1 mb-4 flex-wrap">
          {(['proximos', 'passados', 'mes'] as const).filter(tab => tab !== 'mes' || mostrarAbaMes).map(tab => (
            <button
              key={tab}
              onClick={() => onAbaChange(tab)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors capitalize ${
                aba === tab ? 'text-white' : 'bg-[#F0F2F5] text-[#667781] hover:bg-[#E9EDEF]'
              }`}
              style={aba === tab ? { backgroundColor: '#25D366' } : undefined}
            >
              {tab === 'proximos' ? 'Próximos Eventos' : tab === 'passados' ? 'Eventos Passados' : mesAnoLabel}
            </button>
          ))}
          <span className="ml-2 text-xs font-normal text-app-muted">({eventos.length})</span>
        </div>
      )}

      {eventos.length === 0 ? (
        <p className="text-sm text-app-subtle py-6 text-center">
          {selectedDate ? 'Nenhum evento nesta data.' : aba === 'proximos' ? 'Nenhum evento próximo.' : aba === 'passados' ? 'Nenhum evento passado.' : 'Nenhum evento neste mês.'}
        </p>
      ) : (
        <div className="space-y-2">
          {eventos.map((evento) => (
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

              {evento.responsavel && (
                <div className="mt-2 flex items-center gap-1 text-xs text-app-subtle">
                  <User className="h-3 w-3" />
                  {evento.responsavel}{evento.telefoneContato ? ` · ${evento.telefoneContato}` : ''}
                </div>
              )}

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
