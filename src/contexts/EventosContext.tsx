'use client'

import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { eventos as mockEventos } from '@/lib/mock-data'
import type { Evento } from '@/types'

interface EventosContextValue {
  eventos: Evento[]
  addEvento: (e: Evento) => void
  updateEvento: (e: Evento) => void
}

const EventosContext = createContext<EventosContextValue | null>(null)

export function EventosProvider({ children }: { children: ReactNode }) {
  const [eventos, setEventos] = useState<Evento[]>(mockEventos)

  function addEvento(e: Evento) {
    setEventos(prev => [e, ...prev])
  }

  function updateEvento(e: Evento) {
    setEventos(prev => prev.map(x => (x.id === e.id ? e : x)))
  }

  return (
    <EventosContext.Provider value={{ eventos, addEvento, updateEvento }}>
      {children}
    </EventosContext.Provider>
  )
}

export function useEventos(): EventosContextValue {
  const ctx = useContext(EventosContext)
  if (!ctx) throw new Error('useEventos must be used inside EventosProvider')
  return ctx
}
