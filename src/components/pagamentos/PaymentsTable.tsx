'use client'

import { useState, useMemo } from 'react'
import { Search, Filter } from 'lucide-react'
import type { Pagamento, StatusPagamento, Espaco } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ESPACOS } from '@/lib/mock-data'

const statusStyles: Record<StatusPagamento, string> = {
  pago: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  pendente: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  atrasado: 'bg-red-500/10 text-red-400 border-red-500/20',
}

const statusLabels: Record<StatusPagamento, string> = {
  pago: 'Pago',
  pendente: 'Pendente',
  atrasado: 'Atrasado',
}

interface PaymentsTableProps {
  pagamentos: Pagamento[]
}

export default function PaymentsTable({ pagamentos }: PaymentsTableProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusPagamento | 'todos'>('todos')
  const [espacoFilter, setEspacoFilter] = useState<Espaco | 'todos'>('todos')

  const filtered = useMemo(() => {
    return pagamentos.filter((p) => {
      const matchSearch = p.cliente.toLowerCase().includes(search.toLowerCase()) ||
        p.descricao.toLowerCase().includes(search.toLowerCase())
      const matchStatus = statusFilter === 'todos' || p.status === statusFilter
      const matchEspaco = espacoFilter === 'todos' || p.espaco === espacoFilter
      return matchSearch && matchStatus && matchEspaco
    })
  }, [pagamentos, search, statusFilter, espacoFilter])

  const totals = useMemo(() => ({
    total: filtered.reduce((s, p) => s + p.valor, 0),
    pago: filtered.filter((p) => p.status === 'pago').reduce((s, p) => s + p.valor, 0),
    pendente: filtered.filter((p) => p.status === 'pendente').reduce((s, p) => s + p.valor, 0),
    atrasado: filtered.filter((p) => p.status === 'atrasado').reduce((s, p) => s + p.valor, 0),
  }), [filtered])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: totals.total, color: 'text-app-text' },
          { label: 'Recebido', value: totals.pago, color: 'text-emerald-400' },
          { label: 'Pendente', value: totals.pendente, color: 'text-amber-400' },
          { label: 'Atrasado', value: totals.atrasado, color: 'text-red-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-app-border bg-app-surface p-4">
            <p className="text-xs text-app-subtle mb-1">{label}</p>
            <p className={`text-lg font-bold ${color}`}>{formatCurrency(value)}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-app-border bg-app-surface">
        <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-app-border">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-app-subtle" />
            <input
              type="text"
              placeholder="Buscar cliente ou descrição..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-app-border2 bg-app-surface2 py-2 pl-9 pr-3 text-sm text-app-text placeholder-app-subtle focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusPagamento | 'todos')}
              className="rounded-lg border border-app-border2 bg-app-surface2 px-3 py-2 text-sm text-app-text2 focus:border-violet-500 focus:outline-none cursor-pointer"
            >
              <option value="todos">Todos status</option>
              <option value="pago">Pago</option>
              <option value="pendente">Pendente</option>
              <option value="atrasado">Atrasado</option>
            </select>
            <select
              value={espacoFilter}
              onChange={(e) => setEspacoFilter(e.target.value as Espaco | 'todos')}
              className="rounded-lg border border-app-border2 bg-app-surface2 px-3 py-2 text-sm text-app-text2 focus:border-violet-500 focus:outline-none cursor-pointer"
            >
              <option value="todos">Todos espaços</option>
              {ESPACOS.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-app-border">
                {['Cliente', 'Espaço', 'Data Evento', 'Descrição', 'Dt. Pagamento', 'Método', 'Valor', 'Status'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-app-subtle uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border/50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-app-subtle">
                    Nenhum pagamento encontrado.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-app-surface2/30 transition-colors">
                    <td className="px-4 py-3 text-app-text font-medium whitespace-nowrap">{p.cliente}</td>
                    <td className="px-4 py-3 text-app-muted whitespace-nowrap">{p.espaco}</td>
                    <td className="px-4 py-3 text-app-muted whitespace-nowrap">{formatDate(p.dataEvento)}</td>
                    <td className="px-4 py-3 text-app-muted max-w-xs truncate">{p.descricao}</td>
                    <td className="px-4 py-3 text-app-muted whitespace-nowrap">
                      {p.dataPagamento ? formatDate(p.dataPagamento) : '—'}
                    </td>
                    <td className="px-4 py-3 text-app-muted whitespace-nowrap">{p.metodoPagamento ?? '—'}</td>
                    <td className="px-4 py-3 font-semibold text-app-text whitespace-nowrap">{formatCurrency(p.valor)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusStyles[p.status]}`}>
                        {statusLabels[p.status]}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-app-border text-xs text-app-subtle">
            {filtered.length} registro{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  )
}
