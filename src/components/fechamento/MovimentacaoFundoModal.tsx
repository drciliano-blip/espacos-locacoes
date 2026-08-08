'use client'

import { useState } from 'react'
import { X, Save, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import { parseCurrencyBR } from '@/lib/utils'
import type { Fundo, NovaMovimentacaoInput, TipoMovimentacaoFundo } from '@/contexts/FundosContext'

const GREEN = '#25D366'
const DARK_GREEN = '#128C7E'

interface Props {
  fundo: Fundo
  tipo: TipoMovimentacaoFundo
  onClose: () => void
  onSave: (input: NovaMovimentacaoInput) => Promise<void>
  onSaved: () => void
}

// Movimentação de fundo (entrada/saída) não é despesa nem receita — é só
// separação/liberação de saldo que continua pertencendo à empresa. Por isso
// não tem categoria nem comprovante, só Data/Valor/Descrição/Responsável.
export default function MovimentacaoFundoModal({ fundo, tipo, onClose, onSave, onSaved }: Props) {
  const [valor, setValor] = useState('')
  const [data, setData] = useState(() => new Date().toISOString().split('T')[0])
  const [descricao, setDescricao] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const errors = {
    valor: !valor || parseCurrencyBR(valor) <= 0,
    data: !data,
    responsavel: !responsavel.trim(),
  }
  const hasErrors = Object.values(errors).some(Boolean)

  async function handleSalvar() {
    setSubmitted(true)
    if (hasErrors) return
    setSaving(true)
    setErro(null)
    try {
      await onSave({
        fundoId: fundo.id,
        tipo,
        valor: parseCurrencyBR(valor),
        data,
        descricao: descricao.trim() || undefined,
        responsavel: responsavel.trim(),
      })
      onSaved()
      onClose()
    } catch (err) {
      setErro(err instanceof Error ? `Falha ao registrar: ${err.message}` : 'Falha ao registrar a movimentação. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const isEntrada = tipo === 'entrada'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-app-surface rounded-2xl border border-app-border shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-app-border sticky top-0 bg-app-surface z-10">
          <h2 className="text-sm font-semibold text-app-text flex items-center gap-2">
            {isEntrada ? <ArrowUpCircle className="h-4 w-4 text-emerald-500" /> : <ArrowDownCircle className="h-4 w-4 text-red-500" />}
            {isEntrada ? 'Adicionar valor' : 'Retirar valor'} — {fundo.nome}
          </h2>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-app-subtle hover:bg-app-surface2 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-app-subtle mb-0.5 block">Data<span className="text-red-400 ml-0.5">*</span></label>
              <input
                type="date"
                value={data}
                onChange={e => setData(e.target.value)}
                className={`w-full rounded-lg border ${submitted && errors.data ? 'border-red-500/50' : 'border-app-border2'} bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none`}
              />
            </div>
            <div>
              <label className="text-xs text-app-subtle mb-0.5 block">Valor (R$)<span className="text-red-400 ml-0.5">*</span></label>
              <input
                type="text" inputMode="decimal"
                value={valor}
                onChange={e => setValor(e.target.value)}
                placeholder="0,00"
                className={`w-full rounded-lg border ${submitted && errors.valor ? 'border-red-500/50' : 'border-app-border2'} bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none`}
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-app-subtle mb-0.5 block">Responsável<span className="text-red-400 ml-0.5">*</span></label>
            <input
              value={responsavel}
              onChange={e => setResponsavel(e.target.value)}
              placeholder="Nome de quem está fazendo o lançamento"
              className={`w-full rounded-lg border ${submitted && errors.responsavel ? 'border-red-500/50' : 'border-app-border2'} bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none`}
            />
          </div>

          <div>
            <label className="text-xs text-app-subtle mb-0.5 block">Descrição</label>
            <textarea
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              rows={2}
              className="w-full resize-none rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none"
            />
          </div>

          {erro && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5">
              <p className="text-xs text-red-400">{erro}</p>
            </div>
          )}
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
            onClick={handleSalvar}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            style={{ backgroundColor: GREEN }}
            onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = DARK_GREEN }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = GREEN }}
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? 'Salvando…' : 'Registrar'}
          </button>
        </div>
      </div>
    </div>
  )
}
