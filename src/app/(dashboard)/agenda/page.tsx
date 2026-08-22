'use client'

import { useState, useMemo } from 'react'
import { Plus } from 'lucide-react'
import CalendarView from '@/components/agenda/CalendarView'
import EventList from '@/components/agenda/EventList'
import GoogleCalendarView from '@/components/agenda/GoogleCalendarView'
import EventoDrawer from '@/components/eventos/EventoDrawer'
import NovoEventoModal from '@/components/eventos/NovoEventoModal'
import Toast from '@/components/shared/Toast'
import { useEventos } from '@/contexts/EventosContext'
import { useCurrentUser } from '@/contexts/UserContext'
import { useEspacoAtivo, MSG_ESPACO_ESPECIFICO_NECESSARIO } from '@/contexts/EspacoAtivoContext'
import type { Evento, Espaco } from '@/types'

export default function AgendaPage() {
  const { eventos, addEvento, updateEvento, deleteEvento } = useEventos()
  const { role } = useCurrentUser()
  const { espacosEmEscopo, espacoUnico, precisaEspacoEspecifico } = useEspacoAtivo()

  const [selectedDate, setSelectedDate]     = useState<Date | null>(null)
  const [selectedEvento, setSelectedEvento] = useState<Evento | null>(null)
  const [novoEventoOpen, setNovoEventoOpen] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  function showToast(msg: string) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3500)
  }

  const eventosFiltrados = useMemo(() => {
    if (!espacosEmEscopo) return eventos
    return eventos.filter(e => espacosEmEscopo.includes(e.espaco))
  }, [eventos, espacosEmEscopo])

  async function handleUpdate(updated: Evento) {
    await updateEvento(updated)
    setSelectedEvento(updated)
  }

  async function handleDelete(id: string) {
    await deleteEvento(id)
    setSelectedEvento(null)
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto">

      {/* Espaço já é definido globalmente pelo Dashboard — aqui só mostra
          quantos eventos estão em escopo e o botão de criar. */}
      <div className="flex items-center gap-2 flex-wrap">
        {espacosEmEscopo && (
          <span className="text-xs text-app-subtle">
            {eventosFiltrados.length} evento{eventosFiltrados.length !== 1 ? 's' : ''}
          </span>
        )}

        {/* Botão Novo Evento */}
        {role !== 'socio' && (
          <button
            onClick={() => {
              if (precisaEspacoEspecifico()) { showToast(MSG_ESPACO_ESPECIFICO_NECESSARIO); return }
              setNovoEventoOpen(true)
            }}
            className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white shrink-0 transition-opacity"
            style={{ backgroundColor: '#25D366' }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#128C7E' }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#25D366' }}
          >
            <Plus className="h-3.5 w-3.5" />
            Novo Evento
          </button>
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

      {/* Google Calendar */}
      <GoogleCalendarView />

      {selectedEvento && (
        <EventoDrawer
          evento={eventos.find(e => e.id === selectedEvento.id) ?? selectedEvento}
          onClose={() => setSelectedEvento(null)}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      )}

      {novoEventoOpen && (
        <NovoEventoModal
          espacoPadrao={(espacoUnico ?? undefined) as Espaco | undefined}
          onClose={() => setNovoEventoOpen(false)}
          onSave={addEvento}
        />
      )}

      <Toast message={toastMsg} />
    </div>
  )
}
