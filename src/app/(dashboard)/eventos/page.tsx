'use client'

import { useState, useMemo } from 'react'
import { Search, FolderOpen, Plus, FileText, DollarSign } from 'lucide-react'
import ContractCard from '@/components/contratos/ContractCard'
import FileSearchModal from '@/components/shared/FileSearchModal'
import NovoContratoModal from '@/components/contratos/NovoContratoModal'
import DocumentosSection from '@/components/eventos/DocumentosSection'
import ReceitasEventoSection from '@/components/eventos/ReceitasEventoSection'
import { useEspacos } from '@/contexts/EspacosContext'
import { useContratos } from '@/contexts/ContratosContext'
import type { StatusEvento } from '@/types'

type Tab = 'contratos' | 'documentos' | 'receitas'

const TABS: { key: Tab; label: string; Icon: typeof FileText }[] = [
  { key: 'contratos',  label: 'Contratos',  Icon: FileText },
  { key: 'documentos', label: 'Documentos', Icon: FolderOpen },
  { key: 'receitas',   label: 'Receitas',   Icon: DollarSign },
]

export default function EventosPage() {
  const { espacosNomes } = useEspacos()
  const { contratos, addContrato } = useContratos()
  const [tab, setTab] = useState<Tab>('contratos')
  const [search, setSearch]           = useState('')
  const [espacoFilter, setEspacoFilter] = useState<string>('todos')
  const [statusFilter, setStatusFilter] = useState<StatusEvento | 'todos'>('todos')
  const [docModalOpen, setDocModalOpen] = useState(false)
  const [novoOpen, setNovoOpen]         = useState(false)

  const filtered = useMemo(() => {
    return contratos.filter((c) => {
      const matchSearch =
        c.cliente.toLowerCase().includes(search.toLowerCase()) ||
        c.numeroContrato.toLowerCase().includes(search.toLowerCase())
      const matchEspaco = espacoFilter === 'todos' || c.espaco === espacoFilter
      const matchStatus = statusFilter === 'todos' || c.status === statusFilter
      return matchSearch && matchEspaco && matchStatus
    })
  }, [contratos, search, espacoFilter, statusFilter])

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {/* Tabs */}
      <div className="flex border-b border-app-border overflow-x-auto">
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`relative flex shrink-0 items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              tab === key ? 'text-[#128C7E]' : 'text-app-muted hover:text-app-text'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
            {tab === key && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#25D366]" />}
          </button>
        ))}
      </div>

      {tab === 'contratos' && (
        <div className="max-w-4xl space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setDocModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-app-border2 bg-app-surface px-3 py-2 text-sm font-medium text-app-text hover:bg-app-surface2 transition-colors"
            >
              <FolderOpen className="h-4 w-4 text-[#25D366]" />
              Ver documentos
            </button>
            <button
              onClick={() => setNovoOpen(true)}
              className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white transition-colors"
              style={{ backgroundColor: '#25D366' }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#128C7E' }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#25D366' }}
            >
              <Plus className="h-4 w-4" />
              Novo Contrato
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-app-subtle" />
              <input
                type="text"
                placeholder="Buscar cliente ou nº contrato..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-app-border2 bg-app-surface py-2 pl-9 pr-3 text-sm text-app-text placeholder-app-subtle focus:outline-none"
                onFocus={e => { e.currentTarget.style.borderColor = '#25D366' }}
                onBlur={e => { e.currentTarget.style.borderColor = '' }}
              />
            </div>
            <select
              value={espacoFilter}
              onChange={(e) => setEspacoFilter(e.target.value)}
              className="rounded-lg border border-app-border2 bg-app-surface px-3 py-2 text-sm text-app-text2 focus:outline-none cursor-pointer"
            >
              <option value="todos">Todos espaços</option>
              {espacosNomes.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusEvento | 'todos')}
              className="rounded-lg border border-app-border2 bg-app-surface px-3 py-2 text-sm text-app-text2 focus:outline-none cursor-pointer"
            >
              <option value="todos">Todos status</option>
              <option value="confirmado">Confirmado</option>
              <option value="em_negociacao">Em negociação</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>

          {docModalOpen && <FileSearchModal onClose={() => setDocModalOpen(false)} defaultModule="contratos" />}
          {novoOpen && (
            <NovoContratoModal
              onClose={() => setNovoOpen(false)}
              onSave={addContrato}
            />
          )}

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
      )}

      {tab === 'documentos' && <DocumentosSection />}
      {tab === 'receitas' && <ReceitasEventoSection />}
    </div>
  )
}
