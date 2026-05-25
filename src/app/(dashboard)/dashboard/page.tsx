import { DollarSign, CalendarCheck, TrendingUp, AlertCircle } from 'lucide-react'
import KPICard from '@/components/dashboard/KPICard'
import RevenueChart from '@/components/dashboard/RevenueChart'
import OccupancyChart from '@/components/dashboard/OccupancyChart'
import { eventos, pagamentos } from '@/lib/mock-data'
import { formatCurrency } from '@/lib/utils'

export default function DashboardPage() {
  const confirmedThisMonth = eventos.filter(
    (e) => e.status === 'confirmado' && e.data.startsWith('2026-05')
  ).length

  const receitaMes = pagamentos
    .filter((p) => p.status === 'pago' && p.dataEvento.startsWith('2026-05'))
    .reduce((s, p) => s + p.valor, 0)

  const pendente = pagamentos
    .filter((p) => p.status === 'pendente')
    .reduce((s, p) => s + p.valor, 0)

  const atrasado = pagamentos
    .filter((p) => p.status === 'atrasado')
    .reduce((s, p) => s + p.valor, 0)

  const proximosEventos = eventos
    .filter((e) => e.status === 'confirmado')
    .sort((a, b) => a.data.localeCompare(b.data))
    .slice(0, 5)

  const statusBadge: Record<string, string> = {
    confirmado: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    tentativo: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    cancelado: 'bg-red-500/10 text-red-400 border-red-500/20',
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard
          title="Receita do Mês"
          value={formatCurrency(receitaMes)}
          subtitle="Maio 2026"
          icon={DollarSign}
          trend="+18% vs abril"
          trendUp={true}
          color="violet"
        />
        <KPICard
          title="Eventos Confirmados"
          value={String(confirmedThisMonth)}
          subtitle="Este mês"
          icon={CalendarCheck}
          trend="+3 vs mês anterior"
          trendUp={true}
          color="emerald"
        />
        <KPICard
          title="A Receber"
          value={formatCurrency(pendente)}
          subtitle="Pagamentos pendentes"
          icon={TrendingUp}
          color="sky"
        />
        <KPICard
          title="Em Atraso"
          value={formatCurrency(atrasado)}
          subtitle="Requer atenção"
          icon={AlertCircle}
          color="amber"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RevenueChart />
        <OccupancyChart />
      </div>

      <div className="rounded-xl border border-app-border bg-app-surface">
        <div className="px-5 py-4 border-b border-app-border">
          <h3 className="text-sm font-semibold text-app-text">Próximos Eventos Confirmados</h3>
        </div>
        <div className="divide-y divide-app-border/50">
          {proximosEventos.map((e) => (
            <div key={e.id} className="flex items-center justify-between px-5 py-3 hover:bg-app-surface2/30 transition-colors">
              <div>
                <p className="text-sm font-medium text-app-text">{e.cliente}</p>
                <p className="text-xs text-app-subtle">{e.espaco} · {e.tipo}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-app-muted">
                  {e.data.split('-').reverse().join('/')} · {e.horaInicio}
                </span>
                <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadge[e.status]}`}>
                  {e.status}
                </span>
                <span className="text-sm font-semibold text-violet-400">
                  {formatCurrency(e.valor)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
