'use client'

import { useState, useMemo } from 'react'
import { Search, ChevronDown, ChevronUp, FolderOpen, Paperclip } from 'lucide-react'
import type { Receita, CategoriaReceita } from '@/contexts/ReceitasContext'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useEspacos } from '@/contexts/EspacosContext'
import FileList from '@/components/shared/FileList'
import FileSearchModal from '@/components/shared/FileSearchModal'

type StatusReceita = Receita['status']

const statusStyles: Record<StatusReceita, string> = {
  pago: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  pendente: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  atrasado: 'bg-red-500/10 text-red-400 border-red-500/20',
}

const statusLabels: Record<StatusReceita, string> = {
  pago: 'Pago',
  pendente: 'Pendente',
  atrasado: 'Atrasado',
}

interface PaymentsTableProps {
  receitas: Receita[]
  categorias: CategoriaReceita[]
}

export default function PaymentsTable({ receitas, categorias }: PaymentsTableProps) {
  const { espacosNomes } = useEspacos()
  const [search, setSearch]           = useState('')
  const [statusFilter, setStatus]     = useState<StatusReceita | 'todos'>('todos')
  const [espacoFilter, setEspaco]     = useState<string>('todos')
  const [categoriaFilter, setCategoriaFilter] = useState<string>('todos')
  const [dataInicio, setDataInicio]   = useState('')
  const [dataFim, setDataFim]         = useState('')
  const [expandedId, setExpandedId]   = useState<string | null>(null)
  const [docModalOpen, setDocModal]   = useState(false)

  const filtered = useMemo(() => {
    return receitas.filter((p) => {
      const matchSearch  = (p.cliente ?? '').toLowerCase().includes(search.toLowerCase()) ||
        p.descricao.toLowerCase().includes(search.toLowerCase())
      const matchStatus    = statusFilter === 'todos' || p.status === statusFilter
      const matchEspaco    = espacoFilter === 'todos' || p.espaco === espacoFilter
      const matchCategoria = categoriaFilter === 'todos' || p.categoriaId === categoriaFilter
      const ref          = p.dataRecebimento ?? p.data
      const matchInicio  = !dataInicio || ref >= dataInicio
      const matchFim     = !dataFim    || ref <= dataFim
      return matchSearch && matchStatus && matchEspaco && matchCategoria && matchInicio && matchFim
    })
  }, [receitas, search, statusFilter, espacoFilter, categoriaFilter, dataInicio, dataFim])

  const totals = useMemo(() => ({
    total:    filtered.reduce((s, p) => s + p.valor, 0),
    pago:     filtered.filter((p) => p.status === 'pago').reduce((s, p) => s + p.valor, 0),
    pendente: filtered.filter((p) => p.status === 'pendente').reduce((s, p) => s + p.valor, 0),
    atrasado: filtered.filter((p) => p.status === 'atrasado').reduce((s, p) => s + p.valor, 0),
  }), [filtered])

  function toggleRow(id: string) {
    setExpandedId(prev => prev === id ? null : id)
  }

  return (
    <div className="space-y-4">
      {/* KPI cards */}
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
        {/* Filters */}
        <div className="p-4 border-b border-app-border space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-app-subtle" />
              <input
                type="text"
                placeholder="Buscar cliente ou descrição..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-app-border2 bg-app-surface2 py-2 pl-9 pr-3 text-sm text-app-text placeholder-app-subtle focus:outline-none"
                onFocus={e => { e.currentTarget.style.borderColor = '#25D366' }}
                onBlur={e => { e.currentTarget.style.borderColor = '' }}
              />
            </div>
            <button
              onClick={() => setDocModal(true)}
              className="flex items-center gap-1.5 rounded-lg border border-app-border2 bg-app-surface px-3 py-2 text-sm font-medium text-app-text hover:bg-app-surface2 transition-colors shrink-0"
            >
              <FolderOpen className="h-4 w-4 text-[#25D366]" />
              Ver documentos
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={categoriaFilter}
              onChange={(e) => setCategoriaFilter(e.target.value)}
              className="rounded-lg border border-app-border2 bg-app-surface2 px-3 py-2 text-sm text-app-text2 focus:outline-none cursor-pointer"
            >
              <option value="todos">Todas categorias</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatus(e.target.value as StatusReceita | 'todos')}
              className="rounded-lg border border-app-border2 bg-app-surface2 px-3 py-2 text-sm text-app-text2 focus:outline-none cursor-pointer"
            >
              <option value="todos">Todos status</option>
              <option value="pago">Pago</option>
              <option value="pendente">Pendente</option>
              <option value="atrasado">Atrasado</option>
            </select>
            <select
              value={espacoFilter}
              onChange={(e) => setEspaco(e.target.value)}
              className="rounded-lg border border-app-border2 bg-app-surface2 px-3 py-2 text-sm text-app-text2 focus:outline-none cursor-pointer"
            >
              <option value="todos">Todos espaços</option>
              {espacosNomes.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-app-subtle">De</span>
              <input
                type="date"
                value={dataInicio}
                onChange={e => setDataInicio(e.target.value)}
                className="rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-2 text-sm text-app-text2 focus:outline-none cursor-pointer"
                onFocus={e => { e.currentTarget.style.borderColor = '#25D366' }}
                onBlur={e => { e.currentTarget.style.borderColor = '' }}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-app-subtle">até</span>
              <input
                type="date"
                value={dataFim}
                onChange={e => setDataFim(e.target.value)}
                className="rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-2 text-sm text-app-text2 focus:outline-none cursor-pointer"
                onFocus={e => { e.currentTarget.style.borderColor = '#25D366' }}
                onBlur={e => { e.currentTarget.style.borderColor = '' }}
              />
            </div>
            {(dataInicio || dataFim) && (
              <button
                onClick={() => { setDataInicio(''); setDataFim('') }}
                className="text-xs text-app-subtle hover:text-app-text transition-colors px-1"
              >
                Limpar datas
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-app-border">
                {['Cliente', 'Categoria', 'Espaço', 'Data', 'Descrição', 'Dt. Recebimento', 'Método', 'Valor', 'Status', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-app-subtle uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border/50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-sm text-app-subtle">
                    Nenhuma receita encontrada.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <>
                    <tr
                      key={p.id}
                      className="hover:bg-app-surface2/30 transition-colors cursor-pointer"
                      onClick={() => toggleRow(p.id)}
                    >
                      <td className="px-4 py-3 text-app-text font-medium whitespace-nowrap">{p.cliente ?? '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="rounded-full border border-violet-500/20 bg-violet-500/10 text-violet-400 px-2.5 py-0.5 text-xs font-medium">
                          {p.categoriaNome}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-app-muted whitespace-nowrap">{p.espaco ?? '—'}</td>
                      <td className="px-4 py-3 text-app-muted whitespace-nowrap">{formatDate(p.data)}</td>
                      <td className="px-4 py-3 text-app-muted max-w-xs truncate">{p.descricao}</td>
                      <td className="px-4 py-3 text-app-muted whitespace-nowrap">
                        {p.dataRecebimento ? formatDate(p.dataRecebimento) : '—'}
                      </td>
                      <td className="px-4 py-3 text-app-muted whitespace-nowrap">{p.metodoPagamento ?? '—'}</td>
                      <td className="px-4 py-3 font-semibold text-app-text whitespace-nowrap">{formatCurrency(p.valor)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusStyles[p.status]}`}>
                          {statusLabels[p.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="flex h-6 w-6 items-center justify-center rounded text-app-subtle">
                          {expandedId === p.id
                            ? <ChevronUp className="h-3.5 w-3.5" />
                            : <ChevronDown className="h-3.5 w-3.5" />}
                        </span>
                      </td>
                    </tr>
                    {expandedId === p.id && (
                      <tr key={`${p.id}-expand`}>
                        <td colSpan={10} className="px-6 py-4 bg-app-bg/50 border-b border-app-border/40">
                          <div className="max-w-lg">
                            <p className="text-xs font-medium text-app-muted flex items-center gap-1.5 mb-3">
                              <Paperclip className="h-3 w-3 text-[#25D366]" />
                              Comprovantes e documentos
                            </p>
                            <FileList
                              module="pagamentos"
                              entityId={p.id}
                              entityName={`${p.cliente ?? p.categoriaNome} — ${p.espaco ?? ''}`}
                              espaco={p.espaco}
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
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

      {docModalOpen && (
        <FileSearchModal
          onClose={() => setDocModal(false)}
          defaultModule="pagamentos"
          defaultEspaco={espacoFilter !== 'todos' ? espacoFilter : undefined}
        />
      )}
    </div>
  )
}
