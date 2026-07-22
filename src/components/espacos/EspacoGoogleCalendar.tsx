'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { Calendar, ExternalLink, LogOut as Disconnect, RefreshCw, Plus } from 'lucide-react'

interface GCalEvent {
  id: string
  summary: string
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
  htmlLink: string
}

const GREEN = '#25D366'
const DARK_GREEN = '#128C7E'

interface Props {
  espacoId: string
  espacoNome: string
}

export default function EspacoGoogleCalendar({ espacoId, espacoNome }: Props) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(false)
  const [email, setEmail] = useState<string | null>(null)
  const [events, setEvents] = useState<GCalEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)
  const [newEventOpen, setNewEventOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newEvent, setNewEvent] = useState({ title: '', date: '', startTime: '', endTime: '' })

  const carregarStatus = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/google-calendar/status?espacoId=${espacoId}`)
      const data = await res.json()
      setConnected(!!data.connected)
      setEmail(data.email ?? null)
      if (data.connected) {
        const evRes = await fetch(`/api/google-calendar/events?espacoId=${espacoId}`)
        const evData = await evRes.json()
        if (!evRes.ok || evData.error) {
          setError(evData.error ?? 'Não foi possível carregar os eventos.')
        } else {
          setEvents(evData.events ?? [])
        }
      }
    } catch {
      setError('Não foi possível verificar a conexão com o Google Calendar.')
    } finally {
      setLoading(false)
    }
  }, [espacoId])

  useEffect(() => { carregarStatus() }, [carregarStatus])

  useEffect(() => {
    if (searchParams.get('google') === 'connected') {
      router.replace(pathname)
      carregarStatus()
    }
    const googleError = searchParams.get('google_error')
    if (googleError) {
      setError(googleError)
      router.replace(pathname)
    }
  }, [searchParams, pathname, router, carregarStatus])

  function conectar() {
    window.location.href = `/api/google-calendar/authorize?espacoId=${espacoId}`
  }

  async function desconectar() {
    setDisconnecting(true)
    try {
      await fetch('/api/google-calendar/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ espacoId }),
      })
      setConnected(false)
      setEmail(null)
      setEvents([])
    } finally {
      setDisconnecting(false)
    }
  }

  async function criarEvento() {
    if (!newEvent.title.trim() || !newEvent.date) return
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/google-calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          espacoId,
          summary: newEvent.title,
          date: newEvent.date,
          startTime: newEvent.startTime || undefined,
          endTime: newEvent.endTime || undefined,
          location: `${espacoNome} — São Paulo, SP`,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? 'Erro ao criar evento.')
      setNewEventOpen(false)
      setNewEvent({ title: '', date: '', startTime: '', endTime: '' })
      await carregarStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar evento.')
    } finally {
      setCreating(false)
    }
  }

  function fmtDate(ev: GCalEvent) {
    const raw = ev.start.dateTime ?? ev.start.date ?? ''
    if (!raw) return ''
    return new Date(raw).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  function fmtTime(ev: GCalEvent) {
    if (!ev.start.dateTime) return 'Dia inteiro'
    const s = new Date(ev.start.dateTime)
    const e = new Date(ev.end.dateTime ?? ev.start.dateTime)
    const f = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    return `${f(s)} – ${f(e)}`
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-app-border bg-app-surface p-5 text-center">
        <p className="text-sm text-app-subtle">Verificando conexão com o Google Calendar…</p>
      </div>
    )
  }

  if (!connected) {
    return (
      <div className="rounded-xl border border-app-border bg-app-surface p-5 flex flex-col items-center gap-3 text-center">
        <Calendar className="h-6 w-6 text-app-subtle" />
        <div>
          <p className="text-sm font-semibold text-app-text">Google Calendar deste espaço</p>
          <p className="text-xs text-app-muted mt-1">Conecte a conta Google própria de {espacoNome} para sincronizar a agenda.</p>
        </div>
        <button
          onClick={conectar}
          className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
          style={{ backgroundColor: GREEN }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = DARK_GREEN }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = GREEN }}
        >
          Conectar Google Calendar
        </button>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-app-border bg-app-surface">
      <div className="flex items-center justify-between px-5 py-4 border-b border-app-border">
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: GREEN }} />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-app-text">Google Calendar</h3>
            <p className="text-xs text-app-subtle truncate">{email}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setNewEventOpen(v => !v)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors"
            style={{ backgroundColor: GREEN }}
          >
            <Plus className="h-3.5 w-3.5" />
            Novo evento
          </button>
          <button onClick={carregarStatus} title="Atualizar" className="flex h-7 w-7 items-center justify-center rounded-lg text-app-muted hover:bg-app-surface2 transition-colors">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button onClick={desconectar} disabled={disconnecting} title="Desconectar" className="flex h-7 w-7 items-center justify-center rounded-lg text-app-muted hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50">
            <Disconnect className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {newEventOpen && (
        <div className="px-5 py-4 border-b border-app-border bg-app-surface2/50 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-app-muted mb-1">Título *</label>
              <input
                value={newEvent.title}
                onChange={e => setNewEvent(v => ({ ...v, title: e.target.value }))}
                className="w-full rounded-lg border border-app-border2 bg-app-surface px-2.5 py-1.5 text-sm text-app-text focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-app-muted mb-1">Data *</label>
              <input
                type="date"
                value={newEvent.date}
                onChange={e => setNewEvent(v => ({ ...v, date: e.target.value }))}
                className="w-full rounded-lg border border-app-border2 bg-app-surface px-2.5 py-1.5 text-sm text-app-text focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-app-muted mb-1">Início</label>
                <input
                  type="time"
                  value={newEvent.startTime}
                  onChange={e => setNewEvent(v => ({ ...v, startTime: e.target.value }))}
                  className="w-full rounded-lg border border-app-border2 bg-app-surface px-2.5 py-1.5 text-sm text-app-text focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-app-muted mb-1">Fim</label>
                <input
                  type="time"
                  value={newEvent.endTime}
                  onChange={e => setNewEvent(v => ({ ...v, endTime: e.target.value }))}
                  className="w-full rounded-lg border border-app-border2 bg-app-surface px-2.5 py-1.5 text-sm text-app-text focus:outline-none"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setNewEventOpen(false)} className="rounded-lg border border-app-border2 px-3 py-1.5 text-xs text-app-muted hover:bg-app-surface2 transition-colors">
              Cancelar
            </button>
            <button
              onClick={criarEvento}
              disabled={!newEvent.title.trim() || !newEvent.date || creating}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40 transition-opacity"
              style={{ backgroundColor: GREEN }}
            >
              {creating ? 'Criando…' : 'Criar evento'}
            </button>
          </div>
        </div>
      )}

      {error && <div className="px-5 py-2.5 text-xs text-red-500 border-b border-app-border">{error}</div>}

      <div className="divide-y divide-app-border/60 max-h-72 overflow-y-auto">
        {events.length === 0 ? (
          <p className="py-8 text-center text-sm text-app-muted">Nenhum evento nos próximos 30 dias.</p>
        ) : events.map(ev => (
          <div key={ev.id} className="flex items-start justify-between gap-3 px-5 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-app-text truncate">{ev.summary}</p>
              <div className="flex gap-3 mt-0.5">
                <span className="text-xs text-app-muted">{fmtDate(ev)}</span>
                <span className="text-xs text-app-subtle">{fmtTime(ev)}</span>
              </div>
            </div>
            <a href={ev.htmlLink} target="_blank" rel="noopener noreferrer" className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-app-subtle hover:text-app-text transition-colors">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        ))}
      </div>
    </div>
  )
}
