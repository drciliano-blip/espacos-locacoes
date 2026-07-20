'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { MonthlyAggregate } from '@/lib/relatorios-utils'

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-app-border2 bg-app-surface2 px-3 py-2 text-sm shadow-xl">
        <p className="font-semibold text-app-text mb-1">{label}</p>
        <p className="text-violet-400">
          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(payload[0].value)}
        </p>
        {payload[1] && (
          <p className="text-app-muted text-xs">{payload[1].value} eventos</p>
        )}
      </div>
    )
  }
  return null
}

interface RevenueLineChartProps {
  data: MonthlyAggregate[]
}

export default function RevenueLineChart({ data }: RevenueLineChartProps) {
  return (
    <div className="rounded-xl border border-app-border bg-app-surface p-5">
      <h3 className="text-sm font-semibold text-app-text mb-4">Receita por Período</h3>
      {data.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-app-subtle">
          Nenhum dado para o período selecionado.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="receitaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: 'var(--chart-tick)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: 'var(--chart-tick)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#a78bfa', strokeWidth: 1, strokeDasharray: '4 4' }} />
            <Area
              type="monotone"
              dataKey="receita"
              stroke="#a78bfa"
              strokeWidth={2}
              fill="url(#receitaGradient)"
              dot={{ fill: '#a78bfa', r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: '#a78bfa' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
