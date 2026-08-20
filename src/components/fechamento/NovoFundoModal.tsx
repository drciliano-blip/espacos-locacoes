'use client'

import { useState } from 'react'
import { X, Save, Vault } from 'lucide-react'
import { useEspacos } from '@/contexts/EspacosContext'
import { parseCurrencyBR } from '@/lib/utils'
import type { NovoFundoInput } from '@/contexts/FundosContext'

const GREEN = '#25D366'
const DARK_GREEN = '#128C7E'

interface Props {
  onClose: () => void
  onSave: (input: NovoFundoInput) => Promise<unknown>
  onSaved: () => void
}

export default function NovoFundoModal({ onClose, onSave, onSaved }: Props) {
  const { espacosNomes } = useEspacos()
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [espaco, setEspaco] = useState('')
  const [valorInicial, setValorInicial] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const errors = { nome: !nome.trim() }
  const hasErrors = Object.values(errors).some(Boolean)

  async function handleSalvar() {
    setSubmitted(true)
    if (hasErrors) return
    setSaving(true)
    setErro(null)
    try {
      await onSave({
        nome: nome.trim(),
        descricao: descricao.trim() || undefined,
        espaco: espaco || undefined,
        valorInicial: valorInicial ? parseCurrencyBR(valorInicial) : undefined,
      })
      onSaved()
      onClose()
    } catch (err) {
      setErro(err instanceof Error ? `Falha ao criar: ${err.message}` : 'Falha ao criar o fundo. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-app-surface rounded-2xl border border-app-border shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-app-border sticky top-0 bg-app-surface z-10">
          <h2 className="text-sm font-semibold text-app-text flex items-center gap-2">
            <Vault className="h-4 w-4 text-amber-500" />
            Criar Fundo
          </h2>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-app-subtle hover:bg-app-surface2 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs text-app-subtle mb-0.5 block">Nome do fundo<span className="text-red-400 ml-0.5">*</span></label>
            <input
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex: Reserva para Impostos"
              className={`w-full rounded-lg border ${submitted && errors.nome ? 'border-red-500/50' : 'border-app-border2'} bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none`}
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

          <div>
            <label className="text-xs text-app-subtle mb-0.5 block">Espaço</label>
            <select
              value={espaco}
              onChange={e => setEspaco(e.target.value)}
              className="w-full cursor-pointer rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none"
            >
              <option value="">— Todos os espaços (empresa) —</option>
              {espacosNomes.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs text-app-subtle mb-0.5 block">Valor (R$) — quanto existe hoje nessa reserva</label>
            <input
              type="text" inputMode="decimal"
              value={valorInicial}
              onChange={e => setValorInicial(e.target.value)}
              placeholder="0,00"
              className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none"
            />
          </div>

          {erro && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5">
              <p className="text-xs text-red-400">{erro}</p>
            </div>
          )}
          {submitted && hasErrors && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5">
              <p className="text-xs text-red-400">Dê um nome ao fundo antes de salvar.</p>
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
            {saving ? 'Criando…' : 'Criar fundo'}
          </button>
        </div>
      </div>
    </div>
  )
}
