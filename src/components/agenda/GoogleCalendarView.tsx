'use client'

import { useState, useEffect, useRef } from 'react'
import { Calendar, Plus, ExternalLink, RefreshCw, LogOut as Disconnect } from 'lucide-react'

interface GCalEvent {
  id: string
  summary: string
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
  location?: string
  htmlLink: string
}

interface NewEventForm {
  title: string
  date: string
  startTime: string
  endTime: string
  espaco: string
}

const ESPACOS = ['Usine', 'Fabrique', 'House Pacaembu', 'Complexo Jussara', 'Espaço Solon']

const GREEN = '#25D366'
const DARK_GREEN = '#128C7E'

export default function GoogleCalendarView() {
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [events, setEvents] = useState<GCalEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [gisLoaded, setGisLoaded] = useState(false)
  const [newEventOpen, setNewEventOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newEvent, setNewEvent] = useState<NewEventForm>({
    title: '', date: '', startTime: '', endTime: '', espaco: '',
  })
  const tokenClientRef = useRef<{ requestAccessToken: () => void } | null>(null)

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

  useEffect(() => {
    if (!clientId || typeof window === 'undefined') return
    if (document.querySelector('script[src*="accounts.google.com/gsi/client"]')) {
      setGisLoaded(true)
      return
    }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => setGisLoaded(true)
    document.head.appendChild(script)
  }, [clientId])

  useEffect(() => {
    if (!gisLoaded || !clientId) return
    const g = (window as Window & { google?: { accounts?: { oauth2?: { initTokenClient: (cfg: object) => { requestAccessToken: () => void }; revoke: (token: string, cb?: () => void) => void } } } }).google
    tokenClientRef.current = g?.accounts?.oauth2?.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/calendar',
      callback: async (response: { error?: string; access_token?: string }) => {
        if (response.error || !response.access_token) {
          setError('Erro ao conectar: ' + (response.error ?? 'sem token'))
          return
        }
        setAccessToken(response.access_token)
        await loadEvents(response.access_token)
      },
    }) ?? null
  }, [gisLoaded, clientId])

  async function loadEvents(token: string) {
    setLoading(true)
    setError(null)
    try {
      const now = new Date()
      const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now.toISOString()}&timeMax=${future.toISOString()}&orderBy=startTime&singleEvents=true&maxResults=25`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      if (res.status === 401) { setAccessToken(null); setError('Sessão expirada. Reconecte.'); return }
      if (!res.ok) throw new Error('Erro HTTP ' + res.status)
      const data = await res.json() as { items?: GCalEvent[] }
      setEvents(data.items ?? [])
    } catch {
      setError('Não foi possível carregar os eventos do Google Calendar.')
    } finally {
      setLoading(false)
    }
  }

  function connect() {
    tokenClientRef.current?.requestAccessToken()
  }

  function disconnect() {
    const g = (window as Window & { google?: { accounts?: { oauth2?: { revoke: (t: string, cb?: () => void) => void } } } }).google
    if (accessToken) g?.accounts?.oauth2?.revoke(accessToken)
    setAccessToken(null)
    setEvents([])
    setError(null)
  }

  async function createEvent() {
    if (!accessToken || !newEvent.title.trim() || !newEvent.date) return
    setCreating(true)
    setError(null)
    try {
      const body: Record<string, unknown> = {
        summary: newEvent.espaco ? `[${newEvent.espaco}] ${newEvent.title}` : newEvent.title,
        start: newEvent.startTime
          ? { dateTime: `${newEvent.date}T${newEvent.startTime}:00`, timeZone: 'America/Sao_Paulo' }
          : { date: newEvent.date },
        end: newEvent.endTime
          ? { dateTime: `${newEvent.date}T${newEvent.endTime}:00`, timeZone: 'America/Sao_Paulo' }
          : { date: newEvent.date },
      }
      if (newEvent.espaco) body.location = `${newEvent.espaco} — São Paulo, SP`

      const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Erro HTTP ' + res.status)
      setNewEventOpen(false)
      setNewEvent({ title: '', date: '', startTime: '', endTime: '', espaco: '' })
      await loadEvents(accessToken)
    } catch {
      setError('Não foi possível criar o evento.')
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

  /* ── sem Client ID configurado ── */
  if (!clientId) {
    return (
      <div className="rounded-xl border border-app-border bg-app-surface p-6 flex flex-col items-center gap-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-app-surface2">
          <Calendar className="h-7 w-7 text-app-subtle" />
        </div>
        <div>
          <p className="text-sm font-semibold text-app-text">Google Calendar</p>
          <p className="text-xs text-app-muted mt-1 max-w-sm">
            Configure o Client ID para sincronizar eventos criados no dashboard com o Google Calendar.
          </p>
        </div>
        <div className="relative group">
          <button
            disabled
            className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white opacity-40 cursor-not-allowed"
            style={{ backgroundColor: GREEN }}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="currentColor"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="currentColor"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="currentColor"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="currentColor"/>
            </svg>
            Conectar com Google Calendar
          </button>
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
            <div className="rounded-lg bg-[#111B21] text-white text-xs px-3 py-2 whitespace-nowrap shadow-lg">
              Configure o <code className="bg-white/20 px-1 rounded">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> no <code className="bg-white/20 px-1 rounded">.env.local</code>
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#111B21]" />
            </div>
          </div>
        </div>
        <p className="text-xs text-app-subtle">
          Consulte o arquivo <code className="rounded bg-app-surface2 px-1">GOOGLE_CALENDAR_SETUP.md</code> para instruções.
        </p>
      </div>
    )
  }

  /* ── não conectado ── */
  if (!accessToken) {
    return (
      <div className="rounded-xl border border-app-border bg-app-surface p-8 flex flex-col items-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: `${GREEN}20` }}>
          <Calendar className="h-8 w-8" style={{ color: GREEN }} />
        </div>
        <div>
          <p className="text-sm font-semibold text-app-text">Google Calendar</p>
          <p className="text-xs text-app-muted mt-1">
            Conecte sua conta para ver e criar eventos diretamente no dashboard
          </p>
        </div>
        <button
          onClick={connect}
          disabled={!gisLoaded}
          className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
          style={{ backgroundColor: GREEN }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = DARK_GREEN }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = GREEN }}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="currentColor"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="currentColor"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="currentColor"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="currentColor"/>
          </svg>
          Conectar com Google
        </button>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    )
  }

  /* ── conectado ── */
  return (
    <div className="rounded-xl border border-app-border bg-app-surface">

      {/* header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-app-border">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: GREEN }} />
          <h3 className="text-sm font-semibold text-app-text">Google Calendar</h3>
          {loading && <span className="text-xs text-app-muted">atualizando…</span>}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setNewEventOpen(v => !v)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-opacity"
            style={{ backgroundColor: GREEN }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = DARK_GREEN }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = GREEN }}
          >
            <Plus className="h-3.5 w-3.5" />
            Novo evento
          </button>
          <button
            onClick={() => loadEvents(accessToken)}
            title="Atualizar"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-app-muted hover:bg-app-surface2 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={disconnect}
            title="Desconectar"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-app-muted hover:text-red-500 hover:bg-red-500/10 transition-colors"
          >
            <Disconnect className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* formulário novo evento */}
      {newEventOpen && (
        <div className="px-5 py-4 border-b border-app-border bg-app-surface2/50 space-y-3">
          <p className="text-xs font-semibold text-app-text">Novo evento no Google Calendar</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-app-muted mb-1">Título *</label>
              <input
                value={newEvent.title}
                onChange={e => setNewEvent(v => ({ ...v, title: e.target.value }))}
                placeholder="Ex: Casamento Silva"
                className="w-full rounded-lg border border-app-border2 bg-app-surface px-2.5 py-1.5 text-sm text-app-text focus:outline-none"
                style={{ '--focus-ring': GREEN } as React.CSSProperties}
                onFocus={e => { e.currentTarget.style.borderColor = GREEN }}
                onBlur={e => { e.currentTarget.style.borderColor = '' }}
              />
            </div>
            <div>
              <label className="block text-xs text-app-muted mb-1">Data *</label>
              <input
                type="date"
                value={newEvent.date}
                onChange={e => setNewEvent(v => ({ ...v, date: e.target.value }))}
                className="w-full rounded-lg border border-app-border2 bg-app-surface px-2.5 py-1.5 text-sm text-app-text focus:outline-none"
                onFocus={e => { e.currentTarget.style.borderColor = GREEN }}
                onBlur={e => { e.currentTarget.style.borderColor = '' }}
              />
            </div>
            <div>
              <label className="block text-xs text-app-muted mb-1">Espaço</label>
              <select
                value={newEvent.espaco}
                onChange={e => setNewEvent(v => ({ ...v, espaco: e.target.value }))}
                className="w-full cursor-pointer rounded-lg border border-app-border2 bg-app-surface px-2.5 py-1.5 text-sm text-app-text focus:outline-none"
                onFocus={e => { e.currentTarget.style.borderColor = GREEN }}
                onBlur={e => { e.currentTarget.style.borderColor = '' }}
              >
                <option value="">Selecionar…</option>
                {ESPACOS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-app-muted mb-1">Início</label>
              <input
                type="time"
                value={newEvent.startTime}
                onChange={e => setNewEvent(v => ({ ...v, startTime: e.target.value }))}
                className="w-full rounded-lg border border-app-border2 bg-app-surface px-2.5 py-1.5 text-sm text-app-text focus:outline-none"
                onFocus={e => { e.currentTarget.style.borderColor = GREEN }}
                onBlur={e => { e.currentTarget.style.borderColor = '' }}
              />
            </div>
            <div>
              <label className="block text-xs text-app-muted mb-1">Fim</label>
              <input
                type="time"
                value={newEvent.endTime}
                onChange={e => setNewEvent(v => ({ ...v, endTime: e.target.value }))}
                className="w-full rounded-lg border border-app-border2 bg-app-surface px-2.5 py-1.5 text-sm text-app-text focus:outline-none"
                onFocus={e => { e.currentTarget.style.borderColor = GREEN }}
                onBlur={e => { e.currentTarget.style.borderColor = '' }}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => setNewEventOpen(false)}
              className="rounded-lg border border-app-border2 px-3 py-1.5 text-xs text-app-muted hover:bg-app-surface2 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={createEvent}
              disabled={!newEvent.title.trim() || !newEvent.date || creating}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
              style={{ backgroundColor: GREEN }}
            >
              {creating ? 'Criando…' : 'Criar evento'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="px-5 py-2.5 text-xs text-red-500 border-b border-app-border bg-red-50">
          {error}
        </div>
      )}

      {/* lista de eventos */}
      <div className="divide-y divide-app-border/60 max-h-96 overflow-y-auto">
        {events.length === 0 && !loading ? (
          <div className="py-10 text-center">
            <Calendar className="h-8 w-8 mx-auto mb-2 text-app-subtle" />
            <p className="text-sm text-app-muted">Nenhum evento nos próximos 30 dias.</p>
          </div>
        ) : events.map(ev => (
          <div key={ev.id} className="flex items-start justify-between gap-3 px-5 py-3 hover:bg-app-surface2/40 transition-colors">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-app-text truncate">{ev.summary}</p>
              <div className="flex flex-wrap gap-3 mt-0.5">
                <span className="text-xs text-app-muted">{fmtDate(ev)}</span>
                <span className="text-xs text-app-subtle">{fmtTime(ev)}</span>
                {ev.location && (
                  <span className="text-xs text-app-subtle truncate">· {ev.location}</span>
                )}
              </div>
            </div>
            <a
              href={ev.htmlLink}
              target="_blank"
              rel="noopener noreferrer"
              title="Abrir no Google Calendar"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-app-subtle hover:text-app-text transition-colors mt-0.5"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        ))}
      </div>
    </div>
  )
}
