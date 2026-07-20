'use client'

import { useState } from 'react'
import { X, Save, FileText, DollarSign, User } from 'lucide-react'
import { useEspacos } from '@/contexts/EspacosContext'
import type { Contrato, Espaco } from '@/types'

interface Draft {
  cliente: string
  cpfCnpj: string
  espaco: Espaco | ''
  dataEvento: string
  horaInicio: string
  horaFim: string
  tipo: string
  valorTotal: string
  valorEntrada: string
  responsavel: string
  observacoes: string
  status: 'confirmado' | 'em_negociacao' | 'cancelado'
}

function emptyDraft(): Draft {
  return {
    cliente: '', cpfCnpj: '', espaco: '', dataEvento: '',
    horaInicio: '', horaFim: '', tipo: '', valorTotal: '',
    valorEntrada: '', responsavel: '', observacoes: '',
    status: 'em_negociacao',
  }
}

interface Props {
  onClose: () => void
  onSave: (c: Contrato) => void
}

const GREEN = '#25D366'
const DARK_GREEN = '#128C7E'

export default function NovoContratoModal({ onClose, onSave }: Props) {
  const { espacosNomes } = useEspacos()
  const [draft, setDraft]       = useState<Draft>(emptyDraft)
  const [submitted, setSubmitted] = useState(false)

  const errors = {
    cliente:    !draft.cliente.trim(),
    espaco:     !draft.espaco,
    dataEvento: !draft.dataEvento,
    horaInicio: !draft.horaInicio,
    horaFim:    !draft.horaFim,
    valorTotal: !draft.valorTotal || isNaN(Number(draft.valorTotal)) || Number(draft.valorTotal) <= 0,
  }
  const hasErrors = Object.values(errors).some(Boolean)

  function set(k: keyof Draft, v: string) {
    setDraft(d => ({ ...d, [k]: v }))
  }

  function handleSave() {
    setSubmitted(true)
    if (hasErrors) return

    const now   = new Date()
    const seq   = String(now.getFullYear()).slice(2) + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0')
    const contrato: Contrato = {
      id:              crypto.randomUUID(),
      numeroContrato:  `EL-${seq}-${String(Date.now()).slice(-4)}`,
      cliente:         draft.cliente.trim(),
      cpfCnpj:         draft.cpfCnpj.trim() || '—',
      espaco:          draft.espaco as Espaco,
      dataEvento:      draft.dataEvento,
      horaInicio:      draft.horaInicio,
      horaFim:         draft.horaFim,
      tipo:            draft.tipo.trim() || 'Evento',
      valorTotal:      Number(draft.valorTotal),
      valorEntrada:    Number(draft.valorEntrada) || 0,
      dataAssinatura:  now.toISOString().split('T')[0],
      status:          draft.status,
      responsavel:     draft.responsavel.trim() || '—',
      observacoes:     draft.observacoes.trim(),
    }

    onSave(contrato)
    onClose()
  }

  function Field({
    label, draftKey, type = 'text', required = false, placeholder = '',
  }: {
    label: string; draftKey: keyof Draft
    type?: 'text' | 'number' | 'date' | 'time'; required?: boolean; placeholder?: string
  }) {
    const err = submitted && required && !!(errors as Record<string, boolean>)[draftKey]
    return (
      <div>
        <label className="text-xs text-app-subtle mb-0.5 block">
          {label}{required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
        <input
          type={type}
          value={draft[draftKey] as string}
          onChange={e => set(draftKey, e.target.value)}
          placeholder={placeholder}
          className={`w-full rounded-lg border ${err ? 'border-red-500/50' : 'border-app-border2'} bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none`}
          onFocus={e => { e.currentTarget.style.borderColor = err ? '' : GREEN }}
          onBlur={e => { e.currentTarget.style.borderColor = '' }}
        />
        {err && <p className="text-xs text-red-400 mt-0.5">Campo obrigatório</p>}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-app-surface rounded-2xl border border-app-border shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-app-border sticky top-0 bg-app-surface z-10">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-[#25D366]" />
            <h2 className="text-sm font-semibold text-app-text">Novo Contrato</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-app-border2 px-3 py-1.5 text-xs font-medium text-app-muted hover:bg-app-surface2 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors"
              style={{ backgroundColor: GREEN }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = DARK_GREEN }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = GREEN }}
            >
              <Save className="h-3.5 w-3.5" />
              Salvar contrato
            </button>
            <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-app-subtle hover:bg-app-surface2 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">

          {/* Cliente */}
          <section>
            <h4 className="flex items-center gap-2 text-xs font-semibold text-app-subtle uppercase tracking-wider mb-3">
              <User className="h-3.5 w-3.5" />
              Cliente
            </h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <div className="col-span-2">
                <Field label="Nome do Cliente" draftKey="cliente" required placeholder="Ex: João Silva" />
              </div>
              <div className="col-span-2">
                <Field label="CPF / CNPJ" draftKey="cpfCnpj" placeholder="000.000.000-00" />
              </div>
            </div>
          </section>

          {/* Evento */}
          <section>
            <h4 className="flex items-center gap-2 text-xs font-semibold text-app-subtle uppercase tracking-wider mb-3">
              <FileText className="h-3.5 w-3.5" />
              Dados do Evento
            </h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {/* Espaço */}
              <div className="col-span-2">
                <label className="text-xs text-app-subtle mb-0.5 block">
                  Espaço<span className="text-red-400 ml-0.5">*</span>
                </label>
                <select
                  value={draft.espaco}
                  onChange={e => set('espaco', e.target.value)}
                  className={`w-full rounded-lg border ${submitted && errors.espaco ? 'border-red-500/50' : 'border-app-border2'} bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none cursor-pointer`}
                  onFocus={e => { e.currentTarget.style.borderColor = GREEN }}
                  onBlur={e => { e.currentTarget.style.borderColor = '' }}
                >
                  <option value="">— Selecione —</option>
                  {espacosNomes.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
                {submitted && errors.espaco && <p className="text-xs text-red-400 mt-0.5">Campo obrigatório</p>}
              </div>

              <Field label="Data do Evento" draftKey="dataEvento" type="date" required />

              {/* Status */}
              <div>
                <label className="text-xs text-app-subtle mb-0.5 block">Status</label>
                <select
                  value={draft.status}
                  onChange={e => set('status', e.target.value)}
                  className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none cursor-pointer"
                  onFocus={e => { e.currentTarget.style.borderColor = GREEN }}
                  onBlur={e => { e.currentTarget.style.borderColor = '' }}
                >
                  <option value="em_negociacao">Em negociação</option>
                  <option value="confirmado">Confirmado</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>

              <Field label="Hora início" draftKey="horaInicio" type="time" required />
              <Field label="Hora fim"    draftKey="horaFim"    type="time" required />

              <div className="col-span-2">
                <Field label="Tipo de Evento" draftKey="tipo" placeholder="Ex: Casamento, Workshop, Show…" />
              </div>
            </div>
          </section>

          {/* Financeiro */}
          <section>
            <h4 className="flex items-center gap-2 text-xs font-semibold text-app-subtle uppercase tracking-wider mb-3">
              <DollarSign className="h-3.5 w-3.5" />
              Financeiro
            </h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Field label="Valor Total (R$)"  draftKey="valorTotal"   type="number" required placeholder="0,00" />
              <Field label="Entrada (R$)"       draftKey="valorEntrada" type="number" placeholder="0,00" />
              <div className="col-span-2">
                <Field label="Responsável" draftKey="responsavel" placeholder="Nome do funcionário responsável" />
              </div>
            </div>
          </section>

          {/* Observações */}
          <section>
            <label className="text-xs text-app-subtle mb-1 block">Observações</label>
            <textarea
              value={draft.observacoes}
              onChange={e => set('observacoes', e.target.value)}
              rows={3}
              placeholder="Notas sobre o contrato…"
              className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none resize-none"
              onFocus={e => { e.currentTarget.style.borderColor = GREEN }}
              onBlur={e => { e.currentTarget.style.borderColor = '' }}
            />
          </section>

          {submitted && hasErrors && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5">
              <p className="text-xs text-red-400">Preencha todos os campos obrigatórios antes de salvar.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
