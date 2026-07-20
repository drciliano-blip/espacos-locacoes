'use client'

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useReceitas } from '@/contexts/ReceitasContext'
import { formatCurrency } from '@/lib/utils'

const COLORS = [
  '#25D366', '#818cf8', '#60a5fa', '#f472b6', '#fb923c', '#facc15', '#2dd4bf', '#c084fc',
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-app-border2 bg-app-surface2 px-3 py-2 text-sm shadow-xl">
        <p className="font-medium text-app-text">{payload[0].name}</p>
        <p style={{ color: payload[0].payload.fill }} className="text-xs">
          {formatCurrency(payload[0].value)} ({payload[0].payload.pct}%)
        </p>
      </div>
    )
  }
  return null
}

interface Props {
  dataInicio: string
  dataFim: string
  selectedSpaces?: string[]
}

export default function RevenueByCategoryChart({ dataInicio, dataFim, selectedSpaces }: Props) {
  const { receitas } = useReceitas()

  const filtradas = receitas.filter(r => {
    const matchData = r.data >= dataInicio && r.data <= dataFim
    const matchEspaco = !selectedSpaces || selectedSpaces.length === 0 || (!!r.espaco && selectedSpaces.includes(r.espaco))
    return matchData && matchEspaco
  })

  const catMap: Record<string, number> = {}
  for (const r of filtradas) {
    catMap[r.categoriaNome] = (catMap[r.categoriaNome] ?? 0) + r.valor
  }

  const total = Object.values(catMap).reduce((s, v) => s + v, 0)
  const chartData = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], i) => ({
      name,
      value,
      fill: COLORS[i % COLORS.length],
      pct: total > 0 ? Math.round((value / total) * 100) : 0,
    }))

  return (
    <div className="rounded-xl border border-app-border bg-app-surface p-5">
      <h3 className="text-sm font-semibold text-app-text mb-4">Receita por Categoria</h3>
      {chartData.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-app-subtle">
          Nenhuma receita cadastrada para o período selecionado.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={chartData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={2} dataKey="value">
              {chartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend iconType="circle" iconSize={7} formatter={(v) => <span className="text-xs text-app-muted">{v}</span>} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
