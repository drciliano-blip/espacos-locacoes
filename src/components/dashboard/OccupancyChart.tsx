'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const data = [
  { name: 'Usine', value: 12 },
  { name: 'Fabrique', value: 9 },
  { name: 'House Pacaembu', value: 7 },
  { name: 'Complexo Jussara', value: 11 },
  { name: 'Espaço Solon', value: 6 },
]

const COLORS = ['#a78bfa', '#818cf8', '#60a5fa', '#34d399', '#fb923c']

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
  return (
    <div className="rounded-xl border border-app-border bg-app-surface p-5">
      <h3 className="text-sm font-semibold text-app-text mb-4">Eventos por Espaço (2026)</h3>
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
    </div>
  )
}
