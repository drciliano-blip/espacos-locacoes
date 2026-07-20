'use client'

import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useReceitas } from '@/contexts/ReceitasContext'

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-app-border2 bg-app-surface2 px-3 py-2 text-sm shadow-xl">
        <p className="font-medium text-app-text">{label}</p>
        <p className="text-violet-400">
          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(payload[0].value)}
        </p>
      </div>
    )
  }
  return null
}

export default function RevenueChart() {
  const { receitas } = useReceitas()

  const data = useMemo(() => {
    const hoje = new Date()
    const meses: { yearMonth: string; mes: string }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
      meses.push({ yearMonth: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, mes: MONTH_LABELS[d.getMonth()] })
    }
    const porMes: Record<string, number> = {}
    for (const r of receitas) {
      if (r.status !== 'pago') continue
      const ym = r.data.substring(0, 7)
      porMes[ym] = (porMes[ym] ?? 0) + r.valor
    }
    return meses.map(m => ({ mes: m.mes, receita: porMes[m.yearMonth] ?? 0 }))
  }, [receitas])

  return (
    <div className="rounded-xl border border-app-border bg-app-surface p-5">
      <h3 className="text-sm font-semibold text-app-text mb-4">Receita Mensal (últimos 6 meses)</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} barSize={32}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
          <XAxis dataKey="mes" tick={{ fill: 'var(--chart-tick)', fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fill: 'var(--chart-tick)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(167,139,250,0.08)' }} />
          <Bar dataKey="receita" fill="#a78bfa" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
