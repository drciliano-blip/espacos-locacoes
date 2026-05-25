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
import type { MonthlyAggregate } from '@/lib/historical-data'

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-app-border2 bg-app-surface2 px-3 py-2 text-sm shadow-xl">
        <p className="font-semibold text-app-text mb-1">{label}</p>
        <p className="text-sky-400">{payload[0].value}% ocupação</p>
        <p className="text-app-muted text-xs">{payload[1]?.value ?? 0} eventos</p>
      </div>
    )
  }
  return null
}

interface OccupancyAreaChartProps {
  data: MonthlyAggregate[]
}

export default function OccupancyAreaChart({ data }: OccupancyAreaChartProps) {
  return (
    <div className="rounded-xl border border-app-border bg-app-surface p-5">
      <h3 className="text-sm font-semibold text-app-text mb-4">Taxa de Ocupação & Volume de Eventos</h3>
      {data.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-app-subtle">
          Nenhum dado para o período selecionado.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="occGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="evGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#34d399" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: 'var(--chart-tick)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis
              yAxisId="occ"
              tick={{ fill: 'var(--chart-tick)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
              domain={[0, 100]}
            />
            <YAxis
              yAxisId="ev"
              orientation="right"
              tick={{ fill: 'var(--chart-tick)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#38bdf8', strokeWidth: 1, strokeDasharray: '4 4' }} />
            <Area
              yAxisId="occ"
              type="monotone"
              dataKey="taxaOcupacaoMedia"
              stroke="#38bdf8"
              strokeWidth={2}
              fill="url(#occGradient)"
              dot={false}
            />
            <Area
              yAxisId="ev"
              type="monotone"
              dataKey="totalEventos"
              stroke="#34d399"
              strokeWidth={1.5}
              fill="url(#evGradient)"
              dot={false}
              strokeDasharray="4 2"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
      <div className="flex gap-4 mt-3">
        <div className="flex items-center gap-1.5 text-xs text-app-subtle">
          <span className="h-2 w-4 rounded bg-sky-400 inline-block" />
          Taxa de Ocupação
        </div>
        <div className="flex items-center gap-1.5 text-xs text-app-subtle">
          <span className="h-2 w-4 rounded bg-emerald-400 inline-block" />
          Nº de Eventos
        </div>
      </div>
    </div>
  )
}
