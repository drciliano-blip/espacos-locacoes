'use client'

import { useState } from 'react'
import { Users, DollarSign, CalendarCheck, TrendingUp } from 'lucide-react'
import type { EspacoConfig } from '@/lib/espacos-config'
import type { Evento } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import EventoDrawer from '@/components/eventos/EventoDrawer'

const statusBadge: Record<string, string> = {
  confirmado: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  tentativo: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  cancelado: 'bg-red-500/10 text-red-400 border-red-500/20',
}

interface EspacoPageProps {
  config: EspacoConfig
  eventos: Evento[]
}

export default function EspacoPage({ config, eventos }: EspacoPageProps) {
  const [selectedEvento, setSelectedEvento] = useState<Evento | null>(null)
  const [eventosState, setEventosState] = useState<Evento[]>(eventos)

  const receitaTotal = eventosState
    .filter((e) => e.status === 'confirmado')
    .reduce((s, e) => s + e.valor, 0)

  const confirmados = eventosState.filter((e) => e.status === 'confirmado').length

  const mediaPessoas = eventosState.length > 0
    ? Math.round(eventosState.filter((e) => e.numeroPessoas).reduce((s, e) => s + (e.numeroPessoas ?? 0), 0) / eventosState.filter((e) => e.numeroPessoas).length)
    : 0

  const taxaOcupacao = Math.min(100, Math.round((mediaPessoas / config.capacidade) * 100))

  const proximosEventos = [...eventosState]
    .filter((e) => e.status !== 'cancelado')
    .sort((a, b) => a.data.localeCompare(b.data))
    .slice(0, 6)

  function handleUpdate(updated: Evento) {
    setEventosState((prev) => prev.map((e) => e.id === updated.id ? updated : e))
    setSelectedEvento(updated)
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className={`rounded-xl border ${config.borderClass} ${config.bgClass} p-5`}>
        <div className="flex items-start gap-4">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${config.bgClass} border ${config.borderClass}`}>
            <span className={`text-2xl font-black ${config.colorClass}`}>
              {config.nome.charAt(0)}
            </span>
          </div>
          <div>
            <h2 className={`text-xl font-bold ${config.colorClass}`}>{config.nome}</h2>
            <p className="text-sm text-app-muted mt-0.5">{config.descricao}</p>
            <p className="text-xs text-app-subtle mt-1">Capacidade máxima: <span className="font-semibold text-app-text2">{config.capacidade} pessoas</span></p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Receita Total', value: formatCurrency(receitaTotal), icon: DollarSign, color: config.colorClass },
          { label: 'Eventos Confirmados', value: String(confirmados), icon: CalendarCheck, color: 'text-emerald-400' },
          { label: 'Média de Pessoas', value: mediaPessoas > 0 ? String(mediaPessoas) : '—', icon: Users, color: 'text-sky-400' },
          { label: 'Taxa de Ocupação', value: taxaOcupacao > 0 ? `${taxaOcupacao}%` : '—', icon: TrendingUp, color: 'text-amber-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border border-app-border bg-app-surface p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-app-subtle">{label}</p>
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
            <p className={`text-xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {taxaOcupacao > 0 && (
        <div className="rounded-xl border border-app-border bg-app-surface p-4">
          <div className="flex justify-between text-xs mb-2">
            <span className="text-app-muted font-medium">Ocupação média dos eventos</span>
            <span className={`font-semibold ${config.colorClass}`}>{taxaOcupacao}%</span>
          </div>
          <div className="h-2 rounded-full bg-app-surface3 overflow-hidden">
            <div
              className={`h-full rounded-full ${config.dotClass} transition-all`}
              style={{ width: `${taxaOcupacao}%` }}
            />
          </div>
          <p className="text-xs text-app-subtle mt-1">{mediaPessoas} / {config.capacidade} pessoas (média)</p>
        </div>
      )}

      {/* Categorias de Eventos */}
      <div className="rounded-xl border border-app-border bg-app-surface p-5">
        <h3 className="text-sm font-semibold text-app-text mb-4">Categorias de Eventos</h3>
        <div className="space-y-2.5">
          {config.categorias.map((cat) => {
            const count = eventosState.filter(
              (e) => e.tipo.toLowerCase() === cat.label.toLowerCase() && e.status !== 'cancelado'
            ).length
            const total = eventosState.filter((e) => e.status !== 'cancelado').length
            const pct = total > 0 ? Math.round((count / total) * 100) : 0
            return (
              <div key={cat.label}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${cat.dotColor}`} />
                    <span className={`font-medium ${cat.textColor}`}>{cat.label}</span>
                  </div>
                  <div className="flex items-center gap-3 text-app-subtle">
                    <span>{count} evento{count !== 1 ? 's' : ''}</span>
                    <span className="font-semibold text-app-text2">{pct}%</span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-app-surface2 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${cat.barColor} transition-all`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="rounded-xl border border-app-border bg-app-surface">
        <div className="px-5 py-4 border-b border-app-border">
          <h3 className="text-sm font-semibold text-app-text">
            Eventos ({eventosState.length})
          </h3>
        </div>

        {eventosState.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-app-subtle">Nenhum evento cadastrado para este espaço.</p>
          </div>
        ) : (
          <div className="divide-y divide-app-border/50">
            {proximosEventos.map((evento) => (
              <button
                key={evento.id}
                onClick={() => setSelectedEvento(evento)}
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-app-surface2/30 transition-colors text-left"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-app-text truncate">{evento.cliente}</p>
                  <p className="text-xs text-app-subtle">{evento.tipo} · {formatDate(evento.data)} · {evento.horaInicio}–{evento.horaFim}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  {evento.numeroPessoas && (
                    <span className="text-xs text-app-subtle flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {evento.numeroPessoas}
                    </span>
                  )}
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadge[evento.status]}`}>
                    {evento.status}
                  </span>
                  <span className={`text-sm font-semibold ${config.colorClass}`}>
                    {formatCurrency(evento.valor)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedEvento && (
        <EventoDrawer
          evento={eventosState.find((e) => e.id === selectedEvento.id) ?? selectedEvento}
          onClose={() => setSelectedEvento(null)}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  )
}
