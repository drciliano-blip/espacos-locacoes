'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { MonthlyAggregate } from '@/lib/relatorios-utils'
import { ESPACOS_CONFIG } from '@/lib/espacos-config'

const ESPACO_STROKE: Record<string, string> = {
  'Usine': '#a78bfa',
  'Fabrique': '#818cf8',
  'House Pacaembu': '#38bdf8',
  'Complexo Jussara': '#34d399',
  'Espaço Solon': '#fb923c',
}

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
    return (
      <div className="rounded-lg border border-app-border2 bg-app-surface2 px-3 py-2 text-sm shadow-xl">
        <p className="font-semibold text-app-text mb-2">{label}</p>
        {payload.map((p: any) => (
          <p key={p.dataKey} style={{ color: p.color }} className="text-xs">
            {p.dataKey}: {fmt(p.value)}
          </p>
        ))}
      </div>
    )
  }
  return null
}

interface SpaceBarChartProps {
  data: MonthlyAggregate[]
  selectedSpaces: string[]
}

export default function SpaceBarChart({ data, selectedSpaces }: SpaceBarChartProps) {
  const spaces = selectedSpaces.length > 0
    ? ESPACOS_CONFIG.filter((e) => selectedSpaces.includes(e.nome))
    : ESPACOS_CONFIG

  const chartData = data.map((m) => {
    const row: Record<string, string | number> = { label: m.label }
    for (const e of spaces) {
      row[e.nome] = m.receitaPorEspaco[e.nome] ?? 0
    }
    return row
  })

  return (
    <div className="rounded-xl border border-app-border bg-app-surface p-5">
      <h3 className="text-sm font-semibold text-app-text mb-4">Receita por Espaço</h3>
      {data.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-app-subtle">
          Nenhum dado para o período selecionado.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} barSize={spaces.length > 3 ? 8 : 14}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: 'var(--chart-tick)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fill: 'var(--chart-tick)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
            <Legend
              iconType="circle"
              iconSize={8}
              formatter={(v) => <span className="text-xs text-app-muted">{v}</span>}
            />
            {spaces.map((e) => (
              <Bar
                key={e.nome}
                dataKey={e.nome}
                fill={ESPACO_STROKE[e.nome]}
                radius={[2, 2, 0, 0]}
                stackId="stack"
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
