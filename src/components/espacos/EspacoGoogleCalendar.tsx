'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { Calendar, ExternalLink, LogOut as Disconnect, RefreshCw, Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isSameMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface GCalEvent {
  id: string
  summary: string
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
  htmlLink: string
}

const GREEN = '#25D366'
const DARK_GREEN = '#128C7E'
const MAX_CHIPS_POR_DIA = 3

interface Props {
  espacoId: string
  espacoNome: string
  // 'lista' (padrão): mantém o comportamento original — próximos 30 dias
  // numa lista simples, usado em Espaços → [espaço]. 'calendario': mês
  // navegável com os eventos como blocos dentro de cada dia, usado na
  // Agenda principal (onde esse bloco é o "calendário grande" da tela).
  variant?: 'lista' | 'calendario'
}

function dataDoEvento(ev: GCalEvent): Date | null {
  if (ev.start.date) {
    const [y, m, d] = ev.start.date.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  if (ev.start.dateTime) return new Date(ev.start.dateTime)
  return null
}

function horaCurta(ev: GCalEvent): string {
  if (!ev.start.dateTime) return ''
  return new Date(ev.start.dateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export default function EspacoGoogleCalendar({ espacoId, espacoNome, variant = 'lista' }: Props) {
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
  const [mesExibido, setMesExibido] = useState(() => {
    const hoje = new Date()
    return new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  })

  const carregarEventos = useCallback(async (mes: Date) => {
    const params = new URLSearchParams({ espacoId })
    if (variant === 'calendario') {
      const inicio = startOfMonth(mes)
      const fim = new Date(mes.getFullYear(), mes.getMonth() + 1, 0, 23, 59, 59)
      params.set('timeMin', inicio.toISOString())
      params.set('timeMax', fim.toISOString())
    }
    const evRes = await fetch(`/api/google-calendar/events?${params.toString()}`)
    const evData = await evRes.json()
    if (!evRes.ok || evData.error) {
      setError(evData.error ?? 'Não foi possível carregar os eventos.')
    } else {
      setEvents(evData.events ?? [])
    }
  }, [espacoId, variant])

  const carregarStatus = useCallback(async (tentativa = 0) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/google-calendar/status?espacoId=${espacoId}`)
      // 401 aqui é quase sempre a sessão do Supabase ainda não pronta —
      // acontece com frequência quando o navegador suspende a aba em
      // segundo plano e recarrega a página ao voltar pra ela. Sem retry,
      // isso derrubava a tela pra "desconectado" mesmo com a conexão real
      // intacta no banco, obrigando a reconectar à toa.
      if (res.status === 401 && tentativa < 2) {
        await new Promise(r => setTimeout(r, 800))
        return carregarStatus(tentativa + 1)
      }
      if (!res.ok) throw new Error(`Erro ${res.status} ao verificar conexão.`)
      const data = await res.json()
      setConnected(!!data.connected)
      setEmail(data.email ?? null)
      if (data.connected) await carregarEventos(mesExibido)
    } catch {
      setError('Não foi possível verificar a conexão com o Google Calendar. Atualize a página.')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [espacoId, carregarEventos])

  useEffect(() => { carregarStatus() }, [carregarStatus])

  // Troca de mês (só na visão de calendário) — refaz a busca de eventos pro
  // novo intervalo, sem precisar checar a conexão de novo.
  useEffect(() => {
    if (variant === 'calendario' && connected) carregarEventos(mesExibido)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesExibido])

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
      await carregarEventos(mesExibido)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar evento.')
    } finally {
      setCreating(false)
    }
  }

  // Evento de dia inteiro vem só com "date" (ex: '2026-08-15'), sem horário —
  // `new Date('2026-08-15')` interpreta isso como meia-noite UTC, que em
  // horário de Brasília já é o dia anterior, fazendo a data exibida "andar"
  // um dia pra trás. `dateTime` já vem com timezone explícito, esse não sofre
  // do mesmo problema.
  function fmtDate(ev: GCalEvent) {
    if (ev.start.date) {
      const [y, m, d] = ev.start.date.split('-').map(Number)
      return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    }
    if (!ev.start.dateTime) return ''
    return new Date(ev.start.dateTime).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
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
        {error && (
          <div className="w-full rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5 text-left">
            <p className="text-xs text-red-500">{error}</p>
          </div>
        )}
      </div>
    )
  }

  const dias = variant === 'calendario' ? eachDayOfInterval({ start: startOfMonth(mesExibido), end: endOfMonth(mesExibido) }) : []
  const primeiroDiaSemana = variant === 'calendario' ? getDay(startOfMonth(mesExibido)) : 0
  const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

  function eventosDoDia(dia: Date) {
    return events.filter(ev => {
      const d = dataDoEvento(ev)
      return d && isSameDay(d, dia)
    })
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
          <button onClick={() => carregarEventos(mesExibido)} title="Atualizar" className="flex h-7 w-7 items-center justify-center rounded-lg text-app-muted hover:bg-app-surface2 transition-colors">
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

      {variant === 'calendario' ? (
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-app-text capitalize">
              {format(mesExibido, 'MMMM yyyy', { locale: ptBR })}
            </h4>
            <div className="flex gap-1">
              <button
                onClick={() => setMesExibido(new Date(mesExibido.getFullYear(), mesExibido.getMonth() - 1, 1))}
                className="flex h-7 w-7 items-center justify-center rounded-md text-app-muted hover:bg-app-surface2 hover:text-app-text transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setMesExibido(new Date(mesExibido.getFullYear(), mesExibido.getMonth() + 1, 1))}
                className="flex h-7 w-7 items-center justify-center rounded-md text-app-muted hover:bg-app-surface2 hover:text-app-text transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {diasSemana.map(d => (
              <div key={d} className="text-center text-xs font-medium text-app-subtle py-1">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: primeiroDiaSemana }).map((_, i) => <div key={`empty-${i}`} />)}
            {dias.map(dia => {
              const eventosDia = eventosDoDia(dia)
              const isToday = isSameDay(dia, new Date())
              const isCurrentMonth = isSameMonth(dia, mesExibido)
              return (
                <div
                  key={dia.toISOString()}
                  className={`flex flex-col items-stretch rounded-lg p-1.5 min-h-[92px] sm:min-h-[112px] border border-transparent ${!isCurrentMonth ? 'opacity-30' : ''}`}
                >
                  <span
                    className="text-xs font-medium mb-1 h-5 w-5 flex items-center justify-center rounded-full self-end shrink-0"
                    style={isToday ? { backgroundColor: GREEN, color: 'white' } : undefined}
                  >
                    {format(dia, 'd')}
                  </span>
                  <div className="flex-1 min-w-0 flex flex-col gap-0.5 overflow-hidden">
                    {eventosDia.slice(0, MAX_CHIPS_POR_DIA).map(ev => (
                      <button
                        key={ev.id}
                        onClick={() => window.open(ev.htmlLink, '_blank', 'noopener,noreferrer')}
                        title={`${ev.summary} · ${fmtTime(ev)}`}
                        className="w-full truncate rounded px-1 py-0.5 text-left text-[10px] font-medium leading-tight bg-[#25D366]/15 text-[#128C7E] hover:opacity-80 transition-opacity"
                      >
                        {horaCurta(ev) ? `${horaCurta(ev)} ` : ''}{ev.summary}
                      </button>
                    ))}
                    {eventosDia.length > MAX_CHIPS_POR_DIA && (
                      <span className="px-1 text-[10px] text-app-subtle">+{eventosDia.length - MAX_CHIPS_POR_DIA} mais</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
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
      )}
    </div>
  )
}
