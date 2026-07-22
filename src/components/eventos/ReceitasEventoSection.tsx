'use client'

import { useState, useMemo } from 'react'
import { Search, Plus, Calendar, Paperclip, FileText } from 'lucide-react'
import { useEventos } from '@/contexts/EventosContext'
import { useReceitas } from '@/contexts/ReceitasContext'
import { formatCurrency, formatDate } from '@/lib/utils'
import NovaReceitaModal from '@/components/pagamentos/NovaReceitaModal'
import AnexarRelatorioModal from '@/components/eventos/AnexarRelatorioModal'
import PlanoPagamentoSection from '@/components/eventos/PlanoPagamentoSection'
import FileList from '@/components/shared/FileList'
import type { Evento } from '@/types'
import type { ParcelaPlano } from '@/contexts/ReceitasContext'

const statusStyles: Record<string, string> = {
  pago: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  pendente: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  atrasado: 'bg-red-500/10 text-red-400 border-red-500/20',
}
const statusLabels: Record<string, string> = { pago: 'Pago', pendente: 'Pendente', atrasado: 'Atrasado' }

export default function ReceitasEventoSection() {
  const { eventos } = useEventos()
  const { receitas, categorias, addReceita, syncParcelasDoEvento, updateReceita } = useReceitas()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Evento | null>(null)
  const [novaOpen, setNovaOpen] = useState(false)
  const [anexarOpen, setAnexarOpen] = useState(false)
  const [filesVersion, setFilesVersion] = useState(0)

  const filtrados = useMemo(() => {
    const q = search.toLowerCase()
    return eventos
      .filter(e => !q || e.cliente.toLowerCase().includes(q) || e.espaco.toLowerCase().includes(q))
      .slice()
      .sort((a, b) => b.data.localeCompare(a.data))
  }, [eventos, search])

  const receitasDoEvento = selected ? receitas.filter(r => r.eventoId === selected.id) : []
  const parcelasAluguel = receitasDoEvento.filter(r => r.categoriaSlug === 'aluguel' && r.parcelaNumero != null)
  const outrasReceitas = receitasDoEvento.filter(r => !(r.categoriaSlug === 'aluguel' && r.parcelaNumero != null))

  async function handleSyncPlano(parcelas: ParcelaPlano[]) {
    if (!selected) return
    await syncParcelasDoEvento({ eventoId: selected.id, cliente: selected.cliente, espaco: selected.espaco, parcelas })
  }

  async function handleBaixa(id: string, patch: { status: 'pago'; dataRecebimento: string; metodoPagamento?: string }) {
    await updateReceita(id, patch)
  }

  if (!selected) {
    return (
      <div className="space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-app-subtle" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar evento por cliente ou espaço..."
            className="w-full rounded-lg border border-app-border2 bg-app-surface py-2 pl-9 pr-3 text-sm text-app-text placeholder-app-subtle focus:outline-none"
          />
        </div>

        <div className="space-y-2">
          {filtrados.length === 0 ? (
            <div className="rounded-xl border border-app-border bg-app-surface p-8 text-center">
              <p className="text-sm text-app-subtle">Nenhum evento encontrado.</p>
            </div>
          ) : filtrados.map(e => (
            <button
              key={e.id}
              onClick={() => setSelected(e)}
              className="w-full flex items-center justify-between gap-4 rounded-lg border border-app-border2/50 bg-app-surface2/40 px-4 py-3 text-left hover:bg-app-surface2/70 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-app-text truncate">{e.cliente}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-app-subtle">{e.espaco}</span>
                  <span className="flex items-center gap-1 text-xs text-app-subtle">
                    <Calendar className="h-3 w-3" />
                    {formatDate(e.data)}
                  </span>
                </div>
              </div>
              <span className="text-sm font-semibold text-app-text2 shrink-0">{formatCurrency(e.valor)}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <button onClick={() => setSelected(null)} className="text-xs text-app-muted hover:text-app-text transition-colors">
        ← Voltar para lista de eventos
      </button>

      <div className="rounded-xl border border-app-border bg-app-surface p-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-app-text">{selected.cliente}</p>
          <p className="text-xs text-app-subtle mt-0.5">{selected.espaco} · {formatDate(selected.data)}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setAnexarOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-app-border2 bg-app-surface px-3 py-2 text-sm font-medium text-app-text hover:bg-app-surface2 transition-colors"
          >
            <Paperclip className="h-4 w-4 text-[#25D366]" />
            Anexar relatório
          </button>
          <button
            onClick={() => setNovaOpen(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white transition-colors"
            style={{ backgroundColor: '#25D366' }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#128C7E' }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#25D366' }}
          >
            <Plus className="h-4 w-4" />
            Nova Receita
          </button>
        </div>
      </div>

      <PlanoPagamentoSection
        valorEvento={selected.valor}
        parcelas={parcelasAluguel}
        onSync={handleSyncPlano}
        onBaixa={handleBaixa}
      />

      <div className="space-y-2">
        <p className="text-xs font-medium text-app-muted">Outras receitas do evento</p>
        {outrasReceitas.length === 0 ? (
          <div className="rounded-xl border border-app-border bg-app-surface p-8 text-center">
            <p className="text-sm text-app-subtle">Nenhuma outra receita lançada para este evento ainda.</p>
          </div>
        ) : outrasReceitas.map(r => (
          <div key={r.id} className="flex items-center justify-between gap-4 rounded-lg border border-app-border2/50 bg-app-surface2/40 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium text-app-text truncate">{r.descricao}</p>
                <span className="rounded-full border border-violet-500/20 bg-violet-500/10 text-violet-400 px-2 py-0.5 text-xs font-medium shrink-0">
                  {r.categoriaNome}
                </span>
              </div>
              <p className="text-xs text-app-subtle mt-0.5">{formatDate(r.data)}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusStyles[r.status]}`}>
                {statusLabels[r.status]}
              </span>
              <span className="text-sm font-semibold text-app-text">{formatCurrency(r.valor)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-app-border bg-app-surface p-4">
        <p className="text-xs font-medium text-app-muted flex items-center gap-1.5 mb-3">
          <FileText className="h-3.5 w-3.5 text-[#25D366]" />
          Relatórios anexados
        </p>
        <FileList
          key={filesVersion}
          module="receitas"
          entityId={selected.id}
          entityName={selected.cliente}
          espaco={selected.espaco}
          showAttach={false}
        />
      </div>

      {novaOpen && (
        <NovaReceitaModal
          categorias={categorias}
          onClose={() => setNovaOpen(false)}
          onSave={addReceita}
          eventoId={selected.id}
          espacoPadrao={selected.espaco}
          clientePadrao={selected.cliente}
          excludeSlugs={['aluguel']}
        />
      )}

      {anexarOpen && (
        <AnexarRelatorioModal
          evento={selected}
          categorias={categorias}
          onClose={() => { setAnexarOpen(false); setFilesVersion(v => v + 1) }}
          onSaveReceita={addReceita}
        />
      )}
    </div>
  )
}
