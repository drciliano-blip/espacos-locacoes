'use client'

import { useState, useMemo } from 'react'
import CalendarView from '@/components/agenda/CalendarView'
import EventList from '@/components/agenda/EventList'
import EventoDrawer from '@/components/eventos/EventoDrawer'
import { eventos as initialEventos } from '@/lib/mock-data'
import type { Evento, Espaco } from '@/types'

const ESPACOS_LISTA: Espaco[] = ['Usine', 'Fabrique', 'House Pacaembu', 'Complexo Jussara', 'Espaço Solon']

const espacoDotColors: Record<Espaco, string> = {
  'Usine': 'bg-violet-500',
  'Fabrique': 'bg-indigo-500',
  'House Pacaembu': 'bg-sky-500',
  'Complexo Jussara': 'bg-emerald-500',
  'Espaço Solon': 'bg-orange-500',
}

export default function AgendaPage() {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [eventos, setEventos] = useState<Evento[]>(initialEventos)
  const [selectedEvento, setSelectedEvento] = useState<Evento | null>(null)
  const [espacosFiltro, setEspacosFiltro] = useState<Set<Espaco>>(new Set())

  function toggleEspaco(espaco: Espaco) {
    setEspacosFiltro((prev) => {
      const next = new Set(prev)
      if (next.has(espaco)) {
        next.delete(espaco)
      } else {
        next.add(espaco)
      }
      return next
    })
  }

  const eventosFiltrados = useMemo(() => {
    if (espacosFiltro.size === 0) return eventos
    return eventos.filter((e) => espacosFiltro.has(e.espaco))
  }, [eventos, espacosFiltro])

  function handleUpdate(updated: Evento) {
    setEventos((prev) => prev.map((e) => e.id === updated.id ? updated : e))
    setSelectedEvento(updated)
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Filtro de espaços */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-app-subtle font-medium shrink-0">Filtrar por espaço:</span>
        <button
          onClick={() => setEspacosFiltro(new Set())}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-all border ${
            espacosFiltro.size === 0
              ? 'bg-violet-500/20 text-violet-300 border-violet-500/30'
              : 'text-app-muted border-app-border2 hover:text-app-text'
          }`}
        >
          Todos
        </button>
        {ESPACOS_LISTA.map((espaco) => (
          <button
            key={espaco}
            onClick={() => toggleEspaco(espaco)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all border ${
              espacosFiltro.has(espaco)
                ? 'bg-app-surface2 text-app-text border-app-border'
                : 'text-app-muted border-app-border2 hover:text-app-text'
            }`}
          >
            <span className={`h-2 w-2 rounded-full shrink-0 ${espacoDotColors[espaco]}`} />
            {espaco}
          </button>
        ))}
        {espacosFiltro.size > 0 && (
          <span className="text-xs text-app-subtle ml-1">
            {eventosFiltrados.length} evento{eventosFiltrados.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4 items-start">
        <CalendarView
          eventos={eventosFiltrados}
          selectedDate={selectedDate}
          onDaySelect={setSelectedDate}
        />
        <EventList
          eventos={eventosFiltrados}
          selectedDate={selectedDate}
          onEventoClick={setSelectedEvento}
        />
      </div>

      {selectedEvento && (
        <EventoDrawer
          evento={selectedEvento}
          onClose={() => setSelectedEvento(null)}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  )
}
