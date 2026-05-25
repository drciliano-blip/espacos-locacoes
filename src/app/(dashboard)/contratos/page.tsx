'use client'

import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import ContractCard from '@/components/contratos/ContractCard'
import { contratos } from '@/lib/mock-data'
import { ESPACOS } from '@/lib/mock-data'
import type { Espaco, StatusEvento } from '@/types'

export default function ContratosPage() {
  const [search, setSearch] = useState('')
  const [espacoFilter, setEspacoFilter] = useState<Espaco | 'todos'>('todos')
  const [statusFilter, setStatusFilter] = useState<StatusEvento | 'todos'>('todos')

  const filtered = useMemo(() => {
    return contratos.filter((c) => {
      const matchSearch =
        c.cliente.toLowerCase().includes(search.toLowerCase()) ||
        c.numeroContrato.toLowerCase().includes(search.toLowerCase())
      const matchEspaco = espacoFilter === 'todos' || c.espaco === espacoFilter
      const matchStatus = statusFilter === 'todos' || c.status === statusFilter
      return matchSearch && matchEspaco && matchStatus
    })
  }, [search, espacoFilter, statusFilter])

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-app-subtle" />
          <input
            type="text"
            placeholder="Buscar cliente ou nº contrato..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-app-border2 bg-app-surface py-2 pl-9 pr-3 text-sm text-app-text placeholder-app-subtle focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
        </div>
        <select
          value={espacoFilter}
          onChange={(e) => setEspacoFilter(e.target.value as Espaco | 'todos')}
          className="rounded-lg border border-app-border2 bg-app-surface px-3 py-2 text-sm text-app-text2 focus:border-violet-500 focus:outline-none cursor-pointer"
        >
          <option value="todos">Todos espaços</option>
          {ESPACOS.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusEvento | 'todos')}
          className="rounded-lg border border-app-border2 bg-app-surface px-3 py-2 text-sm text-app-text2 focus:border-violet-500 focus:outline-none cursor-pointer"
        >
          <option value="todos">Todos status</option>
          <option value="confirmado">Confirmado</option>
          <option value="tentativo">Tentativo</option>
          <option value="cancelado">Cancelado</option>
        </select>
      </div>

      <p className="text-xs text-app-subtle">{filtered.length} contrato{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}</p>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-app-border bg-app-surface p-8 text-center">
            <p className="text-sm text-app-subtle">Nenhum contrato encontrado.</p>
          </div>
        ) : (
          filtered.map((c) => <ContractCard key={c.id} contrato={c} />)
        )}
      </div>
    </div>
  )
}
