import { LucideIcon } from 'lucide-react'

interface KPICardProps {
  title: string
  value: string
  subtitle: string
  icon: LucideIcon
  trend?: string
  trendUp?: boolean
  color: 'green' | 'blue' | 'orange' | 'red'
}

const colorMap = {
  green: {
    iconBg:     'bg-[#25D366]/15',
    iconColor:  'text-[#25D366]',
    border:     'border-l-[#25D366]',
  },
  blue: {
    iconBg:    'bg-blue-500/15',
    iconColor: 'text-blue-500',
    border:    'border-l-blue-500',
  },
  orange: {
    iconBg:    'bg-orange-500/15',
    iconColor: 'text-orange-500',
    border:    'border-l-orange-500',
  },
  red: {
    iconBg:    'bg-red-500/15',
    iconColor: 'text-red-500',
    border:    'border-l-red-500',
  },
}

export default function KPICard({ title, value, subtitle, icon: Icon, trend, trendUp, color }: KPICardProps) {
  const c = colorMap[color]
  return (
    <div className={`rounded-xl border border-app-border border-l-4 ${c.border} bg-app-surface p-5 flex items-start justify-between`}>
      <div>
        <p className="text-xs font-medium text-app-muted uppercase tracking-wider">{title}</p>
        <p className="text-2xl font-bold text-app-text mt-1">{value}</p>
        <p className="text-xs text-app-subtle mt-0.5">{subtitle}</p>
        {trend && (
          <p className={`text-xs font-medium mt-2 ${trendUp ? 'text-emerald-500' : 'text-red-400'}`}>
            {trendUp ? '▲' : '▼'} {trend}
          </p>
        )}
      </div>
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${c.iconBg}`}>
        <Icon className={`h-5 w-5 ${c.iconColor}`} />
      </div>
    </div>
  )
}
