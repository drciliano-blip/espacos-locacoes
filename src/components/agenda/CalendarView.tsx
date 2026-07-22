'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isSameMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Evento } from '@/types'

const espacoColors: Record<string, string> = {
  'Usine': 'bg-violet-500',
  'Fabrique': 'bg-indigo-500',
  'House Pacaembu': 'bg-sky-500',
  'Complexo Jussara': 'bg-emerald-500',
  'Espaço Solon': 'bg-orange-500',
}

interface CalendarViewProps {
  eventos: Evento[]
  onDaySelect: (date: Date | null) => void
  selectedDate: Date | null
}

export default function CalendarView({ eventos, onDaySelect, selectedDate }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const hoje = new Date()
    return new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  })

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  })

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
              className={`relative flex flex-col items-center rounded-lg p-1.5 min-h-[52px] transition-colors ${
                isSelected
                  ? 'bg-[#25D366]/15 border border-[#25D366]/35'
                  : 'hover:bg-app-surface2 border border-transparent'
              } ${!isCurrentMonth ? 'opacity-30' : ''}`}
            >
              <span
                className={`text-xs font-medium mb-1 h-5 w-5 flex items-center justify-center rounded-full ${
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
              <div className="flex flex-wrap gap-0.5 justify-center">
                {dayEvents.slice(0, 3).map((e, i) => (
                  e.status === 'em_negociacao' ? (
                    <span
                      key={i}
                      className="h-1.5 w-1.5 rounded-full border border-amber-400 bg-amber-400/30"
                      title="Em negociação"
                    />
                  ) : e.status === 'cancelado' ? (
                    <span
                      key={i}
                      className="h-1.5 w-1.5 rounded-full bg-red-400/60"
                      title="Cancelado"
                    />
                  ) : (
                    <span
                      key={i}
                      className={`h-1.5 w-1.5 rounded-full ${espacoColors[e.espaco] ?? 'bg-zinc-500'}`}
                      title={e.espaco}
                    />
                  )
                ))}
              </div>
            </button>
          )
        })}
      </div>

      <div className="mt-4 border-t border-app-border pt-4 space-y-2">
        <div className="flex flex-wrap gap-3">
          {Object.entries(espacoColors).map(([espaco, color]) => (
            <div key={espaco} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${color}`} />
              <span className="text-xs text-app-muted">{espaco}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-xs text-app-subtle">Confirmado</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full border border-amber-400 bg-amber-400/30" />
            <span className="text-xs text-app-subtle">Em negociação</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-red-400/60" />
            <span className="text-xs text-app-subtle">Cancelado</span>
          </div>
        </div>
      </div>
    </div>
  )
}
