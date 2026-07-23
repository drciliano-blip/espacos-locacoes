'use client'

import { useState, useMemo, useRef } from 'react'
import type { ComponentType } from 'react'
import {
  Users, DollarSign, CalendarCheck, TrendingUp,
  Building2, FileText, User, MapPin,
  CheckCircle2, AlertCircle, XCircle, BarChart3,
  Activity, ChevronRight, Layers, Plus, Clock,
  List, CalendarDays,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import type { EspacoConfig } from '@/lib/espacos-config'
import type { Evento } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import EventoDrawer from '@/components/eventos/EventoDrawer'
import NovoEventoModal from '@/components/eventos/NovoEventoModal'
import EspacoLogo from '@/components/espacos/EspacoLogo'
import CalendarView from '@/components/agenda/CalendarView'
import EspacoGoogleCalendar from '@/components/espacos/EspacoGoogleCalendar'
import DadosLegaisSection from '@/components/espacos/DadosLegaisSection'
import MinutasEspacoSection from '@/components/espacos/MinutasEspacoSection'
import FileAttachButton from '@/components/shared/FileAttachButton'
import FileList from '@/components/shared/FileList'
import { useEventos } from '@/contexts/EventosContext'
import { useEspacos } from '@/contexts/EspacosContext'
import { useReceitas } from '@/contexts/ReceitasContext'
import { useAtividades, type TipoAtividade } from '@/contexts/AtividadesContext'
import { saveFile } from '@/lib/file-storage'

// ─── local types ─────────────────────────────────────────────────────────────

type SpaceTab = 'eventos' | 'documentos' | 'financeiro' | 'atividades'

// ─── static config ───────────────────────────────────────────────────────────

const COR_HEX: Record<string, string> = {
  violet: '#8b5cf6',
  indigo: '#6366f1',
  sky: '#0ea5e9',
  emerald: '#10b981',
  orange: '#f97316',
}

const STATUS_CFG: Record<string, { badge: string; label: string; Icon: ComponentType<{ className?: string }> }> = {
  confirmado:    { badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', label: 'Confirmado',     Icon: CheckCircle2 },
  em_negociacao: { badge: 'bg-amber-500/10  text-amber-400  border-amber-500/20',    label: 'Em negociação',  Icon: AlertCircle },
  cancelado:     { badge: 'bg-red-500/10    text-red-400    border-red-500/20',       label: 'Cancelado',      Icon: XCircle },
}

const AT_CFG: Record<TipoAtividade, { color: string; Icon: ComponentType<{ className?: string }> }> = {
  evento:      { color: 'text-emerald-400 bg-emerald-500/10', Icon: CalendarCheck },
  contrato:    { color: 'text-violet-400 bg-violet-500/10',   Icon: FileText },
  financeiro:  { color: 'text-amber-400 bg-amber-500/10',     Icon: DollarSign },
  funcionario: { color: 'text-sky-400 bg-sky-500/10',         Icon: Users },
  espaco:      { color: 'text-zinc-400 bg-zinc-500/10',       Icon: Building2 },
}

const TABS: { key: SpaceTab; label: string; Icon: ComponentType<{ className?: string }> }[] = [
  { key: 'eventos',    label: 'Eventos',    Icon: CalendarCheck },
  { key: 'documentos', label: 'Documentos', Icon: Layers },
  { key: 'financeiro', label: 'Financeiro', Icon: BarChart3 },
  { key: 'atividades', label: 'Atividades', Icon: Activity },
]

function formatTimestamp(ts: string) {
  const d = new Date(ts)
  const now = new Date()
  const days = Math.floor((now.getTime() - d.getTime()) / 86400000)
  const hhmm = d.toTimeString().slice(0, 5)
  if (days === 0) return `Hoje, ${hhmm}`
  if (days === 1) return `Ontem, ${hhmm}`
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}, ${hhmm}`
}

// ─── component ────────────────────────────────────────────────────────────────

interface EspacoPageProps {
  config: EspacoConfig
}

export default function EspacoPage({ config }: EspacoPageProps) {
  const { eventos: todosEventos, addEvento, updateEvento, deleteEvento } = useEventos()
  const { updateEspacoFoto } = useEspacos()
  const { atividades: todasAtividades } = useAtividades()
  const { receitas: todasReceitas } = useReceitas()

  const [tab, setTab]                       = useState<SpaceTab>('eventos')
  const [selectedEvento, setSelectedEvento] = useState<Evento | null>(null)
  const [statusFiltro, setStatusFiltro]     = useState<string>('todos')
  const [novoEventoOpen, setNovoEventoOpen] = useState(false)
  const [eventosView, setEventosView]       = useState<'lista' | 'calendario'>('lista')
  const [calendarDate, setCalendarDate]     = useState<Date | null>(null)
  const [uploadingFoto, setUploadingFoto]   = useState(false)
  const fotoInputRef = useRef<HTMLInputElement>(null)

  async function handleFotoChange(file: File | null) {
    if (!file || !config.id) return
    setUploadingFoto(true)
    try {
      const stored = await saveFile(file, { module: 'espacos', entityId: config.id, entityName: config.nome, categoria: 'logo' })
      await updateEspacoFoto(config.id, stored.id)
    } finally {
      setUploadingFoto(false)
      if (fotoInputRef.current) fotoInputRef.current.value = ''
    }
  }

  // Events for this specific space, derived from global context
  const eventosEspaco = useMemo(
    () => todosEventos.filter(e => e.espaco === config.nome),
    [todosEventos, config.nome],
  )

  const atividadesEspaco = useMemo(
    () => todasAtividades.filter(a => a.espaco === config.nome),
    [todasAtividades, config.nome],
  )

  const parcelasEspaco = useMemo(
    () => todasReceitas.filter(r => r.espaco === config.nome && r.categoriaSlug === 'aluguel' && r.parcelaNumero != null),
    [todasReceitas, config.nome],
  )
  const totalContratado = parcelasEspaco.reduce((s, r) => s + r.valor, 0)
  const totalRecebido = parcelasEspaco.filter(r => r.status === 'pago').reduce((s, r) => s + r.valor, 0)
  const totalEmAberto = totalContratado - totalRecebido

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const receitaConfirmada = useMemo(
    () => eventosEspaco.filter(e => e.status === 'confirmado').reduce((s, e) => s + e.valor, 0),
    [eventosEspaco],
  )
  const confirmados = eventosEspaco.filter(e => e.status === 'confirmado').length
  const ticketMedio = confirmados > 0 ? receitaConfirmada / confirmados : 0

  const eventsWithPeople = eventosEspaco.filter(e => (e.numeroPessoas ?? 0) > 0)
  const mediaPessoas = eventsWithPeople.length > 0
    ? Math.round(eventsWithPeople.reduce((s, e) => s + (e.numeroPessoas ?? 0), 0) / eventsWithPeople.length)
    : 0
  const taxaOcupacao = mediaPessoas > 0 ? Math.min(100, Math.round((mediaPessoas / config.capacidade) * 100)) : 0

  // ── Eventos filtrados ──────────────────────────────────────────────────────
  const eventosMostrados = useMemo(() => {
    const base = statusFiltro === 'todos' ? eventosEspaco : eventosEspaco.filter(e => e.status === statusFiltro)
    return [...base].sort((a, b) => a.data.localeCompare(b.data))
  }, [eventosEspaco, statusFiltro])

  const eventosVisiveis = useMemo(() => {
    if (eventosView !== 'calendario' || !calendarDate) return eventosMostrados
    return eventosMostrados.filter(e => {
      const [y, m, d] = e.data.split('-').map(Number)
      return y === calendarDate.getFullYear() && m - 1 === calendarDate.getMonth() && d === calendarDate.getDate()
    })
  }, [eventosMostrados, eventosView, calendarDate])

  // ── Dados para gráfico ─────────────────────────────────────────────────────
  const monthlyData = useMemo(() => {
    const acc: Record<string, number> = {}
    eventosEspaco.filter(e => e.status === 'confirmado').forEach(e => {
      const [, m] = e.data.split('-')
      const label = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][Number(m) - 1]
      acc[label] = (acc[label] ?? 0) + e.valor
    })
    return Object.entries(acc).map(([mes, valor]) => ({ mes, valor }))
  }, [eventosEspaco])

  // ── Handlers ──────────────────────────────────────────────────────────────
  async function handleUpdate(updated: Evento) {
    await updateEvento(updated)
    setSelectedEvento(updated)
  }

  async function handleDeleteEvento(id: string) {
    await deleteEvento(id)
    setSelectedEvento(null)
  }

  const statusChips = [
    { key: 'todos',     label: 'Todos',      count: eventosEspaco.length },
    { key: 'confirmado',label: 'Confirmados', count: eventosEspaco.filter(e => e.status === 'confirmado').length },
    { key: 'em_negociacao', label: 'Em negociação', count: eventosEspaco.filter(e => e.status === 'em_negociacao').length },
    { key: 'cancelado', label: 'Cancelados',  count: eventosEspaco.filter(e => e.status === 'cancelado').length },
  ]

  const barColor = COR_HEX[config.cor] ?? '#8b5cf6'

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 max-w-6xl mx-auto">

      {/* ── 1. Informações gerais do espaço ─────────────────────────────── */}
      <div className={`rounded-xl border ${config.borderClass} ${config.bgClass} p-5`}>
        <div className="flex items-start gap-4">
          <div className="relative shrink-0 group">
            <EspacoLogo
              fotoFileId={config.fotoFileId}
              fallbackLetter={config.nome.charAt(0)}
              colorClass={config.colorClass}
              bgClass={config.bgClass}
              borderClass={config.borderClass}
              size="lg"
            />
            <input ref={fotoInputRef} type="file" accept="image/*" className="hidden" onChange={e => handleFotoChange(e.target.files?.[0] ?? null)} />
            <button
              onClick={() => fotoInputRef.current?.click()}
              disabled={uploadingFoto || !config.id}
              title="Trocar foto"
              className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/60 text-white text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity disabled:cursor-not-allowed"
            >
              {uploadingFoto ? '…' : 'Trocar'}
            </button>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className={`text-xl font-bold ${config.colorClass}`}>{config.nome}</h2>
            <p className="text-sm text-app-muted mt-0.5">{config.descricao}</p>
            <div className="flex flex-wrap items-center gap-4 mt-2">
              <span className="flex items-center gap-1.5 text-xs text-app-subtle">
                <Users className="h-3.5 w-3.5" />
                Capacidade: <span className={`font-semibold ml-0.5 ${config.colorClass}`}>{config.capacidade} pessoas</span>
              </span>
              <span className="flex items-center gap-1.5 text-xs text-app-subtle">
                <MapPin className="h-3.5 w-3.5" />
                São Paulo, SP
              </span>
              <span className="flex items-center gap-1.5 text-xs text-app-subtle">
                <CalendarCheck className="h-3.5 w-3.5" />
                {eventosEspaco.length} evento{eventosEspaco.length !== 1 ? 's' : ''} cadastrado{eventosEspaco.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
          <button
            onClick={() => setNovoEventoOpen(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-medium text-white hover:bg-violet-500 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Novo Evento
          </button>
        </div>
      </div>

      {/* ── 4. Resumo financeiro — KPI cards ────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Receita Confirmada', value: formatCurrency(receitaConfirmada), Icon: DollarSign,    color: config.colorClass },
          { label: 'Eventos Confirmados',value: String(confirmados),                Icon: CalendarCheck, color: 'text-emerald-400' },
          { label: 'Ticket Médio',       value: ticketMedio > 0 ? formatCurrency(ticketMedio) : '—', Icon: TrendingUp, color: 'text-sky-400' },
          { label: 'Taxa de Ocupação',   value: taxaOcupacao > 0 ? `${taxaOcupacao}%` : '—', Icon: Users, color: 'text-amber-400' },
        ].map(({ label, value, Icon, color }) => (
          <div key={label} className="rounded-xl border border-app-border bg-app-surface p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-app-subtle">{label}</p>
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
            <p className={`text-xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* ── Tab navigation ──────────────────────────────────────────────── */}
      <div className="rounded-xl border border-app-border bg-app-surface overflow-hidden">
        <div className="flex border-b border-app-border px-1 overflow-x-auto">
          {TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`relative flex shrink-0 items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                tab === key ? config.colorClass : 'text-app-muted hover:text-app-text'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
              {tab === key && (
                <span className={`absolute bottom-0 left-0 right-0 h-0.5 ${config.dotClass}`} />
              )}
            </button>
          ))}
        </div>

        {/* ── 2. Lista de eventos ────────────────────────────────────────── */}
        {tab === 'eventos' && (
          <div className="p-5">
            <div className="flex flex-wrap items-center gap-2 mb-5">
              {statusChips.map(({ key, label, count }) => (
                <button
                  key={key}
                  onClick={() => setStatusFiltro(key)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-all border ${
                    statusFiltro === key
                      ? `${config.bgClass} ${config.colorClass} ${config.borderClass}`
                      : 'text-app-muted border-app-border2 hover:text-app-text'
                  }`}
                >
                  {label}
                  <span className="ml-1.5 opacity-60">{count}</span>
                </button>
              ))}

              <div className="ml-auto flex items-center gap-1 rounded-lg border border-app-border2 p-0.5">
                <button
                  onClick={() => setEventosView('lista')}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    eventosView === 'lista' ? `${config.bgClass} ${config.colorClass}` : 'text-app-muted hover:text-app-text'
                  }`}
                >
                  <List className="h-3.5 w-3.5" />
                  Lista
                </button>
                <button
                  onClick={() => setEventosView('calendario')}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    eventosView === 'calendario' ? `${config.bgClass} ${config.colorClass}` : 'text-app-muted hover:text-app-text'
                  }`}
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  Calendário
                </button>
              </div>
            </div>

            {eventosView === 'calendario' && (
              <div className="mb-5">
                <CalendarView
                  eventos={eventosMostrados}
                  selectedDate={calendarDate}
                  onDaySelect={setCalendarDate}
                />
              </div>
            )}

            {eventosVisiveis.length === 0 ? (
              <div className="py-12 text-center">
                <CalendarCheck className="h-8 w-8 text-app-border2 mx-auto mb-3" />
                <p className="text-sm text-app-muted">Nenhum evento encontrado.</p>
              </div>
            ) : (
              <div className="divide-y divide-app-border/40">
                {eventosVisiveis.map((evento) => {
                  const sc = STATUS_CFG[evento.status] ?? STATUS_CFG['em_negociacao']
                  const iconColor = sc.badge.split(' ')[1]
                  return (
                    <button
                      key={evento.id}
                      onClick={() => setSelectedEvento(evento)}
                      className="w-full flex items-center justify-between py-3.5 px-1 hover:bg-app-surface2/30 transition-colors text-left rounded-lg"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <sc.Icon className={`h-4 w-4 mt-0.5 shrink-0 ${iconColor}`} />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-app-text truncate">{evento.cliente}</p>
                          <p className="text-xs text-app-subtle mt-0.5">
                            {evento.tipo} · {formatDate(evento.data)} · {evento.horaInicio}–{evento.horaFim}
                            {(evento.numeroPessoas ?? 0) > 0 && ` · ${evento.numeroPessoas} pessoas`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-4">
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${sc.badge}`}>
                          {sc.label}
                        </span>
                        <span className={`text-sm font-semibold ${config.colorClass}`}>
                          {formatCurrency(evento.valor)}
                        </span>
                        <ChevronRight className="h-4 w-4 text-app-subtle" />
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {config.id && (
              <div className="mt-6">
                <EspacoGoogleCalendar espacoId={config.id} espacoNome={config.nome} />
              </div>
            )}
          </div>
        )}

        {/* ── 3. Documentos do espaço (arquivos reais no Supabase Storage) ── */}
        {tab === 'documentos' && (
          <div className="p-5">
            {config.id ? (
              <>
                <div className="flex flex-wrap gap-2 mb-4">
                  <FileAttachButton module="espacos" entityId={config.id} entityName={config.nome} categoria="contrato" label="Anexar contrato" />
                  <FileAttachButton module="espacos" entityId={config.id} entityName={config.nome} categoria="alvara" label="Anexar alvará" />
                  <FileAttachButton module="espacos" entityId={config.id} entityName={config.nome} categoria="outro" label="Outros documentos" />
                </div>
                <FileList module="espacos" entityId={config.id} entityName={config.nome} showAttach={false} />
                <div className="mt-6">
                  <MinutasEspacoSection espacoId={config.id} espacoNome={config.nome} />
                </div>
                <div className="mt-6">
                  <DadosLegaisSection espacoId={config.id} dadosLegais={config.dadosLegais} />
                </div>
              </>
            ) : (
              <p className="text-sm text-app-muted text-center py-8">Espaço ainda não sincronizado — recarregue a página.</p>
            )}
          </div>
        )}

        {/* ── 4. Resumo financeiro detalhado ────────────────────────────── */}
        {tab === 'financeiro' && (
          <div className="p-5 space-y-5">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Receita Confirmada', value: formatCurrency(receitaConfirmada), color: config.colorClass },
                { label: 'Receita Em Negociação', value: formatCurrency(eventosEspaco.filter(e => e.status === 'em_negociacao').reduce((s, e) => s + e.valor, 0)), color: 'text-amber-400' },
                { label: 'Ticket Médio',        value: ticketMedio > 0 ? formatCurrency(ticketMedio) : '—', color: 'text-sky-400' },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-lg border border-app-border2/50 bg-app-surface2/30 p-4">
                  <p className="text-xs text-app-subtle mb-1">{label}</p>
                  <p className={`text-lg font-bold ${color}`}>{value}</p>
                </div>
              ))}
            </div>

            <div>
              <h4 className="text-sm font-semibold text-app-text mb-3">Plano de Pagamento — Todos os Eventos</h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-app-border2/50 bg-app-surface2/30 p-4">
                  <p className="text-xs text-app-subtle mb-1">Total Contratado</p>
                  <p className="text-lg font-bold text-app-text">{formatCurrency(totalContratado)}</p>
                </div>
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <p className="text-xs text-emerald-600 mb-1">Recebido</p>
                  <p className="text-lg font-bold text-emerald-600">{formatCurrency(totalRecebido)}</p>
                </div>
                <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
                  <p className="text-xs text-amber-600 mb-1">Em Aberto</p>
                  <p className="text-lg font-bold text-amber-600">{formatCurrency(totalEmAberto)}</p>
                </div>
              </div>
            </div>

            {monthlyData.length > 0 ? (
              <div>
                <h4 className="text-sm font-semibold text-app-text mb-3">Receita Confirmada por Mês</h4>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="mes" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false}
                        tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        contentStyle={{ background: '#1a1a2e', border: '1px solid #2d2d3a', borderRadius: 8, fontSize: 12 }}
                        formatter={(v: unknown) => [formatCurrency(Number(v)), 'Receita']}
                      />
                      <Bar dataKey="valor" radius={4} fill={barColor} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center">
                <p className="text-sm text-app-muted">Nenhum evento confirmado para gerar gráfico.</p>
              </div>
            )}

            <div>
              <h4 className="text-sm font-semibold text-app-text mb-3">Categorias de Eventos</h4>
              <div className="space-y-2.5">
                {config.categorias.map((cat) => {
                  const total = eventosEspaco.filter(e => e.status !== 'cancelado').length
                  const count = eventosEspaco.filter(e => e.tipo.toLowerCase() === cat.label.toLowerCase() && e.status !== 'cancelado').length
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
                          <span className="font-semibold text-app-text2 w-8 text-right">{pct}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-app-surface3 overflow-hidden">
                        <div className={`h-full rounded-full ${cat.barColor} transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── 5. Feed de atividades reais ────────────────────────────────── */}
        {tab === 'atividades' && (
          <div className="p-5">
            <p className="text-xs text-app-muted mb-5">Histórico de ações registradas neste espaço</p>
            {atividadesEspaco.length === 0 ? (
              <div className="py-12 text-center">
                <Activity className="h-8 w-8 text-app-border2 mx-auto mb-3" />
                <p className="text-sm text-app-muted">Nenhuma atividade registrada ainda.</p>
              </div>
            ) : (
              <div className="space-y-0">
                {atividadesEspaco.map((at, i) => {
                  const ac = AT_CFG[at.tipo]
                  return (
                    <div key={at.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${ac.color}`}>
                          <ac.Icon className="h-4 w-4" />
                        </div>
                        {i < atividadesEspaco.length - 1 && (
                          <div className="w-px flex-1 min-h-[20px] bg-app-border2/30 my-1" />
                        )}
                      </div>
                      <div className="pb-4 pt-0.5 min-w-0">
                        <p className="text-sm font-medium text-app-text leading-snug">{at.acao}</p>
                        {at.detalhes && (
                          <p className="text-xs text-app-muted mt-0.5 truncate">{at.detalhes}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          <span className="flex items-center gap-1 text-xs text-app-subtle">
                            <User className="h-3 w-3" />
                            {at.usuarioNome ?? '—'}
                          </span>
                          <span className="text-app-border2">·</span>
                          <span className="flex items-center gap-1 text-xs text-app-subtle">
                            <Clock className="h-3 w-3" />
                            {formatTimestamp(at.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* EventoDrawer */}
      {selectedEvento && (
        <EventoDrawer
          evento={todosEventos.find(e => e.id === selectedEvento.id) ?? selectedEvento}
          onClose={() => setSelectedEvento(null)}
          onUpdate={handleUpdate}
          onDelete={handleDeleteEvento}
        />
      )}

      {/* Novo Evento */}
      {novoEventoOpen && (
        <NovoEventoModal
          espacoPadrao={config.nome as import('@/types').Espaco}
          onClose={() => setNovoEventoOpen(false)}
          onSave={addEvento}
        />
      )}
    </div>
  )
}
