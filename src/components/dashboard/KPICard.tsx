import { LucideIcon } from 'lucide-react'

interface KPICardProps {
  title: string
  value: string
  subtitle: string
  icon: LucideIcon
  trend?: string
  trendUp?: boolean
  color: 'violet' | 'emerald' | 'amber' | 'sky'
}

const colorMap = {
  violet: {
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
    icon: 'text-violet-400',
    iconBg: 'bg-violet-500/15',
  },
  emerald: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    icon: 'text-emerald-400',
    iconBg: 'bg-emerald-500/15',
  },
  amber: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    icon: 'text-amber-400',
    iconBg: 'bg-amber-500/15',
  },
  sky: {
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/20',
    icon: 'text-sky-400',
    iconBg: 'bg-sky-500/15',
  },
}

export default function KPICard({ title, value, subtitle, icon: Icon, trend, trendUp, color }: KPICardProps) {
  const c = colorMap[color]
  return (
    <div className={`rounded-xl border ${c.border} bg-app-surface p-5 flex items-start justify-between`}>
      <div>
        <p className="text-xs font-medium text-app-muted uppercase tracking-wider">{title}</p>
        <p className="text-2xl font-bold text-app-text mt-1">{value}</p>
        <p className="text-xs text-app-subtle mt-0.5">{subtitle}</p>
        {trend && (
          <p className={`text-xs font-medium mt-2 ${trendUp ? 'text-emerald-400' : 'text-red-400'}`}>
            {trendUp ? '▲' : '▼'} {trend}
          </p>
        )}
      </div>
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${c.iconBg}`}>
        <Icon className={`h-5 w-5 ${c.icon}`} />
      </div>
    </div>
  )
}
