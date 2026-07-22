'use client'

import { useState } from 'react'
import { CheckCircle2, Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Receita, ParcelaPlano } from '@/contexts/ReceitasContext'

const GREEN = '#25D366'
const DARK_GREEN = '#128C7E'

const statusStyles: Record<string, string> = {
  pago: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  pendente: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  atrasado: 'bg-red-500/10 text-red-400 border-red-500/20',
}
const statusLabels: Record<string, string> = { pago: 'Pago', pendente: 'Pendente', atrasado: 'Atrasado' }

interface DraftParcela {
  numero: number
  label: string
  data: string
  valor: string
  status: Receita['status']
  id?: string
}

interface Props {
  valorEvento: number
  parcelas: Receita[]
  onSync: (parcelas: ParcelaPlano[]) => Promise<void>
  onBaixa: (id: string, patch: { status: 'pago'; dataRecebimento: string; metodoPagamento?: string }) => Promise<void>
}

function toDraft(parcelas: Receita[]): DraftParcela[] {
  return [...parcelas]
    .sort((a, b) => (a.parcelaNumero ?? 0) - (b.parcelaNumero ?? 0))
    .map(p => ({
      id: p.id,
      numero: p.parcelaNumero ?? 0,
      label: p.parcelaLabel ?? p.descricao,
      data: p.data,
      valor: String(p.valor),
      status: p.status,
    }))
}

export default function PlanoPagamentoSection({ valorEvento, parcelas, onSync, onBaixa }: Props) {
  const [editando, setEditando] = useState(false)
  const [draft, setDraft] = useState<DraftParcela[]>(() => toDraft(parcelas))
  const [saving, setSaving] = useState(false)
  const [baixaId, setBaixaId] = useState<string | null>(null)
  const [dataBaixa, setDataBaixa] = useState('')
  const [metodoBaixa, setMetodoBaixa] = useState('')

  const totalPlano = parcelas.reduce((s, p) => s + p.valor, 0)
  const totalPago = parcelas.filter(p => p.status === 'pago').reduce((s, p) => s + p.valor, 0)
  const totalAberto = totalPlano - totalPago
  const diferenca = Math.round((valorEvento - totalPlano) * 100) / 100

  function abrirEdicao() {
    setDraft(toDraft(parcelas))
    setEditando(true)
  }

  function setCampo(numero: number, campo: 'label' | 'data' | 'valor', valor: string) {
    setDraft(d => d.map(p => (p.numero === numero ? { ...p, [campo]: valor } : p)))
  }

  function adicionarParcela() {
    const proximoNumero = draft.length > 0 ? Math.max(...draft.map(p => p.numero)) + 1 : 1
    setDraft(d => [...d, { numero: proximoNumero, label: `Parcela ${proximoNumero}`, data: '', valor: '', status: 'pendente' }])
  }

  function removerParcela(numero: number) {
    setDraft(d => d.filter(p => p.numero !== numero))
  }

  async function salvarPlano() {
    const parcelasValidas = draft.filter(p => p.label.trim() && p.data && p.valor && Number(p.valor) > 0)
    if (parcelasValidas.length === 0) return
    setSaving(true)
    try {
      await onSync(parcelasValidas.map(p => ({ numero: p.numero, label: p.label.trim(), data: p.data, valor: Number(p.valor) })))
      setEditando(false)
    } finally {
      setSaving(false)
    }
  }

  function abrirBaixa(id: string) {
    setBaixaId(id)
    setDataBaixa(new Date().toISOString().split('T')[0])
    setMetodoBaixa('')
  }

  async function confirmarBaixa() {
    if (!baixaId || !dataBaixa) return
    await onBaixa(baixaId, { status: 'pago', dataRecebimento: dataBaixa, metodoPagamento: metodoBaixa || undefined })
    setBaixaId(null)
  }

  return (
    <div className="rounded-xl border border-app-border bg-app-surface p-4 space-y-3">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm font-semibold text-app-text">Plano de Pagamento</p>
        {!editando && (
          <button
            onClick={abrirEdicao}
            className="flex items-center gap-1.5 rounded-lg border border-app-border2 px-3 py-1.5 text-xs font-medium text-app-muted hover:bg-app-surface2 transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar plano
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-app-border2/50 bg-app-surface2/40 p-3">
          <p className="text-xs text-app-subtle">Total do plano</p>
          <p className="text-sm font-bold text-app-text">{formatCurrency(totalPlano)}</p>
        </div>
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
          <p className="text-xs text-emerald-600">Recebido</p>
          <p className="text-sm font-bold text-emerald-600">{formatCurrency(totalPago)}</p>
        </div>
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
          <p className="text-xs text-amber-600">Em aberto</p>
          <p className="text-sm font-bold text-amber-600">{formatCurrency(totalAberto)}</p>
        </div>
      </div>

      {diferenca !== 0 && (
        <p className="text-xs text-amber-500">
          O plano soma {formatCurrency(totalPlano)}, mas o evento vale {formatCurrency(valorEvento)}
          {diferenca > 0 ? ` (faltam ${formatCurrency(diferenca)} para lançar)` : ` (${formatCurrency(Math.abs(diferenca))} a mais que o valor do evento)`}.
        </p>
      )}

      {!editando ? (
        <div className="space-y-2">
          {parcelas.length === 0 ? (
            <p className="text-sm text-app-subtle text-center py-4">Nenhuma parcela cadastrada ainda.</p>
          ) : [...parcelas].sort((a, b) => (a.parcelaNumero ?? 0) - (b.parcelaNumero ?? 0)).map(p => (
            <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-app-border2/50 bg-app-surface2/40 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-app-text truncate">{p.parcelaLabel ?? p.descricao}</p>
                <p className="text-xs text-app-subtle mt-0.5">
                  Vencimento {formatDate(p.data)}
                  {p.dataRecebimento && ` · Pago em ${formatDate(p.dataRecebimento)}`}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusStyles[p.status]}`}>
                  {statusLabels[p.status]}
                </span>
                <span className="text-sm font-semibold text-app-text w-24 text-right">{formatCurrency(p.valor)}</span>
                {p.status !== 'pago' && (
                  <button
                    onClick={() => abrirBaixa(p.id)}
                    className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-white transition-colors"
                    style={{ backgroundColor: GREEN }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = DARK_GREEN }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = GREEN }}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Dar baixa
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {draft.map(p => (
            <div key={p.numero} className="flex items-center gap-2 rounded-lg border border-app-border2/50 bg-app-surface2/40 p-2.5">
              <input
                value={p.label}
                onChange={e => setCampo(p.numero, 'label', e.target.value)}
                placeholder="Ex: Sinal"
                disabled={p.status === 'pago'}
                className="w-32 shrink-0 rounded-lg border border-app-border2 bg-app-surface px-2 py-1.5 text-xs text-app-text focus:outline-none disabled:opacity-60"
              />
              <input
                type="date"
                value={p.data}
                onChange={e => setCampo(p.numero, 'data', e.target.value)}
                disabled={p.status === 'pago'}
                className="rounded-lg border border-app-border2 bg-app-surface px-2 py-1.5 text-xs text-app-text focus:outline-none disabled:opacity-60"
              />
              <input
                type="number" min="0" step="0.01"
                value={p.valor}
                onChange={e => setCampo(p.numero, 'valor', e.target.value)}
                placeholder="0,00"
                disabled={p.status === 'pago'}
                className="w-28 rounded-lg border border-app-border2 bg-app-surface px-2 py-1.5 text-xs text-app-text focus:outline-none disabled:opacity-60"
              />
              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${statusStyles[p.status]}`}>
                {statusLabels[p.status]}
              </span>
              {p.status !== 'pago' && (
                <button onClick={() => removerParcela(p.numero)} className="ml-auto shrink-0 text-red-400 hover:text-red-500 transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}

          <div className="flex items-center gap-2">
            <button
              onClick={adicionarParcela}
              className="flex items-center gap-1.5 rounded-lg border border-app-border2 px-3 py-1.5 text-xs text-app-muted hover:bg-app-surface2 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar parcela
            </button>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => setEditando(false)} className="rounded-lg border border-app-border2 px-3 py-1.5 text-xs text-app-muted hover:bg-app-surface2 transition-colors">
                Cancelar
              </button>
              <button
                onClick={salvarPlano}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 transition-colors"
                style={{ backgroundColor: GREEN }}
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? 'Salvando…' : 'Salvar plano'}
              </button>
            </div>
          </div>
        </div>
      )}

      {baixaId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setBaixaId(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-app-border bg-app-surface shadow-2xl p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-app-text">Dar baixa na parcela</p>
              <button onClick={() => setBaixaId(null)} className="flex h-7 w-7 items-center justify-center rounded-lg text-app-subtle hover:bg-app-surface2 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div>
              <label className="text-xs text-app-subtle mb-0.5 block">Data do pagamento</label>
              <input
                type="date"
                value={dataBaixa}
                onChange={e => setDataBaixa(e.target.value)}
                className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-app-subtle mb-0.5 block">Método (opcional)</label>
              <input
                value={metodoBaixa}
                onChange={e => setMetodoBaixa(e.target.value)}
                placeholder="Ex: PIX"
                className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none"
              />
            </div>
            <button
              onClick={confirmarBaixa}
              disabled={!dataBaixa}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 transition-colors"
              style={{ backgroundColor: GREEN }}
            >
              <CheckCircle2 className="h-4 w-4" />
              Confirmar baixa
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
