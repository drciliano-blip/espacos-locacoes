'use client'

import { useState, useMemo } from 'react'
import { DollarSign, CalendarCheck, TrendingUp, AlertCircle, BarChart3, ChevronDown } from 'lucide-react'
import KPICard from '@/components/dashboard/KPICard'
import RevenueChart from '@/components/dashboard/RevenueChart'
import OccupancyChart from '@/components/dashboard/OccupancyChart'
import { eventos, pagamentos } from '@/lib/mock-data'
import { formatCurrency } from '@/lib/utils'
import { useEspacos } from '@/contexts/EspacosContext'
import type { TipoEvento } from '@/types'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const COR_HEX: Record<string, string> = {
  violet: '#8b5cf6',
  indigo: '#6366f1',
  sky: '#0ea5e9',
  emerald: '#10b981',
  orange: '#f97316',
}

const tipoEventoColors: Record<TipoEvento, string> = {
  'Festivo': '#ec4899',
  'Corporativo': '#3b82f6',
  'Audiovisual': '#f97316',
}

const statusBadge: Record<string, string> = {
  confirmado:    'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  em_negociacao: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  cancelado:     'bg-red-500/10 text-red-400 border-red-500/20',
}

const statusLabel: Record<string, string> = {
  confirmado:    'Confirmado',
  em_negociacao: 'Em negociação',
  cancelado:     'Cancelado',
}

type EspacoFiltro = string | 'Todos'

export default function DashboardPage() {
  const { espacosConfig, espacosNomes } = useEspacos()
  const espacoColors: Record<string, string> = Object.fromEntries(
    espacosConfig.map(e => [e.nome, COR_HEX[e.cor] ?? '#8b5cf6'])
  )
  const [espacoSelecionado, setEspacoSelecionado] = useState<EspacoFiltro>('Todos')
  const [comparativo, setComparativo] = useState(false)

  const eventosFiltrados = useMemo(() =>
    espacoSelecionado === 'Todos' ? eventos : eventos.filter(e => e.espaco === espacoSelecionado),
    [espacoSelecionado]
  )

  const pagamentosFiltrados = useMemo(() =>
    espacoSelecionado === 'Todos' ? pagamentos : pagamentos.filter(p => p.espaco === espacoSelecionado),
    [espacoSelecionado]
  )

  const confirmedThisMonth = eventosFiltrados.filter(
    (e) => e.status === 'confirmado' && e.data.startsWith('2026-05')
  ).length

  const receitaMes = pagamentosFiltrados
    .filter((p) => p.status === 'pago' && p.dataEvento.startsWith('2026-05'))
    .reduce((s, p) => s + p.valor, 0)

  const pendente = pagamentosFiltrados
    .filter((p) => p.status === 'pendente')
    .reduce((s, p) => s + p.valor, 0)

  const atrasado = pagamentosFiltrados
    .filter((p) => p.status === 'atrasado')
    .reduce((s, p) => s + p.valor, 0)

  const proximosEventos = eventosFiltrados
    .filter((e) => e.status === 'confirmado')
    .sort((a, b) => a.data.localeCompare(b.data))
    .slice(0, 5)

  // Dados comparativos por espaço
  const comparativoData = espacosNomes.map((esp) => {
    const evs = eventos.filter(e => e.espaco === esp)
    const pags = pagamentos.filter(p => p.espaco === esp)
    const receita = pags.filter(p => p.status === 'pago').reduce((s, p) => s + p.valor, 0)
    const cap = espacosConfig.find(c => c.nome === esp)?.capacidade ?? 0
    const totalPessoas = evs.reduce((s, e) => s + (e.numeroPessoas ?? 0), 0)
    const ocupacaoMedia = evs.length > 0
      ? Math.round(evs.reduce((s, e) => s + ((e.numeroPessoas ?? 0) / (cap || 1)) * 100, 0) / evs.length)
      : 0
    return { espaco: esp.split(' ')[0], receita, eventos: evs.length, ocupacao: ocupacaoMedia }
  })

  // Dados por tipo de evento
  const tiposData = (['Festivo', 'Corporativo', 'Audiovisual'] as TipoEvento[]).map((tipo) => ({
    tipo,
    total: eventosFiltrados.filter(e => e.tipoEvento === tipo).length,
    receita: eventosFiltrados.filter(e => e.tipoEvento === tipo).reduce((s, e) => s + e.valor, 0),
  })).filter(d => d.total > 0)

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Seletor de espaço */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-app-surface border border-app-border rounded-xl p-1 shadow-sm">
            <button
              onClick={() => { setEspacoSelecionado('Todos'); setComparativo(false) }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                espacoSelecionado === 'Todos' && !comparativo
                  ? 'text-white font-bold shadow-md'
                  : 'bg-[#F0F2F5] text-[#667781] hover:bg-[#E9EDEF]'
              }`}
              style={espacoSelecionado === 'Todos' && !comparativo ? { backgroundColor: '#25D366' } : undefined}
            >
              Todos
            </button>
            {espacosNomes.map((esp) => (
              <button
                key={esp}
                onClick={() => { setEspacoSelecionado(esp); setComparativo(false) }}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  espacoSelecionado === esp && !comparativo
                    ? 'text-white font-bold shadow-md'
                    : 'bg-[#F0F2F5] text-[#667781] hover:bg-[#E9EDEF]'
                }`}
                style={espacoSelecionado === esp && !comparativo ? { backgroundColor: '#25D366' } : undefined}
              >
                {esp.split(' ')[0]}
              </button>
            ))}
          </div>
          <button
            onClick={() => { setComparativo(!comparativo); setEspacoSelecionado('Todos') }}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-all ${
              comparativo
                ? 'border-[#25D366]/30 bg-[#25D366]/10 text-[#128C7E]'
                : 'border-app-border bg-app-surface text-app-muted hover:text-app-text'
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Comparativo
          </button>
        </div>

        {/* Indicador de espaço ativo */}
        {espacoSelecionado !== 'Todos' && !comparativo && (
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: espacoColors[espacoSelecionado] }} />
            <span className="text-xs font-medium" style={{ color: '#667781' }}>
              Visualizando: <span className="font-semibold text-[#111B21]">{espacoSelecionado}</span>
            </span>
          </div>
        )}
      </div>

      {/* Modo Comparativo */}
      {comparativo ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Receita por espaço */}
            <div className="rounded-xl border border-app-border bg-app-surface p-4">
              <p className="text-xs font-semibold text-app-subtle uppercase tracking-wider mb-4">Receita por Espaço</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={comparativoData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E9EDEF" />
                  <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 10 }} tickFormatter={(v) => `${v/1000}k`} />
                  <YAxis type="category" dataKey="espaco" tick={{ fill: '#9ca3af', fontSize: 11 }} width={55} />
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={{ background: '#FFFFFF', border: '1px solid #E9EDEF', borderRadius: 8, color: '#111B21' }} />
                  <Bar dataKey="receita" radius={[0, 4, 4, 0]}>
                    {comparativoData.map((entry) => (
                      <Cell key={entry.espaco} fill={espacoColors[espacosNomes.find(e => e.startsWith(entry.espaco)) ?? ''] ?? '#8b5cf6'} fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Eventos por espaço */}
            <div className="rounded-xl border border-app-border bg-app-surface p-4">
              <p className="text-xs font-semibold text-app-subtle uppercase tracking-wider mb-4">Eventos por Espaço</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={comparativoData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E9EDEF" />
                  <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 10 }} />
                  <YAxis type="category" dataKey="espaco" tick={{ fill: '#9ca3af', fontSize: 11 }} width={55} />
                  <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E9EDEF', borderRadius: 8, color: '#111B21' }} />
                  <Bar dataKey="eventos" radius={[0, 4, 4, 0]}>
                    {comparativoData.map((entry) => (
                      <Cell key={entry.espaco} fill={espacoColors[espacosNomes.find(e => e.startsWith(entry.espaco)) ?? ''] ?? '#8b5cf6'} fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Ocupação média por espaço */}
            <div className="rounded-xl border border-app-border bg-app-surface p-4">
              <p className="text-xs font-semibold text-app-subtle uppercase tracking-wider mb-4">Ocupação Média (%)</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={comparativoData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E9EDEF" />
                  <XAxis type="number" domain={[0, 100]} tick={{ fill: '#6b7280', fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                  <YAxis type="category" dataKey="espaco" tick={{ fill: '#9ca3af', fontSize: 11 }} width={55} />
                  <Tooltip formatter={(v) => `${Number(v)}%`} contentStyle={{ background: '#FFFFFF', border: '1px solid #E9EDEF', borderRadius: 8, color: '#111B21' }} />
                  <Bar dataKey="ocupacao" radius={[0, 4, 4, 0]}>
                    {comparativoData.map((entry) => (
                      <Cell key={entry.espaco} fill={espacoColors[espacosNomes.find(e => e.startsWith(entry.espaco)) ?? ''] ?? '#8b5cf6'} fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Tabela comparativa */}
          <div className="rounded-xl border border-app-border bg-app-surface overflow-hidden">
            <div className="px-5 py-4 border-b border-app-border">
              <h3 className="text-sm font-semibold text-app-text">Comparativo Detalhado por Espaço</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-app-border bg-app-surface2/30">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-app-subtle uppercase tracking-wider">Espaço</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-app-subtle uppercase tracking-wider">Eventos</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-app-subtle uppercase tracking-wider">Receita</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-app-subtle uppercase tracking-wider">Ocupação Média</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border/40">
                  {comparativoData.map((row) => {
                    const espNome = espacosNomes.find(e => e.startsWith(row.espaco)) ?? row.espaco
                    return (
                      <tr key={row.espaco} className="hover:bg-app-surface2/30 transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: espacoColors[espNome] }} />
                            <span className="font-medium text-app-text">{espNome}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right text-app-text2">{row.eventos}</td>
                        <td className="px-5 py-3 text-right font-semibold text-[#25D366]">{formatCurrency(row.receita)}</td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-app-surface3">
                              <div className="h-full rounded-full" style={{ width: `${row.ocupacao}%`, backgroundColor: espacoColors[espNome] }} />
                            </div>
                            <span className="text-app-text2 w-9 text-right">{row.ocupacao}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <KPICard
              title="Receita do Mês"
              value={formatCurrency(receitaMes)}
              subtitle={espacoSelecionado === 'Todos' ? 'Maio 2026 — todos os espaços' : `Maio 2026 — ${espacoSelecionado}`}
              icon={DollarSign}
              trend="+18% vs abril"
              trendUp={true}
              color="green"
            />
            <KPICard
              title="Eventos Confirmados"
              value={String(confirmedThisMonth)}
              subtitle="Este mês"
              icon={CalendarCheck}
              trend="+3 vs mês anterior"
              trendUp={true}
              color="blue"
            />
            <KPICard
              title="A Receber"
              value={formatCurrency(pendente)}
              subtitle="Pagamentos pendentes"
              icon={TrendingUp}
              color="orange"
            />
            <KPICard
              title="Em Atraso"
              value={formatCurrency(atrasado)}
              subtitle="Requer atenção"
              icon={AlertCircle}
              color="red"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <RevenueChart />
            <OccupancyChart />
          </div>

          {/* Gráfico por tipo de evento */}
          {tiposData.length > 0 && (
            <div className="rounded-xl border border-app-border bg-app-surface p-5">
              <h3 className="text-sm font-semibold text-app-text mb-4">Eventos por Categoria</h3>
              <div className="flex flex-wrap gap-6 items-center">
                {tiposData.map((d) => (
                  <div key={d.tipo} className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full flex items-center justify-center text-lg font-bold"
                      style={{ backgroundColor: `${tipoEventoColors[d.tipo]}20`, color: tipoEventoColors[d.tipo] }}>
                      {d.total}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-app-text">{d.tipo}</p>
                      <p className="text-xs text-app-muted">{formatCurrency(d.receita)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Próximos Eventos */}
          <div className="rounded-xl border border-app-border bg-app-surface">
            <div className="px-5 py-4 border-b border-app-border flex items-center justify-between">
              <h3 className="text-sm font-semibold text-app-text">
                Próximos Eventos Confirmados
                {espacoSelecionado !== 'Todos' && (
                  <span className="ml-2 text-xs font-normal text-app-muted">— {espacoSelecionado}</span>
                )}
              </h3>
            </div>
            <div className="divide-y divide-app-border/50">
              {proximosEventos.length === 0 ? (
                <p className="text-sm text-app-subtle text-center py-8">Nenhum evento confirmado.</p>
              ) : proximosEventos.map((e) => (
                <div key={e.id} className="flex items-center justify-between px-5 py-3 hover:bg-app-surface2/30 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-app-text">{e.cliente}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-app-subtle">{e.espaco} · {e.tipo}</p>
                      {e.tipoEvento && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full"
                          style={{ backgroundColor: `${tipoEventoColors[e.tipoEvento]}20`, color: tipoEventoColors[e.tipoEvento] }}>
                          {e.tipoEvento}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-app-muted">
                      {e.data.split('-').reverse().join('/')} · {e.horaInicio}
                    </span>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadge[e.status]}`}>
                      {statusLabel[e.status] ?? e.status}
                    </span>
                    <span className="text-sm font-semibold text-[#25D366]">
                      {formatCurrency(e.valor)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
