import { DollarSign, CalendarCheck, TrendingUp, Users } from 'lucide-react'
import type { MonthlyAggregate } from '@/lib/relatorios-utils'
import { formatCurrency } from '@/lib/utils'

interface KPISummaryProps {
  data: MonthlyAggregate[]
}

export default function KPISummary({ data }: KPISummaryProps) {
  const totalReceita = data.reduce((s, m) => s + m.receita, 0)
  const totalEventos = data.reduce((s, m) => s + m.totalEventos, 0)
  const avgOcupacao = data.length > 0
    ? Math.round(data.reduce((s, m) => s + m.taxaOcupacaoMedia, 0) / data.length)
    : 0

  const receitaMedia = data.length > 0 ? Math.round(totalReceita / data.length) : 0

  const prevHalf = data.slice(0, Math.floor(data.length / 2))
  const currHalf = data.slice(Math.floor(data.length / 2))
  const prevAvg = prevHalf.length ? prevHalf.reduce((s, m) => s + m.receita, 0) / prevHalf.length : 0
  const currAvg = currHalf.length ? currHalf.reduce((s, m) => s + m.receita, 0) / currHalf.length : 0
  const growthPct = prevAvg > 0 ? Math.round(((currAvg - prevAvg) / prevAvg) * 100) : 0

  const cards = [
    {
      label: 'Receita Total',
      value: formatCurrency(totalReceita),
      sub: `Média: ${formatCurrency(receitaMedia)}/mês`,
      icon: DollarSign,
      color: 'text-violet-400',
      bgColor: 'bg-violet-500/10',
      borderColor: 'border-violet-500/20',
    },
    {
      label: 'Total de Eventos',
      value: String(totalEventos),
      sub: `Média: ${data.length > 0 ? (totalEventos / data.length).toFixed(1) : 0} por mês`,
      icon: CalendarCheck,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/20',
    },
    {
      label: 'Crescimento',
      value: `${growthPct >= 0 ? '+' : ''}${growthPct}%`,
      sub: 'Primeira vs. segunda metade',
      icon: TrendingUp,
      color: growthPct >= 0 ? 'text-emerald-400' : 'text-red-400',
      bgColor: growthPct >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10',
      borderColor: growthPct >= 0 ? 'border-emerald-500/20' : 'border-red-500/20',
    },
    {
      label: 'Ocupação Média',
      value: `${avgOcupacao}%`,
      sub: 'Média de capacidade utilizada',
      icon: Users,
      color: 'text-sky-400',
      bgColor: 'bg-sky-500/10',
      borderColor: 'border-sky-500/20',
    },
  ]

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
      {cards.map(({ label, value, sub, icon: Icon, color, bgColor, borderColor }) => (
        <div key={label} className={`rounded-xl border ${borderColor} ${bgColor} p-4`}>
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium text-app-subtle uppercase tracking-wider">{label}</p>
            <Icon className={`h-4 w-4 ${color}`} />
          </div>
          <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
          <p className="text-xs text-app-subtle mt-0.5">{sub}</p>
        </div>
      ))}
    </div>
  )
}
