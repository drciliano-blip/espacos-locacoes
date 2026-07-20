'use client'

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { MonthlyAggregate } from '@/lib/relatorios-utils'

const COLORS = [
  '#a78bfa', '#818cf8', '#60a5fa', '#34d399', '#fb923c',
  '#f472b6', '#facc15', '#2dd4bf', '#c084fc', '#38bdf8',
]

function CustomTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-app-border2 bg-app-surface2 px-3 py-2 text-sm shadow-xl">
        <p className="font-medium text-app-text">{payload[0].name}</p>
        <p style={{ color: payload[0].payload.fill }} className="text-xs">
          {payload[0].value} eventos ({payload[0].payload.pct}%)
        </p>
      </div>
    )
  }
  return null
}

interface CategoryPieChartProps {
  data: MonthlyAggregate[]
}

export default function CategoryPieChart({ data }: CategoryPieChartProps) {
  const catMap: Record<string, number> = {}
  for (const m of data) {
    for (const [cat, count] of Object.entries(m.eventosPorCategoria)) {
      catMap[cat] = (catMap[cat] ?? 0) + count
    }
  }

  const total = Object.values(catMap).reduce((s, v) => s + v, 0)
  const chartData = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, value], i) => ({
      name,
      value,
      fill: COLORS[i % COLORS.length],
      pct: total > 0 ? Math.round((value / total) * 100) : 0,
    }))

  return (
    <div className="rounded-xl border border-app-border bg-app-surface p-5">
      <h3 className="text-sm font-semibold text-app-text mb-4">Eventos por Categoria</h3>
      {chartData.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-app-subtle">
          Nenhum dado para o período selecionado.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              iconType="circle"
              iconSize={7}
              formatter={(v) => <span className="text-xs text-app-muted">{v}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
