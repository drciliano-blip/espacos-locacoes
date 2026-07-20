'use client'

import { useMemo } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useEventos } from '@/contexts/EventosContext'

const COLORS = ['#a78bfa', '#818cf8', '#60a5fa', '#34d399', '#fb923c', '#f472b6', '#facc15']

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-app-border2 bg-app-surface2 px-3 py-2 text-sm shadow-xl">
        <p className="font-medium text-app-text">{payload[0].name}</p>
        <p className="text-violet-400">{payload[0].value} eventos</p>
      </div>
    )
  }
  return null
}

export default function OccupancyChart() {
  const { eventos } = useEventos()

  const data = useMemo(() => {
    const porEspaco: Record<string, number> = {}
    for (const e of eventos) {
      if (e.status === 'cancelado') continue
      porEspaco[e.espaco] = (porEspaco[e.espaco] ?? 0) + 1
    }
    return Object.entries(porEspaco)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [eventos])

  return (
    <div className="rounded-xl border border-app-border bg-app-surface p-5">
      <h3 className="text-sm font-semibold text-app-text mb-4">Eventos por Espaço</h3>
      {data.length === 0 ? (
        <div className="flex h-[200px] items-center justify-center text-sm text-app-subtle">
          Nenhum evento cadastrado ainda.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
            >
              {data.map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              iconType="circle"
              iconSize={8}
              formatter={(value) => <span className="text-xs text-app-muted">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
