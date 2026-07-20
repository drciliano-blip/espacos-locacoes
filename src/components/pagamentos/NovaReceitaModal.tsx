'use client'

import { useState } from 'react'
import { X, Save, DollarSign } from 'lucide-react'
import { useEspacos } from '@/contexts/EspacosContext'
import type { CategoriaReceita, NovaReceitaInput } from '@/contexts/ReceitasContext'
import type { FormaPagamento } from '@/types'

const GREEN = '#25D366'
const DARK_GREEN = '#128C7E'

const FORMAS_PAGAMENTO: FormaPagamento[] = [
  'PIX', 'Transferência', 'Dinheiro', 'Cartão de Crédito', 'Cartão de Débito', 'Cheque',
]

interface Props {
  categorias: CategoriaReceita[]
  onClose: () => void
  onSave: (input: NovaReceitaInput) => Promise<void>
  eventoId?: string
  espacoPadrao?: string
  clientePadrao?: string
  excludeSlugs?: string[]
}

interface Draft {
  categoriaId: string
  espaco: string
  cliente: string
  descricao: string
  data: string
  dataRecebimento: string
  valor: string
  status: 'pago' | 'pendente' | 'atrasado'
  metodoPagamento: string
  observacoes: string
}

function emptyDraft(categoriaId: string, espaco: string, cliente: string): Draft {
  return {
    categoriaId, espaco, cliente, descricao: '', data: '', dataRecebimento: '',
    valor: '', status: 'pendente', metodoPagamento: '', observacoes: '',
  }
}

export default function NovaReceitaModal({
  categorias, onClose, onSave, eventoId, espacoPadrao, clientePadrao, excludeSlugs,
}: Props) {
  const { espacosNomes } = useEspacos()
  const categoriasDisponiveis = excludeSlugs
    ? categorias.filter(c => !excludeSlugs.includes(c.slug))
    : categorias
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(
    categoriasDisponiveis[0]?.id ?? '',
    espacoPadrao ?? '',
    clientePadrao ?? '',
  ))
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)

  function set<K extends keyof Draft>(k: K, v: Draft[K]) {
    setDraft(d => ({ ...d, [k]: v }))
  }

  const errors = {
    categoriaId: !draft.categoriaId,
    descricao: !draft.descricao.trim(),
    data: !draft.data,
    valor: !draft.valor || Number.isNaN(Number(draft.valor)) || Number(draft.valor) <= 0,
  }
  const hasErrors = Object.values(errors).some(Boolean)

  async function handleSave() {
    setSubmitted(true)
    if (hasErrors) return
    setSaving(true)
    try {
      await onSave({
        categoriaId: draft.categoriaId,
        eventoId,
        espaco: draft.espaco || undefined,
        cliente: draft.cliente.trim() || undefined,
        descricao: draft.descricao.trim(),
        data: draft.data,
        dataRecebimento: draft.dataRecebimento || undefined,
        valor: Number(draft.valor),
        status: draft.status,
        metodoPagamento: draft.metodoPagamento || undefined,
        observacoes: draft.observacoes.trim() || undefined,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-app-border bg-app-surface shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-app-border sticky top-0 bg-app-surface z-10">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-[#25D366]" />
            <h2 className="text-sm font-semibold text-app-text">Nova Receita</h2>
          </div>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-app-subtle hover:bg-app-surface2 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs text-app-subtle mb-0.5 block">
              Categoria<span className="text-red-400 ml-0.5">*</span>
            </label>
            <select
              value={draft.categoriaId}
              onChange={e => set('categoriaId', e.target.value)}
              className={`w-full cursor-pointer rounded-lg border ${submitted && errors.categoriaId ? 'border-red-500/50' : 'border-app-border2'} bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none`}
            >
              {categoriasDisponiveis.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs text-app-subtle mb-0.5 block">
              Descrição<span className="text-red-400 ml-0.5">*</span>
            </label>
            <input
              value={draft.descricao}
              onChange={e => set('descricao', e.target.value)}
              placeholder="Ex: Venda de bebidas — evento Família Silva"
              className={`w-full rounded-lg border ${submitted && errors.descricao ? 'border-red-500/50' : 'border-app-border2'} bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-app-subtle mb-0.5 block">Cliente</label>
              <input
                value={draft.cliente}
                onChange={e => set('cliente', e.target.value)}
                placeholder="Opcional"
                disabled={!!clientePadrao}
                className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none disabled:opacity-60 disabled:cursor-default"
              />
            </div>
            <div>
              <label className="text-xs text-app-subtle mb-0.5 block">Espaço</label>
              <select
                value={draft.espaco}
                onChange={e => set('espaco', e.target.value)}
                disabled={!!espacoPadrao}
                className="w-full cursor-pointer rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none disabled:opacity-60 disabled:cursor-default"
              >
                <option value="">— Nenhum —</option>
                {espacosNomes.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-app-subtle mb-0.5 block">
                Data<span className="text-red-400 ml-0.5">*</span>
              </label>
              <input
                type="date"
                value={draft.data}
                onChange={e => set('data', e.target.value)}
                className={`w-full rounded-lg border ${submitted && errors.data ? 'border-red-500/50' : 'border-app-border2'} bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none`}
              />
            </div>
            <div>
              <label className="text-xs text-app-subtle mb-0.5 block">
                Valor (R$)<span className="text-red-400 ml-0.5">*</span>
              </label>
              <input
                type="number" min="0" step="0.01"
                value={draft.valor}
                onChange={e => set('valor', e.target.value)}
                placeholder="0,00"
                className={`w-full rounded-lg border ${submitted && errors.valor ? 'border-red-500/50' : 'border-app-border2'} bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none`}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-app-subtle mb-0.5 block">Status</label>
              <select
                value={draft.status}
                onChange={e => set('status', e.target.value as Draft['status'])}
                className="w-full cursor-pointer rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none"
              >
                <option value="pendente">Pendente</option>
                <option value="pago">Pago</option>
                <option value="atrasado">Atrasado</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-app-subtle mb-0.5 block">Data de recebimento</label>
              <input
                type="date"
                value={draft.dataRecebimento}
                onChange={e => set('dataRecebimento', e.target.value)}
                className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-app-subtle mb-0.5 block">Método de pagamento</label>
            <select
              value={draft.metodoPagamento}
              onChange={e => set('metodoPagamento', e.target.value)}
              className="w-full cursor-pointer rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none"
            >
              <option value="">— Selecione —</option>
              {FORMAS_PAGAMENTO.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs text-app-subtle mb-0.5 block">Observações</label>
            <textarea
              value={draft.observacoes}
              onChange={e => set('observacoes', e.target.value)}
              rows={2}
              className="w-full resize-none rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none"
            />
          </div>

          {submitted && hasErrors && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5">
              <p className="text-xs text-red-400">Preencha todos os campos obrigatórios antes de salvar.</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-app-border">
          <button onClick={onClose} className="rounded-lg border border-app-border2 px-4 py-2 text-sm text-app-muted hover:bg-app-surface2 transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            style={{ backgroundColor: GREEN }}
            onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = DARK_GREEN }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = GREEN }}
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? 'Salvando…' : 'Salvar receita'}
          </button>
        </div>
      </div>
    </div>
  )
}
