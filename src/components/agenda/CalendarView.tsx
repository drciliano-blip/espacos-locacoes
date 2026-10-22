'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isSameMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useEspacos } from '@/contexts/EspacosContext'
import type { Evento } from '@/types'

const MAX_ETIQUETAS_POR_DIA = 3

interface CalendarViewProps {
  eventos: Evento[]
  onDaySelect: (date: Date | null) => void
  selectedDate: Date | null
  // Avisa o mês/ano exibido pra quem quiser acompanhar sem precisar controlar
  // o mês por fora — quem não passar (ex: EspacoPage) continua funcionando
  // igual, sem nenhum efeito colateral.
  onMonthChange?: (month: Date) => void
}

export default function CalendarView({ eventos, onDaySelect, selectedDate, onMonthChange }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const hoje = new Date()
    return new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  })

  useEffect(() => { onMonthChange?.(currentMonth) }, [currentMonth, onMonthChange])

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  })

  // Cor de cada espaço vem do cadastro (mesma do seletor de espaço do topo).
  const { espacosConfig } = useEspacos()
  const corDoEspaco = (nome: string) => espacosConfig.find(c => c.nome === nome)?.dotClass ?? 'bg-zinc-500'
  // Vendo mais de um espaço, a etiqueta leva o nome do espaço na frente.
  const variosEspacos = new Set(eventos.map(e => e.espaco)).size > 1

  const firstDayOfWeek = getDay(startOfMonth(currentMonth))
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

  function getEventsForDay(day: Date) {
    return eventos.filter((e) => {
      const [y, m, d] = e.data.split('-').map(Number)
      return isSameDay(day, new Date(y, m - 1, d))
    })
  }

  return (
    <div className="rounded-xl border border-app-border bg-app-surface p-5">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-semibold text-app-text capitalize">
          {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
        </h2>
        <div className="flex gap-1">
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))}
            className="flex h-7 w-7 items-center justify-center rounded-md text-app-muted hover:bg-app-surface2 hover:text-app-text transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))}
            className="flex h-7 w-7 items-center justify-center rounded-md text-app-muted hover:bg-app-surface2 hover:text-app-text transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {weekDays.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-app-subtle py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}

        {days.map((day) => {
          const dayEvents = getEventsForDay(day)
          const isSelected = selectedDate ? isSameDay(day, selectedDate) : false
          const isCurrentMonth = isSameMonth(day, currentMonth)
          const isToday = isSameDay(day, new Date())

          return (
            <button
              key={day.toISOString()}
              onClick={() => onDaySelect(isSelected ? null : day)}
              className={`relative flex flex-col items-center sm:items-stretch rounded-lg p-1.5 min-h-[52px] sm:min-h-[104px] transition-colors ${
                isSelected
                  ? 'bg-[#25D366]/15 border border-[#25D366]/35'
                  : 'hover:bg-app-surface2 border border-transparent'
              } ${!isCurrentMonth ? 'opacity-30' : ''}`}
            >
              <span
                className={`text-xs font-medium mb-1 h-5 w-5 flex items-center justify-center rounded-full sm:self-center shrink-0 ${
                  isToday
                    ? 'text-white'
                    : isSelected
                    ? 'text-[#25D366]'
                    : 'text-app-text2'
                }`}
                style={isToday ? { backgroundColor: '#25D366' } : undefined}
              >
                {format(day, 'd')}
              </span>
              {/* Celular: coluna estreita demais pra texto — só a bolinha na cor do espaço. */}
              <div className="flex sm:hidden flex-wrap gap-0.5 justify-center">
                {dayEvents.slice(0, 3).map((e, i) => (
                  <span
                    key={i}
                    className={`h-1.5 w-1.5 rounded-full ${e.status === 'cancelado' ? 'bg-zinc-400/60' : corDoEspaco(e.espaco)}`}
                    title={e.status === 'cancelado' ? 'Cancelado' : e.espaco}
                  />
                ))}
              </div>
              {/* Computador: etiqueta como no Google Agenda — cor do espaço com o nome escrito. */}
              <div className="hidden sm:flex flex-col gap-0.5 min-w-0">
                {dayEvents.slice(0, MAX_ETIQUETAS_POR_DIA).map((e, i) => {
                  const texto = variosEspacos ? `${e.espaco} · ${e.cliente}` : e.cliente
                  const cancelado = e.status === 'cancelado'
                  return (
                    <span
                      key={i}
                      title={`${e.cliente} · ${e.espaco} · ${e.horaInicio?.slice(0, 5) ?? ''}–${e.horaFim?.slice(0, 5) ?? ''}${cancelado ? ' · Cancelado' : ''}`}
                      className={`block w-full truncate rounded px-1.5 py-0.5 text-left text-[10px] font-semibold leading-tight text-white ${
                        cancelado ? 'bg-zinc-400/70 line-through' : corDoEspaco(e.espaco)
                      }`}
                    >
                      {texto}
                    </span>
                  )
                })}
                {dayEvents.length > MAX_ETIQUETAS_POR_DIA && (
                  <span className="px-1 text-[10px] text-app-subtle text-left">+{dayEvents.length - MAX_ETIQUETAS_POR_DIA} mais</span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      <div className="mt-4 border-t border-app-border pt-4 space-y-2">
        <div className="flex flex-wrap gap-3">
          {espacosConfig.map(({ nome, dotClass }) => (
            <div key={nome} className={`flex items-center rounded px-2 py-0.5 ${dotClass}`}>
              <span className="text-xs font-semibold text-white">{nome}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-1.5">
            <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-white bg-zinc-400/70 line-through">Evento</span>
            <span className="text-xs text-app-subtle">Cancelado</span>
          </div>
        </div>
      </div>
    </div>
  )
}
