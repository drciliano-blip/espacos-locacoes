'use client'

import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import type { MonthlyAggregate, ProjecaoMes } from '@/lib/relatorios-utils'

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-app-border2 bg-app-surface2 px-3 py-2.5 text-sm shadow-xl min-w-[180px]">
        <p className="font-semibold text-app-text mb-2">{label}</p>
        {payload.map((p: any) => p.value != null && (
          <div key={p.dataKey} className="flex items-center justify-between gap-4 text-xs mb-0.5">
            <span style={{ color: p.color }}>{p.name}</span>
            <span className="font-medium text-app-text">{fmt(p.value)}</span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

interface ProjectionChartProps {
  historico: MonthlyAggregate[]
  projecoes: ProjecaoMes[]
}

export default function ProjectionChart({ historico, projecoes }: ProjectionChartProps) {
  // Merge actual + projected into unified dataset
  const actualData = historico.map((m) => ({
    label: m.label,
    yearMonth: m.yearMonth,
    real: m.receita,
    realista: undefined as number | undefined,
    otimista: undefined as number | undefined,
    pessimista: undefined as number | undefined,
    isProjecao: false,
  }))

  // Last actual point bridges to projection line
  const last = historico[historico.length - 1]
  const projData = projecoes.map((p, i) => ({
    label: p.label,
    yearMonth: p.yearMonth,
    real: i === 0 && last ? last.receita : undefined,
    realista: p.realista,
    otimista: p.otimista,
    pessimista: p.pessimista,
    isProjecao: true,
  }))

  const merged = [...actualData, ...projData]
  const boundaryLabel = projecoes[0]?.label

  return (
    <div className="rounded-xl border border-app-border bg-app-surface p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-app-text">Projeção Financeira</h3>
          <p className="text-xs text-app-subtle mt-0.5">Baseado em regressão linear dos últimos 12 meses</p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs">
          {[
            { color: 'bg-violet-500', label: 'Realizado' },
            { color: 'bg-sky-400', label: 'Realista' },
            { color: 'bg-emerald-400', label: 'Otimista (+20%)' },
            { color: 'bg-red-400', label: 'Pessimista (-20%)' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5 text-app-muted">
              <span className={`h-2 w-3 rounded ${color} inline-block`} />
              {label}
            </div>
          ))}
        </div>
      </div>

      {historico.length < 3 ? (
        <div className="flex h-52 items-center justify-center text-sm text-app-subtle">
          Dados insuficientes para projeção. Selecione um período maior.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={merged}>
            <defs>
              <linearGradient id="realGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.2} />
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
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#52525b', strokeWidth: 1 }} />

            {boundaryLabel && (
              <ReferenceLine
                x={boundaryLabel}
                stroke="#52525b"
                strokeDasharray="6 3"
                label={{ value: 'Projeção →', position: 'insideTopRight', fill: '#71717a', fontSize: 11 }}
              />
            )}

            {/* Uncertainty band between pessimista and otimista */}
            <Area
              type="monotone"
              dataKey="otimista"
              stroke="none"
              fill="#34d399"
              fillOpacity={0.06}
              name="Banda"
              legendType="none"
            />
            <Area
              type="monotone"
              dataKey="pessimista"
              stroke="none"
              fill="#09090b"
              fillOpacity={1}
              name="Banda2"
              legendType="none"
            />

            {/* Actual */}
            <Area
              type="monotone"
              dataKey="real"
              stroke="#a78bfa"
              strokeWidth={2.5}
              fill="url(#realGradient)"
              dot={false}
              activeDot={{ r: 4, fill: '#a78bfa' }}
              name="Realizado"
              connectNulls={false}
            />

            {/* Projections */}
            <Line
              type="monotone"
              dataKey="realista"
              stroke="#38bdf8"
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={false}
              activeDot={{ r: 4, fill: '#38bdf8' }}
              name="Realista"
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="otimista"
              stroke="#34d399"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              name="Otimista"
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="pessimista"
              stroke="#f87171"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              name="Pessimista"
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}

      {projecoes.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-app-border pt-4">
          {[
            { label: 'Otimista (próx. 6m)', value: projecoes.reduce((s, p) => s + p.otimista, 0), color: 'text-emerald-400' },
            { label: 'Realista (próx. 6m)', value: projecoes.reduce((s, p) => s + p.realista, 0), color: 'text-sky-400' },
            { label: 'Pessimista (próx. 6m)', value: projecoes.reduce((s, p) => s + p.pessimista, 0), color: 'text-red-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center">
              <p className="text-xs text-app-subtle mb-0.5">{label}</p>
              <p className={`text-sm font-bold ${color}`}>{fmt(value)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
