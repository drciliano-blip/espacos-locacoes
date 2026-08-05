'use client'

import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useContasPagar } from '@/contexts/ContasPagarContext'
import { formatCurrency } from '@/lib/utils'
import { DespesasTable, SUBCATEGORIA_LABEL } from './LancamentosTables'
import type { CategoriaContaPagar } from '@/types'

const CATEGORIAS: CategoriaContaPagar[] = ['operacional', 'obra', 'financeiro']
const CATEGORIA_LABEL: Record<CategoriaContaPagar, string> = {
  operacional: 'Operacional', obra: 'Obra', financeiro: 'Financeiro',
}
const CATEGORIA_COLOR: Record<CategoriaContaPagar, string> = {
  operacional: '#0ea5e9', obra: '#f97316', financeiro: '#25D366',
}

interface Props {
  selectedSpaces?: string[]
  dataInicio?: string
  dataFim?: string
}

export default function DespesasSection({ selectedSpaces, dataInicio, dataFim }: Props) {
  const { contas: contasPagar } = useContasPagar()
  const contas = useMemo(() => {
    return contasPagar.filter(c => {
      const matchEspaco = !selectedSpaces?.length || selectedSpaces.includes(c.espaco)
      const matchInicio = !dataInicio || c.dataVencimento >= dataInicio
      const matchFim    = !dataFim    || c.dataVencimento <= dataFim
      return matchEspaco && matchInicio && matchFim
    })
  }, [contasPagar, selectedSpaces, dataInicio, dataFim])

  const total = contas.reduce((s, c) => s + c.valor, 0)

  const porCategoria = useMemo(() => CATEGORIAS.map(cat => {
    const rows = contas.filter(c => c.categoria === cat)
    return {
      categoria: cat,
      total: rows.reduce((s, c) => s + c.valor, 0),
      pagas: rows.filter(c => c.status === 'pago').reduce((s, c) => s + c.valor, 0),
      pct: total > 0 ? Math.round((rows.reduce((s, c) => s + c.valor, 0) / total) * 100) : 0,
    }
  }), [contas, total])

  const porSubcategoria = useMemo(() => {
    const map: Record<string, Record<CategoriaContaPagar, number>> = {}
    for (const c of contas) {
      const sub = c.subcategoria
      if (!map[sub]) map[sub] = { operacional: 0, obra: 0, financeiro: 0 }
      map[sub][c.categoria] += c.valor
    }
    return Object.entries(map).map(([sub, vals]) => ({
      name: SUBCATEGORIA_LABEL[sub] ?? sub,
      Operacional: vals.operacional,
      Obra: vals.obra,
      Financeiro: vals.financeiro,
    })).sort((a, b) => (b.Operacional + b.Obra + b.Financeiro) - (a.Operacional + a.Obra + a.Financeiro))
  }, [contas])

  return (
    <div className="rounded-2xl border border-app-border bg-app-surface p-5 space-y-5">
      <h3 className="text-sm font-semibold text-app-text">Despesas — Operacional, Obra e Financeiro</h3>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="min-w-0 rounded-xl border border-app-border2 bg-app-bg p-4">
          <p className="text-xs text-app-subtle mb-1">Total Despesas</p>
          <p className="text-lg font-bold text-app-text break-words">{formatCurrency(total)}</p>
          <p className="text-xs text-app-subtle mt-1">{contas.length} lançamentos</p>
        </div>
        {porCategoria.map(c => (
          <div key={c.categoria} className="min-w-0 rounded-xl border border-app-border2 bg-app-bg p-4">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-xs font-medium" style={{ color: CATEGORIA_COLOR[c.categoria] }}>{CATEGORIA_LABEL[c.categoria]}</p>
              <span className="text-xs font-semibold shrink-0" style={{ color: CATEGORIA_COLOR[c.categoria] }}>{c.pct}%</span>
            </div>
            <p className="text-lg font-bold text-app-text break-words">{formatCurrency(c.total)}</p>
            <p className="text-xs text-app-subtle mt-1 break-words">Pagas: {formatCurrency(c.pagas)}</p>
          </div>
        ))}
      </div>

      {/* Proportion bar */}
      {total > 0 && (
        <div>
          <div className="flex rounded-full overflow-hidden h-3">
            {porCategoria.map(c => (
              <div key={c.categoria} style={{ width: `${c.pct}%`, backgroundColor: CATEGORIA_COLOR[c.categoria] }} />
            ))}
          </div>
          <div className="flex gap-4 mt-2">
            {porCategoria.map(c => (
              <span key={c.categoria} className="flex items-center gap-1.5 text-xs text-app-muted">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: CATEGORIA_COLOR[c.categoria] }} />
                {CATEGORIA_LABEL[c.categoria]} {c.pct}%
              </span>
            ))}
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
              <Bar dataKey="Operacional" fill={CATEGORIA_COLOR.operacional} radius={[3, 3, 0, 0]} maxBarSize={32} />
              <Bar dataKey="Obra" fill={CATEGORIA_COLOR.obra} radius={[3, 3, 0, 0]} maxBarSize={32} />
              <Bar dataKey="Financeiro" fill={CATEGORIA_COLOR.financeiro} radius={[3, 3, 0, 0]} maxBarSize={32} />
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
          <DespesasTable despesas={contas} />
        </details>
      )}
    </div>
  )
}
