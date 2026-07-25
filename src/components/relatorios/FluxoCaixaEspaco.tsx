'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Wallet, PiggyBank, TrendingUp, Plus, X, Pencil, Check } from 'lucide-react'
import { useEspacos } from '@/contexts/EspacosContext'
import { useReceitas } from '@/contexts/ReceitasContext'
import { useContasPagar } from '@/contexts/ContasPagarContext'
import { useRepasses } from '@/contexts/RepassesContext'
import { useCurrentUser } from '@/contexts/UserContext'
import { formatCurrency, parseCurrencyBR } from '@/lib/utils'
import { gerarMesesDoPeriodo, aggregateFluxoCaixa, projecaoProximoMes, type FluxoCaixaMes, type DivisaoSocioMes } from '@/lib/fluxo-caixa-utils'
import { downloadWorkbook, type ExportSheet } from '@/lib/xlsx-export'
import ExportarRelatorioButton from './ExportarRelatorioButton'

const AVATAR_COLORS = ['#6366f1', '#ef4444', '#10b981', '#f59e0b', '#0ea5e9', '#a855f7']

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/)
  return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase()
}

function statusBadgeClass(status: string): string {
  if (status === 'pago') return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
  if (status === 'atrasado') return 'bg-red-500/10 text-red-400 border-red-500/20'
  return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
}

function defaultRange(): { inicio: string; fim: string } {
  const hoje = new Date()
  const inicioDate = new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1)
  const inicio = `${inicioDate.getFullYear()}-${String(inicioDate.getMonth() + 1).padStart(2, '0')}`
  const fim = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
  return { inicio, fim }
}

export default function FluxoCaixaEspaco() {
  const { espacosConfig, updateSaldoInicial } = useEspacos()
  const { receitas } = useReceitas()
  const { contas: contasPagar } = useContasPagar()
  const { repasses, addRepasse } = useRepasses()
  const { role } = useCurrentUser()
  const podeRegistrar = role === 'admin' || role === 'financeiro'

  const [espacoSelecionado, setEspacoSelecionado] = useState(espacosConfig[0]?.nome ?? '')

  // EspacosContext carrega de forma assíncrona — se o primeiro render acontecer
  // antes dos dados chegarem, o valor inicial fica vazio e nunca se autopreenche sozinho.
  useEffect(() => {
    if (!espacoSelecionado && espacosConfig.length > 0) setEspacoSelecionado(espacosConfig[0].nome)
  }, [espacoSelecionado, espacosConfig])

  const range = defaultRange()
  const [inicio, setInicio] = useState(range.inicio)
  const [fim, setFim] = useState(range.fim)
  const [repasseAlvo, setRepasseAlvo] = useState<{ socio: string; yearMonth: string; mesLabel: string } | null>(null)
  const [editandoSaldo, setEditandoSaldo] = useState(false)

  const espaco = espacosConfig.find(e => e.nome === espacoSelecionado)

  const meses = useMemo(() => gerarMesesDoPeriodo(inicio, fim), [inicio, fim])
  const fluxo = useMemo(
    () => espacoSelecionado ? aggregateFluxoCaixa(espacoSelecionado, meses, receitas, contasPagar, repasses) : [],
    [espacoSelecionado, meses, receitas, contasPagar, repasses],
  )
  const projecao = useMemo(() => projecaoProximoMes(fluxo), [fluxo])

  const chartData = fluxo.map(m => ({
    label: m.label.replace(' de ', ' '),
    Entradas: m.totalEntradas,
    Saídas: m.totalSaidas,
    Saldo: m.saldoDoMes,
  }))

  if (espacosConfig.length === 0) return null

  function handleExportExcel() {
    const resumoSheet: ExportSheet = {
      name: 'Resumo Mensal',
      rows: [
        ['Mês', 'Total Entradas', 'Total Saídas', 'Saldo do Mês', 'Partilha Repassada', 'Saldo Após Partilha'],
        ...fluxo.map(m => [m.label, m.totalEntradas, m.totalSaidas, m.saldoDoMes, m.partilhaRepassada, m.saldoAposPartilha]),
      ],
    }
    const receitasSheet: ExportSheet = {
      name: 'Receitas',
      rows: [
        ['Mês', 'Descrição', 'Cliente', 'Data', 'Valor', 'Status'],
        ...fluxo.flatMap(m => m.entradas.map(r => [m.label, r.descricao, r.cliente ?? '', r.data, r.valor, r.status])),
      ],
    }
    const despesasSheet: ExportSheet = {
      name: 'Despesas',
      rows: [
        ['Mês', 'Descrição', 'Categoria', 'Data', 'Valor', 'Status'],
        ...fluxo.flatMap(m => m.saidas.map(c => [m.label, c.descricao, c.categoria ?? '', c.data, c.valor, c.status])),
      ],
    }
    const categoriaSheet: ExportSheet = {
      name: 'Despesas por Categoria',
      rows: [
        ['Mês', 'Categoria', 'Valor'],
        ...fluxo.flatMap(m => m.despesasPorCategoria.map(c => [m.label, c.categoria, c.valor])),
      ],
    }
    const lucrosSheet: ExportSheet = {
      name: 'Divisão de Lucros',
      rows: [
        ['Mês', 'Sócio', 'Percentual (%)', 'Valor Devido', 'Valor Repassado', 'Valor Pendente', 'Situação'],
        ...fluxo.flatMap(m => m.divisaoLucros.map(s => [m.label, s.nome, s.percentual, s.valorDevido, s.valorRepassado, s.valorPendente, s.situacao])),
      ],
    }
    downloadWorkbook(
      [resumoSheet, receitasSheet, despesasSheet, categoriaSheet, lucrosSheet],
      `fluxo-de-caixa-${espacoSelecionado}-${inicio}-a-${fim}.xlsx`,
    )
  }

  return (
    <div className="rounded-2xl border border-app-border bg-app-surface p-5 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3 print-hidden">
        <div>
          <h3 className="text-sm font-semibold text-app-text">Fluxo de Caixa por Espaço</h3>
          <p className="text-xs text-app-subtle">Extrato mensal completo, com divisão de lucros e controle de repasses.</p>
        </div>
        <ExportarRelatorioButton onExcel={handleExportExcel} />
      </div>

      {/* Controles */}
      <div className="flex flex-wrap items-end gap-3 print-hidden">
        <div>
          <p className="text-xs font-medium text-app-subtle uppercase tracking-wider mb-1">Espaço</p>
          <select value={espacoSelecionado} onChange={e => setEspacoSelecionado(e.target.value)}
            className="cursor-pointer rounded-lg border border-app-border2 bg-app-surface2 px-3 py-1.5 text-sm text-app-text focus:outline-none">
            {espacosConfig.map(e => <option key={e.nome} value={e.nome}>{e.nome}</option>)}
          </select>
        </div>
        <div>
          <p className="text-xs font-medium text-app-subtle uppercase tracking-wider mb-1">De</p>
          <input type="month" value={inicio} onChange={e => setInicio(e.target.value)}
            className="rounded-lg border border-app-border2 bg-app-surface2 px-3 py-1.5 text-sm text-app-text focus:outline-none" />
        </div>
        <div>
          <p className="text-xs font-medium text-app-subtle uppercase tracking-wider mb-1">Até</p>
          <input type="month" value={fim} onChange={e => setFim(e.target.value)}
            className="rounded-lg border border-app-border2 bg-app-surface2 px-3 py-1.5 text-sm text-app-text focus:outline-none" />
        </div>
      </div>

      {/* Cabeçalho impresso */}
      <div className="hidden print:block border-b border-app-border pb-3">
        <p className="text-xs text-gray-500">{espaco?.nome}</p>
        <h1 className="text-lg font-bold text-gray-900">Relatório de Fluxo de Caixa</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          Período: {fluxo[0]?.label} – {fluxo[fluxo.length - 1]?.label} · Gerado em {new Date().toLocaleDateString('pt-BR')}
        </p>
      </div>

      {/* Saldo inicial de caixa */}
      <div className="flex items-center gap-2 text-xs text-app-muted print-hidden">
        <PiggyBank className="h-3.5 w-3.5 text-app-subtle" />
        Saldo em conta na abertura do período:
        {editandoSaldo && podeRegistrar ? (
          <SaldoInicialEditor
            valorAtual={espaco?.saldoInicialCaixa ?? 0}
            onSave={async v => { if (espaco?.id) await updateSaldoInicial(espaco.id, v); setEditandoSaldo(false) }}
            onCancel={() => setEditandoSaldo(false)}
          />
        ) : (
          <>
            <span className="font-semibold text-app-text">{formatCurrency(espaco?.saldoInicialCaixa ?? 0)}</span>
            {podeRegistrar && (
              <button onClick={() => setEditandoSaldo(true)} className="text-app-subtle hover:text-app-text transition-colors" title="Editar saldo inicial">
                <Pencil className="h-3 w-3" />
              </button>
            )}
          </>
        )}
      </div>

      {/* Visão geral do período */}
      <div>
        <p className="text-xs font-medium text-app-muted mb-2">Entradas, saídas e saldo por mês</p>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: 'var(--chart-tick)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'var(--chart-tick)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={value => formatCurrency(Number(value))} contentStyle={{ background: 'var(--app-surface2)', border: '1px solid var(--app-border2)', borderRadius: 8, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Entradas" fill="#3b82f6" radius={[3, 3, 0, 0]} maxBarSize={28} />
            <Bar dataKey="Saídas" fill="#ef4444" radius={[3, 3, 0, 0]} maxBarSize={28} />
            <Line type="monotone" dataKey="Saldo" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Um card por mês */}
      <div className="space-y-6">
        {fluxo.map((mes, i) => (
          <MesCard
            key={mes.yearMonth}
            mes={mes}
            primeiroMes={i === 0}
            saldoInicial={espaco?.saldoInicialCaixa ?? 0}
            projecao={projecao}
            podeRegistrar={podeRegistrar}
            onRegistrarRepasse={socio => setRepasseAlvo({ socio, yearMonth: mes.yearMonth, mesLabel: mes.label })}
          />
        ))}
      </div>

      {repasseAlvo && espacoSelecionado && (
        <RegistrarRepasseModal
          espaco={espacoSelecionado}
          socioNome={repasseAlvo.socio}
          mesLabel={repasseAlvo.mesLabel}
          onClose={() => setRepasseAlvo(null)}
          onConfirm={async (valor, data, observacoes) => {
            await addRepasse({ espaco: espacoSelecionado, socioNome: repasseAlvo.socio, valor, data, observacoes })
            setRepasseAlvo(null)
          }}
        />
      )}
    </div>
  )
}

function SaldoInicialEditor({ valorAtual, onSave, onCancel }: { valorAtual: number; onSave: (v: number) => void; onCancel: () => void }) {
  const [valor, setValor] = useState(String(valorAtual))
  return (
    <span className="flex items-center gap-1.5">
      <input type="text" inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)} autoFocus
        className="w-24 rounded border border-app-border2 bg-app-surface2 px-1.5 py-0.5 text-xs text-app-text focus:outline-none" />
      <button onClick={() => onSave(parseCurrencyBR(valor))} className="text-emerald-500 hover:text-emerald-400"><Check className="h-3.5 w-3.5" /></button>
      <button onClick={onCancel} className="text-app-subtle hover:text-red-500"><X className="h-3.5 w-3.5" /></button>
    </span>
  )
}

interface MesCardProps {
  mes: FluxoCaixaMes
  primeiroMes: boolean
  saldoInicial: number
  projecao: { entradas: number; saidas: number; saldo: number } | null
  podeRegistrar: boolean
  onRegistrarRepasse: (socio: string) => void
}

function MesCard({ mes, primeiroMes, saldoInicial, projecao, podeRegistrar, onRegistrarRepasse }: MesCardProps) {
  return (
    <div className="rounded-xl border border-app-border2 bg-app-bg p-4 space-y-4 break-inside-avoid">
      <div>
        <div className="flex items-center gap-2">
          <h4 className="text-base font-bold text-app-text">{mes.label}</h4>
          {!mes.temLancamentos && (
            <span className="rounded-full bg-app-surface3 px-2 py-0.5 text-[10px] font-medium text-app-subtle">sem lançamentos</span>
          )}
        </div>
        <p className="text-xs text-app-subtle">Detalhamento mensal do fluxo de caixa</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-app-border2/60 bg-app-surface p-3">
          <p className="text-[10px] font-medium text-blue-500 uppercase tracking-wide mb-1">Total de entradas</p>
          <p className="text-base font-bold text-app-text">{formatCurrency(mes.totalEntradas)}</p>
          <p className="text-[10px] text-app-subtle">{mes.entradas.length} lançamentos</p>
        </div>
        <div className="rounded-lg border border-app-border2/60 bg-app-surface p-3">
          <p className="text-[10px] font-medium text-red-500 uppercase tracking-wide mb-1">Total de saídas</p>
          <p className="text-base font-bold text-app-text">{formatCurrency(mes.totalSaidas)}</p>
          <p className="text-[10px] text-app-subtle">{mes.saidas.length} lançamentos</p>
        </div>
        <div className="rounded-lg border border-app-border2/60 bg-app-surface p-3">
          <p className="text-[10px] font-medium text-violet-500 uppercase tracking-wide mb-1">Saldo do mês</p>
          <p className={`text-base font-bold ${mes.saldoDoMes >= 0 ? 'text-app-text' : 'text-red-500'}`}>{formatCurrency(mes.saldoDoMes)}</p>
          <p className="text-[10px] text-app-subtle">Entradas − saídas</p>
        </div>
        <div className="rounded-lg border border-app-border2/60 bg-app-surface p-3">
          <p className="text-[10px] font-medium text-emerald-500 uppercase tracking-wide mb-1">Saldo após partilha</p>
          <p className={`text-base font-bold ${mes.saldoAposPartilha >= 0 ? 'text-app-text' : 'text-red-500'}`}>{formatCurrency(mes.saldoAposPartilha)}</p>
          <p className="text-[10px] text-app-subtle">Retirada mensal ainda não realizada</p>
        </div>
      </div>

      {/* Receitas e despesas discriminadas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-blue-500 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" /> Receitas — {mes.label.split(' de ')[0]}
            </p>
            <span className="text-xs font-bold text-app-text">{formatCurrency(mes.totalEntradas)}</span>
          </div>
          {mes.entradas.length === 0 ? (
            <p className="text-xs italic text-app-subtle">Nenhuma entrada registrada neste mês.</p>
          ) : (
            <ul className="space-y-1.5">
              {mes.entradas.map(r => (
                <li key={r.id} className="flex items-center justify-between gap-2 rounded-lg bg-app-surface px-2.5 py-1.5 text-xs">
                  <span className="min-w-0">
                    <span className="block font-medium text-app-text truncate">{r.descricao}</span>
                    <span className="flex items-center gap-1.5 text-app-subtle">
                      {r.data.split('-').reverse().slice(0, 2).join('/')}
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium border ${statusBadgeClass(r.status)}`}>{r.status}</span>
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold text-emerald-500">+ {formatCurrency(r.valor)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-red-500 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Despesas — {mes.label.split(' de ')[0]}
            </p>
            <span className="text-xs font-bold text-app-text">{formatCurrency(mes.totalSaidas)}</span>
          </div>
          {mes.saidas.length === 0 ? (
            <p className="text-xs italic text-app-subtle">Nenhuma saída registrada neste mês.</p>
          ) : (
            <ul className="space-y-1.5">
              {mes.saidas.map(c => (
                <li key={c.id} className="flex items-center justify-between gap-2 rounded-lg bg-app-surface px-2.5 py-1.5 text-xs">
                  <span className="min-w-0">
                    <span className="block font-medium text-app-text truncate">{c.descricao}</span>
                    <span className="flex items-center gap-1.5 text-app-subtle">
                      <span className="rounded-full bg-app-surface3 px-1.5 py-0.5 text-[9px] font-medium">{c.categoria}</span>
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium border ${statusBadgeClass(c.status)}`}>{c.status}</span>
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold text-red-500">− {formatCurrency(c.valor)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Situação do mês + Divisão de lucros */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-app-border2/60 bg-app-surface p-4">
          <p className="text-xs font-semibold text-app-text mb-2 flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5 text-app-subtle" /> Situação do mês</p>
          <dl className="space-y-1.5 text-xs">
            {primeiroMes && (
              <div className="flex justify-between border-b border-dashed border-app-border/60 pb-1.5">
                <dt className="text-app-muted">Saldo em conta (abertura do mês)</dt>
                <dd className="font-medium text-app-text">{formatCurrency(saldoInicial)}</dd>
              </div>
            )}
            <div className="flex justify-between"><dt className="text-app-muted">Total de entradas</dt><dd className="font-medium text-emerald-500">{formatCurrency(mes.totalEntradas)}</dd></div>
            <div className="flex justify-between"><dt className="text-app-muted">Total de saídas</dt><dd className="font-medium text-red-500">{formatCurrency(mes.totalSaidas)}</dd></div>
            <div className="flex justify-between"><dt className="text-app-muted">Saldo do mês</dt><dd className="font-medium text-app-text">{formatCurrency(mes.saldoDoMes)}</dd></div>
            <div className="flex justify-between"><dt className="text-app-muted">Partilha já repassada</dt><dd className="font-medium text-app-text">{formatCurrency(mes.partilhaRepassada)}</dd></div>
            <div className="flex justify-between border-t border-app-border/60 pt-1.5"><dt className="font-semibold text-app-text">Saldo após partilha</dt><dd className="font-bold text-app-text">{formatCurrency(mes.saldoAposPartilha)}</dd></div>
          </dl>
        </div>

        <div className="rounded-lg border border-app-border2/60 bg-app-surface p-4">
          <p className="text-xs font-semibold text-app-text mb-2">Divisão de lucros</p>
          {mes.divisaoLucros.length === 0 ? (
            <p className="text-xs italic text-app-subtle">Sem sócio configurado para este espaço.</p>
          ) : !mes.temLancamentos ? (
            <p className="text-xs italic text-app-subtle">Divisão de lucros não se aplica — sem saldo apurado neste mês.</p>
          ) : (
            <div className="space-y-2">
              {mes.divisaoLucros.map((s, i) => (
                <SocioRow key={s.nome} socio={s} cor={AVATAR_COLORS[i % AVATAR_COLORS.length]} podeRegistrar={podeRegistrar} onRegistrar={() => onRegistrarRepasse(s.nome)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Projeção + despesas por categoria */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-app-border2/60 bg-app-surface p-4">
          <p className="text-xs font-semibold text-app-text mb-1 flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5 text-app-subtle" /> Projeção — próximo mês</p>
          {projecao ? (
            <>
              <p className="text-lg font-bold text-app-text">{formatCurrency(projecao.saldo)}</p>
              <p className="text-xs text-app-subtle">Entradas ~ {formatCurrency(projecao.entradas)} · Saídas ~ {formatCurrency(projecao.saidas)}</p>
            </>
          ) : (
            <p className="text-xs italic text-app-subtle">Sem histórico suficiente para projetar.</p>
          )}
        </div>
        <div className="rounded-lg border border-app-border2/60 bg-app-surface p-4">
          <p className="text-xs font-semibold text-app-text mb-2">Despesas por categoria — {mes.label.split(' de ')[0]}</p>
          {mes.despesasPorCategoria.length === 0 ? (
            <p className="text-xs italic text-app-subtle">Sem despesas para detalhar neste mês.</p>
          ) : (
            <div className="space-y-1.5">
              {mes.despesasPorCategoria.map(c => {
                const max = mes.despesasPorCategoria[0].valor
                return (
                  <div key={c.categoria} className="flex items-center gap-2 text-xs">
                    <span className="w-28 shrink-0 text-app-muted truncate">{c.categoria}</span>
                    <div className="flex-1 h-2 rounded-full bg-app-surface3 overflow-hidden">
                      <div className="h-full rounded-full bg-orange-500" style={{ width: `${max > 0 ? (c.valor / max) * 100 : 0}%` }} />
                    </div>
                    <span className="w-20 shrink-0 text-right font-medium text-app-text">{formatCurrency(c.valor)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SocioRow({ socio, cor, podeRegistrar, onRegistrar }: { socio: DivisaoSocioMes; cor: string; podeRegistrar: boolean; onRegistrar: () => void }) {
  const situacaoLabel = socio.situacao === 'realizada' ? 'Retirada realizada' : socio.situacao === 'parcial' ? 'Retirada parcial' : 'Retirada pendente'
  const situacaoClass = socio.situacao === 'realizada' ? 'bg-emerald-500/10 text-emerald-500' : socio.situacao === 'parcial' ? 'bg-sky-500/10 text-sky-500' : 'bg-amber-500/10 text-amber-500'
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: cor }}>
          {iniciais(socio.nome)}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-app-text truncate">{socio.nome}</p>
          <p className="text-[10px] text-app-subtle">{socio.percentual}% do lucro do mês</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="text-right">
          <p className="text-xs font-bold text-app-text">{formatCurrency(socio.valorDevido)}</p>
          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${situacaoClass}`}>{situacaoLabel}</span>
        </div>
        {podeRegistrar && socio.situacao !== 'realizada' && (
          <button onClick={onRegistrar} title="Registrar repasse"
            className="flex h-6 w-6 items-center justify-center rounded-md text-app-subtle hover:bg-app-surface2 hover:text-[#25D366] transition-colors print-hidden">
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}

function RegistrarRepasseModal({ espaco, socioNome, mesLabel, onClose, onConfirm }: {
  espaco: string
  socioNome: string
  mesLabel: string
  onClose: () => void
  onConfirm: (valor: number, data: string, observacoes?: string) => Promise<void>
}) {
  const [valor, setValor] = useState('')
  const [data, setData] = useState(() => new Date().toISOString().split('T')[0])
  const [observacoes, setObservacoes] = useState('')
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function handleConfirm() {
    setSubmitted(true)
    if (!valor || parseCurrencyBR(valor) <= 0 || !data) return
    setSaving(true)
    try {
      await onConfirm(parseCurrencyBR(valor), data, observacoes.trim() || undefined)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-app-surface rounded-2xl border border-app-border shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-app-border">
          <h2 className="text-sm font-semibold text-app-text">Registrar repasse — {socioNome}</h2>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-app-subtle hover:bg-app-surface2 transition-colors"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-app-subtle">{espaco} · referente a {mesLabel}</p>
          <div>
            <label className="block text-xs text-app-muted mb-1">Valor (R$) *</label>
            <input type="text" inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00"
              className={`w-full rounded-lg border ${submitted && (!valor || parseCurrencyBR(valor) <= 0) ? 'border-red-500/50' : 'border-app-border2'} bg-app-surface2 px-3 py-1.5 text-sm text-app-text focus:outline-none`} />
          </div>
          <div>
            <label className="block text-xs text-app-muted mb-1">Data do repasse *</label>
            <input type="date" value={data} onChange={e => setData(e.target.value)}
              className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-3 py-1.5 text-sm text-app-text focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs text-app-muted mb-1">Observações</label>
            <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2}
              className="w-full resize-none rounded-lg border border-app-border2 bg-app-surface2 px-3 py-1.5 text-sm text-app-text focus:outline-none" />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-app-border">
          <button onClick={onClose} className="rounded-lg border border-app-border2 px-4 py-2 text-sm text-app-muted hover:bg-app-surface2 transition-colors">Cancelar</button>
          <button onClick={handleConfirm} disabled={saving}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            style={{ backgroundColor: '#25D366' }}>
            {saving ? 'Salvando…' : 'Confirmar repasse'}
          </button>
        </div>
      </div>
    </div>
  )
}
