'use client'

import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'
import { contasPagar } from '@/lib/mock-data'
import { formatCurrency } from '@/lib/utils'

const SUB_LABELS: Record<string, string> = {
  aluguel:       'Aluguel',
  energia:       'Energia',
  internet:      'Internet',
  funcionários:  'Funcionários',
  manutenção:    'Manutenção',
  fornecedores:  'Fornecedores',
  extras:        'Extras',
}

const FIXAS_COLOR   = '#25D366'
const VARIAVEIS_COLOR = '#667781'

interface Props {
  selectedSpaces?: string[]
  dataInicio?: string
  dataFim?: string
}

export default function DespesasSection({ selectedSpaces, dataInicio, dataFim }: Props) {
  const contas = useMemo(() => {
    return contasPagar.filter(c => {
      const matchEspaco = !selectedSpaces?.length || selectedSpaces.includes(c.espaco)
      const matchInicio = !dataInicio || c.dataVencimento >= dataInicio
      const matchFim    = !dataFim    || c.dataVencimento <= dataFim
      return matchEspaco && matchInicio && matchFim
    })
  }, [selectedSpaces, dataInicio, dataFim])

  const totais = useMemo(() => {
    const fixas    = contas.filter(c => c.categoria === 'fixa')
    const variaveis = contas.filter(c => c.categoria === 'variavel')
    return {
      fixas:    fixas.reduce((s, c) => s + c.valor, 0),
      variaveis: variaveis.reduce((s, c) => s + c.valor, 0),
      total:    contas.reduce((s, c) => s + c.valor, 0),
      fixasPagas:    fixas.filter(c => c.status === 'pago').reduce((s, c) => s + c.valor, 0),
      variaveisPagas: variaveis.filter(c => c.status === 'pago').reduce((s, c) => s + c.valor, 0),
    }
  }, [contas])

  const porSubcategoria = useMemo(() => {
    const map: Record<string, { fixa: number; variavel: number }> = {}
    for (const c of contas) {
      const sub = c.subcategoria
      if (!map[sub]) map[sub] = { fixa: 0, variavel: 0 }
      if (c.categoria === 'fixa') map[sub].fixa += c.valor
      else map[sub].variavel += c.valor
    }
    return Object.entries(map).map(([sub, vals]) => ({
      name: SUB_LABELS[sub] ?? sub,
      Fixas: vals.fixa,
      Variáveis: vals.variavel,
    })).sort((a, b) => (b.Fixas + b.Variáveis) - (a.Fixas + a.Variáveis))
  }, [contas])

  const total = totais.total
  const pctFixas = total > 0 ? Math.round((totais.fixas / total) * 100) : 0
  const pctVariaveis = 100 - pctFixas

  return (
    <div className="rounded-2xl border border-app-border bg-app-surface p-5 space-y-5">
      <h3 className="text-sm font-semibold text-app-text">Despesas — Fixas vs. Variáveis</h3>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-app-border2 bg-app-bg p-4">
          <p className="text-xs text-app-subtle mb-1">Total Despesas</p>
          <p className="text-lg font-bold text-app-text">{formatCurrency(total)}</p>
          <p className="text-xs text-app-subtle mt-1">{contas.length} lançamentos</p>
        </div>
        <div className="rounded-xl border border-[#25D366]/25 bg-[#25D366]/5 p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-[#128C7E] font-medium">Despesas Fixas</p>
            <span className="text-xs font-semibold text-[#128C7E]">{pctFixas}%</span>
          </div>
          <p className="text-lg font-bold text-[#128C7E]">{formatCurrency(totais.fixas)}</p>
          <p className="text-xs text-app-subtle mt-1">Pagas: {formatCurrency(totais.fixasPagas)}</p>
        </div>
        <div className="rounded-xl border border-app-border2 bg-app-bg p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-app-text2 font-medium">Despesas Variáveis</p>
            <span className="text-xs font-semibold text-app-text2">{pctVariaveis}%</span>
          </div>
          <p className="text-lg font-bold text-app-text2">{formatCurrency(totais.variaveis)}</p>
          <p className="text-xs text-app-subtle mt-1">Pagas: {formatCurrency(totais.variaveisPagas)}</p>
        </div>
      </div>

      {/* Proportion bar */}
      {total > 0 && (
        <div>
          <div className="flex rounded-full overflow-hidden h-3">
            <div style={{ width: `${pctFixas}%`, backgroundColor: '#25D366' }} />
            <div style={{ width: `${pctVariaveis}%`, backgroundColor: '#8696A0' }} />
          </div>
          <div className="flex gap-4 mt-2">
            <span className="flex items-center gap-1.5 text-xs text-app-muted">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: '#25D366' }} />
              Fixas {pctFixas}%
            </span>
            <span className="flex items-center gap-1.5 text-xs text-app-muted">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: '#8696A0' }} />
              Variáveis {pctVariaveis}%
            </span>
          </div>
        </div>
      )}

      {/* Bar chart por subcategoria */}
      {porSubcategoria.length > 0 && (
        <div>
          <p className="text-xs font-medium text-app-muted mb-3">Por subcategoria</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={porSubcategoria} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E9EDEF" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#8696A0' }} />
              <YAxis tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#8696A0' }} width={50} />
              <Tooltip
                formatter={(value) => formatCurrency(Number(value))}
                contentStyle={{ background: '#FFFFFF', border: '1px solid #E9EDEF', borderRadius: 8, color: '#111B21', fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Fixas" fill={FIXAS_COLOR} radius={[3, 3, 0, 0]} maxBarSize={32} />
              <Bar dataKey="Variáveis" fill={VARIAVEIS_COLOR} radius={[3, 3, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabela detalhada */}
      {contas.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-xs font-medium text-[#128C7E] hover:text-[#25D366] transition-colors list-none flex items-center gap-1">
            <span className="group-open:hidden">▶</span>
            <span className="hidden group-open:inline">▼</span>
            Ver lançamentos ({contas.length})
          </summary>
          <div className="mt-3 overflow-x-auto rounded-lg border border-app-border2">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-app-border bg-app-surface2">
                  {['Descrição', 'Espaço', 'Categoria', 'Subcategoria', 'Vencimento', 'Valor', 'Status'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-app-subtle font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border/40">
                {contas.map(c => (
                  <tr key={c.id} className="hover:bg-app-surface2/30 transition-colors">
                    <td className="px-3 py-2 text-app-text max-w-[200px] truncate">{c.descricao}</td>
                    <td className="px-3 py-2 text-app-muted whitespace-nowrap">{c.espaco}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        c.categoria === 'fixa'
                          ? 'bg-[#25D366]/10 text-[#128C7E]'
                          : 'bg-app-surface3 text-app-text2'
                      }`}>
                        {c.categoria === 'fixa' ? 'Fixa' : 'Variável'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-app-muted whitespace-nowrap capitalize">{SUB_LABELS[c.subcategoria] ?? c.subcategoria}</td>
                    <td className="px-3 py-2 text-app-muted whitespace-nowrap">{c.dataVencimento.split('-').reverse().join('/')}</td>
                    <td className="px-3 py-2 font-semibold text-app-text whitespace-nowrap">{formatCurrency(c.valor)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium border ${
                        c.status === 'pago'
                          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                          : c.status === 'atrasado'
                            ? 'bg-red-500/10 text-red-400 border-red-500/20'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  )
}
