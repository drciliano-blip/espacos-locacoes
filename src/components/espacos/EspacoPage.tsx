'use client'

import { useState, useMemo } from 'react'
import type { ComponentType } from 'react'
import {
  Users, DollarSign, CalendarCheck, TrendingUp,
  Building2, Upload, Trash2, FileText, FileCheck,
  File, Image, Shield, Clock, User, MapPin,
  CheckCircle2, AlertCircle, XCircle, BarChart3,
  Activity, ChevronRight, Layers, Plus,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import type { EspacoConfig } from '@/lib/espacos-config'
import type { Evento } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import EventoDrawer from '@/components/eventos/EventoDrawer'
import NovoEventoModal from '@/components/eventos/NovoEventoModal'
import { useEventos } from '@/contexts/EventosContext'

// ─── local types ─────────────────────────────────────────────────────────────

type SpaceTab = 'eventos' | 'documentos' | 'financeiro' | 'atividades'
type DocCategoria = 'contrato' | 'comprovante' | 'foto' | 'alvara' | 'outro'

interface DocumentoEspaco {
  id: string
  nome: string
  categoria: DocCategoria
  dataUpload: string
  usuario: string
  tamanho?: string
}

interface Atividade {
  id: string
  tipo: 'evento' | 'documento' | 'financeiro' | 'config'
  acao: string
  usuario: string
  timestamp: string
  detalhes?: string
}

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

const DOC_CFG: Record<DocCategoria, { label: string; color: string; Icon: ComponentType<{ className?: string }> }> = {
  contrato:   { label: 'Contrato',    color: 'text-violet-400 bg-violet-500/10',  Icon: FileText },
  comprovante:{ label: 'Comprovante', color: 'text-emerald-400 bg-emerald-500/10',Icon: FileCheck },
  foto:       { label: 'Foto',        color: 'text-sky-400 bg-sky-500/10',        Icon: Image },
  alvara:     { label: 'Alvará',      color: 'text-amber-400 bg-amber-500/10',    Icon: Shield },
  outro:      { label: 'Outro',       color: 'text-zinc-400 bg-zinc-500/10',      Icon: File },
}

const AT_CFG: Record<Atividade['tipo'], { color: string; Icon: ComponentType<{ className?: string }> }> = {
  evento:     { color: 'text-emerald-400 bg-emerald-500/10', Icon: CalendarCheck },
  documento:  { color: 'text-violet-400 bg-violet-500/10',   Icon: FileText },
  financeiro: { color: 'text-amber-400 bg-amber-500/10',     Icon: DollarSign },
  config:     { color: 'text-sky-400 bg-sky-500/10',         Icon: Building2 },
}

const TABS: { key: SpaceTab; label: string; Icon: ComponentType<{ className?: string }> }[] = [
  { key: 'eventos',    label: 'Eventos',    Icon: CalendarCheck },
  { key: 'documentos', label: 'Documentos', Icon: Layers },
  { key: 'financeiro', label: 'Financeiro', Icon: BarChart3 },
  { key: 'atividades', label: 'Atividades', Icon: Activity },
]

// ─── seed mock data per space ─────────────────────────────────────────────────

function seedDocs(nome: string): DocumentoEspaco[] {
  return [
    { id: 'd1', nome: `Alvara_${nome.replace(' ', '_')}_2025.pdf`, categoria: 'alvara',    dataUpload: '2025-01-10', usuario: 'Carlos Souza', tamanho: '1.2 MB' },
    { id: 'd2', nome: 'Contrato_Locacao_Modelo.docx',               categoria: 'contrato',  dataUpload: '2025-02-15', usuario: 'Ana Lima',     tamanho: '245 KB' },
    { id: 'd3', nome: `Fotos_${nome.replace(' ', '_')}_2025.zip`,   categoria: 'foto',      dataUpload: '2025-01-20', usuario: 'Pedro H.',     tamanho: '48 MB'  },
    { id: 'd4', nome: 'Comprovante_Reforma_2025.pdf',               categoria: 'comprovante',dataUpload: '2025-03-05', usuario: 'Ana Lima',     tamanho: '890 KB' },
  ]
}

function seedAtividades(nome: string): Atividade[] {
  return [
    { id: '1', tipo: 'evento',     acao: 'Evento confirmado',              usuario: 'Ana Lima',     timestamp: '2026-05-25T14:30:00', detalhes: `Reserva confirmada em ${nome}` },
    { id: '2', tipo: 'documento',  acao: 'Contrato adicionado',            usuario: 'Carlos Souza', timestamp: '2026-05-24T10:15:00', detalhes: 'Contrato_Locacao_2025.pdf' },
    { id: '3', tipo: 'financeiro', acao: 'Pagamento registrado',           usuario: 'Ana Lima',     timestamp: '2026-05-23T16:45:00', detalhes: 'Sinal recebido — R$ 3.500' },
    { id: '4', tipo: 'evento',     acao: 'Novo evento criado',             usuario: 'Pedro H.',     timestamp: '2026-05-22T09:00:00', detalhes: 'Reserva para cliente adicionada' },
    { id: '5', tipo: 'documento',  acao: 'Alvará de funcionamento enviado',usuario: 'Carlos Souza', timestamp: '2026-05-20T11:30:00', detalhes: `Alvara_${nome.replace(' ', '_')}_2025.pdf` },
    { id: '6', tipo: 'config',     acao: 'Informações do espaço atualizadas',usuario: 'Ana Lima',  timestamp: '2026-05-18T14:00:00', detalhes: 'Capacidade máxima revisada' },
    { id: '7', tipo: 'financeiro', acao: 'Contrato financeiro encerrado',  usuario: 'Pedro H.',     timestamp: '2026-05-15T17:30:00', detalhes: 'Valor total liquidado — evento concluído' },
    { id: '8', tipo: 'evento',     acao: 'Vistoria pós-evento realizada',  usuario: 'Carlos Souza', timestamp: '2026-05-10T10:00:00', detalhes: 'Vistoria: aprovada' },
  ]
}

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
  const { eventos: todosEventos, addEvento, updateEvento } = useEventos()

  const [tab, setTab]                       = useState<SpaceTab>('eventos')
  const [selectedEvento, setSelectedEvento] = useState<Evento | null>(null)
  const [statusFiltro, setStatusFiltro]     = useState<string>('todos')
  const [documentos, setDocumentos]         = useState<DocumentoEspaco[]>(() => seedDocs(config.nome))
  const [atividades]                        = useState<Atividade[]>(() => seedAtividades(config.nome))
  const [addingDoc, setAddingDoc]           = useState(false)
  const [newDoc, setNewDoc]                 = useState<{ nome: string; categoria: DocCategoria }>({ nome: '', categoria: 'contrato' })
  const [novoEventoOpen, setNovoEventoOpen] = useState(false)

  // Events for this specific space, derived from global context
  const eventosEspaco = useMemo(
    () => todosEventos.filter(e => e.espaco === config.nome),
    [todosEventos, config.nome],
  )

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
  function handleUpdate(updated: Evento) {
    updateEvento(updated)
    setSelectedEvento(updated)
  }

  function addDocumento() {
    if (!newDoc.nome.trim()) return
    setDocumentos(prev => [
      ...prev,
      { id: `d${Date.now()}`, nome: newDoc.nome.trim(), categoria: newDoc.categoria, dataUpload: new Date().toISOString().split('T')[0], usuario: 'Você' },
    ])
    setNewDoc({ nome: '', categoria: 'contrato' })
    setAddingDoc(false)
  }

  function removeDocumento(id: string) {
    setDocumentos(prev => prev.filter(d => d.id !== id))
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
          <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl ${config.bgClass} border ${config.borderClass}`}>
            <span className={`text-2xl font-black ${config.colorClass}`}>{config.nome.charAt(0)}</span>
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
            <div className="flex flex-wrap gap-2 mb-5">
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
            </div>

            {eventosMostrados.length === 0 ? (
              <div className="py-12 text-center">
                <CalendarCheck className="h-8 w-8 text-app-border2 mx-auto mb-3" />
                <p className="text-sm text-app-muted">Nenhum evento encontrado.</p>
              </div>
            ) : (
              <div className="divide-y divide-app-border/40">
                {eventosMostrados.map((evento) => {
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
          </div>
        )}

        {/* ── 3. Área de upload de documentos ───────────────────────────── */}
        {tab === 'documentos' && (
          <div className="p-5">
            {/* Category summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
              {(['contrato','comprovante','foto','alvara'] as DocCategoria[]).map((cat) => {
                const cfg = DOC_CFG[cat]
                const count = documentos.filter(d => d.categoria === cat).length
                return (
                  <div key={cat} className="rounded-lg border border-app-border2/50 bg-app-surface2/30 p-3 text-center">
                    <div className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${cfg.color} mb-1.5`}>
                      <cfg.Icon className="h-4 w-4" />
                    </div>
                    <p className="text-sm font-bold text-app-text">{count}</p>
                    <p className="text-xs text-app-subtle">{cfg.label}s</p>
                  </div>
                )
              })}
            </div>

            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-app-muted">
                {documentos.length} documento{documentos.length !== 1 ? 's' : ''} do espaço
              </p>
              {!addingDoc && (
                <button
                  onClick={() => setAddingDoc(true)}
                  className={`flex items-center gap-1.5 rounded-lg border ${config.borderClass} ${config.bgClass} px-3 py-1.5 text-xs font-medium ${config.colorClass} hover:opacity-80 transition-opacity`}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Adicionar documento
                </button>
              )}
            </div>

            {addingDoc && (
              <div className={`mb-4 rounded-lg border ${config.borderClass} ${config.bgClass} p-4 space-y-3`}>
                <p className={`text-xs font-semibold ${config.colorClass}`}>Novo documento</p>
                <div>
                  <label className="text-xs text-app-subtle mb-1 block">Nome do arquivo</label>
                  <input
                    value={newDoc.nome}
                    onChange={(e) => setNewDoc(d => ({ ...d, nome: e.target.value }))}
                    placeholder="Ex: Alvara_funcionamento_2025.pdf"
                    className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:border-violet-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-app-subtle mb-1 block">Categoria</label>
                  <select
                    value={newDoc.categoria}
                    onChange={(e) => setNewDoc(d => ({ ...d, categoria: e.target.value as DocCategoria }))}
                    className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:border-violet-500 focus:outline-none cursor-pointer"
                  >
                    <option value="contrato">Contrato</option>
                    <option value="comprovante">Comprovante</option>
                    <option value="foto">Foto</option>
                    <option value="alvara">Alvará</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setAddingDoc(false)}
                    className="rounded-lg border border-app-border2 px-3 py-1.5 text-xs text-app-muted hover:bg-app-surface2 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={addDocumento}
                    disabled={!newDoc.nome.trim()}
                    className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <Upload className="h-3 w-3" />
                    Adicionar
                  </button>
                </div>
              </div>
            )}

            {documentos.length === 0 ? (
              <div className="py-12 text-center">
                <Layers className="h-8 w-8 text-app-border2 mx-auto mb-3" />
                <p className="text-sm text-app-muted">Nenhum documento cadastrado</p>
              </div>
            ) : (
              <div className="space-y-2">
                {documentos.map((doc) => {
                  const cfg = DOC_CFG[doc.categoria] ?? DOC_CFG['outro']
                  return (
                    <div key={doc.id} className="flex items-center gap-3 rounded-lg border border-app-border2/50 bg-app-surface2/40 px-3.5 py-3">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${cfg.color}`}>
                        <cfg.Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-app-text truncate">{doc.nome}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5">
                          <span className="text-xs text-app-subtle">{cfg.label}</span>
                          <span className="text-app-border2">·</span>
                          <span className="text-xs text-app-subtle">{doc.dataUpload.split('-').reverse().join('/')}</span>
                          <span className="text-app-border2">·</span>
                          <span className="text-xs text-app-subtle">{doc.usuario}</span>
                          {doc.tamanho && (
                            <>
                              <span className="text-app-border2">·</span>
                              <span className="text-xs text-app-subtle">{doc.tamanho}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => removeDocumento(doc.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-app-subtle hover:bg-red-500/10 hover:text-red-400 transition-colors shrink-0"
                        title="Remover"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            <p className="mt-4 text-xs text-app-subtle text-center">
              Documentos simulados localmente — em produção seriam salvos em storage (Supabase / S3).
            </p>
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

        {/* ── 5. Feed de atualizações ────────────────────────────────────── */}
        {tab === 'atividades' && (
          <div className="p-5">
            <p className="text-xs text-app-muted mb-5">Histórico de ações dos colaboradores neste espaço</p>
            <div className="space-y-0">
              {atividades.map((at, i) => {
                const ac = AT_CFG[at.tipo]
                return (
                  <div key={at.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${ac.color}`}>
                        <ac.Icon className="h-4 w-4" />
                      </div>
                      {i < atividades.length - 1 && (
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
                          {at.usuario}
                        </span>
                        <span className="text-app-border2">·</span>
                        <span className="flex items-center gap-1 text-xs text-app-subtle">
                          <Clock className="h-3 w-3" />
                          {formatTimestamp(at.timestamp)}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* EventoDrawer */}
      {selectedEvento && (
        <EventoDrawer
          evento={todosEventos.find(e => e.id === selectedEvento.id) ?? selectedEvento}
          onClose={() => setSelectedEvento(null)}
          onUpdate={handleUpdate}
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
