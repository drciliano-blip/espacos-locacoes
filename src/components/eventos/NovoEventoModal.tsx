'use client'

import { useState } from 'react'
import { X, Save, Calendar, DollarSign, User, ClipboardCheck } from 'lucide-react'
import type { Evento, Espaco, TipoEvento, FormaPagamento } from '@/types'

const ESPACOS: Espaco[] = [
  'Usine',
  'Fabrique',
  'House Pacaembu',
  'Complexo Jussara',
  'Espaço Solon',
]

const FORMAS_PAGAMENTO: FormaPagamento[] = [
  'PIX',
  'Transferência',
  'Dinheiro',
  'Cartão de Crédito',
  'Cartão de Débito',
  'Cheque',
]

interface Draft {
  cliente: string
  espaco: Espaco | ''
  data: string
  horaInicio: string
  horaFim: string
  tipo: string
  tipoEvento: TipoEvento | ''
  status: 'confirmado' | 'tentativo' | 'cancelado'
  valor: string
  numeroPessoas: string
  responsavel: string
  telefoneContato: string
  formaPagamento: FormaPagamento | ''
  observacoes: string
}

function emptyDraft(espacoPadrao?: Espaco): Draft {
  return {
    cliente: '',
    espaco: espacoPadrao ?? '',
    data: '',
    horaInicio: '',
    horaFim: '',
    tipo: '',
    tipoEvento: '',
    status: 'tentativo',
    valor: '',
    numeroPessoas: '',
    responsavel: '',
    telefoneContato: '',
    formaPagamento: '',
    observacoes: '',
  }
}

interface NovoEventoModalProps {
  espacoPadrao?: Espaco
  onClose: () => void
  onSave: (evento: Evento) => void
}

export default function NovoEventoModal({ espacoPadrao, onClose, onSave }: NovoEventoModalProps) {
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(espacoPadrao))
  const [submitted, setSubmitted] = useState(false)

  const errors: Partial<Record<keyof Draft, boolean>> = {
    cliente:    !draft.cliente.trim(),
    espaco:     !draft.espaco,
    data:       !draft.data,
    horaInicio: !draft.horaInicio,
    horaFim:    !draft.horaFim,
    valor:      !draft.valor || Number.isNaN(Number(draft.valor)) || Number(draft.valor) <= 0,
  }

  const hasErrors = Object.values(errors).some(Boolean)

  function set(key: keyof Draft, value: string) {
    setDraft(d => ({ ...d, [key]: value }))
  }

  function handleSave() {
    setSubmitted(true)
    if (hasErrors) return

    const evento: Evento = {
      id:              `ev-${Date.now()}`,
      cliente:         draft.cliente.trim(),
      espaco:          draft.espaco as Espaco,
      data:            draft.data,
      horaInicio:      draft.horaInicio,
      horaFim:         draft.horaFim,
      tipo:            draft.tipo.trim() || 'Evento',
      tipoEvento:      (draft.tipoEvento as TipoEvento) || undefined,
      status:          draft.status,
      valor:           Number(draft.valor),
      numeroPessoas:   draft.numeroPessoas ? Number(draft.numeroPessoas) : undefined,
      responsavel:     draft.responsavel.trim() || undefined,
      telefoneContato: draft.telefoneContato.trim() || undefined,
      formaPagamento:  (draft.formaPagamento as FormaPagamento) || undefined,
      observacoes:     draft.observacoes.trim() || undefined,
      documentos:      [],
    }

    onSave(evento)
    onClose()
  }

  // ── field helpers ──────────────────────────────────────────────────────────
  function Field({
    label, draftKey, type = 'text', required = false, placeholder = '',
  }: {
    label: string
    draftKey: keyof Draft
    type?: 'text' | 'number' | 'date' | 'time'
    required?: boolean
    placeholder?: string
  }) {
    const hasError = submitted && required && !!errors[draftKey]
    return (
      <div>
        <label className="text-xs text-app-subtle mb-0.5 block">
          {label}
          {required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
        <input
          type={type}
          value={draft[draftKey] as string}
          onChange={e => set(draftKey, e.target.value)}
          placeholder={placeholder}
          className={`w-full rounded-lg border ${
            hasError ? 'border-red-500/50 focus:border-red-500' : 'border-app-border2 focus:border-violet-500'
          } bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none`}
        />
        {hasError && <p className="text-xs text-red-400 mt-0.5">Campo obrigatório</p>}
      </div>
    )
  }

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end" onClick={onClose}>
      <div
        className="relative h-full w-full max-w-xl overflow-y-auto bg-app-bg border-l border-app-border shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-app-border bg-app-bg">
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-sm font-bold text-app-text">Novo Evento</p>
              <p className="text-xs text-app-muted mt-0.5">
                {espacoPadrao ? `Espaço: ${espacoPadrao}` : 'Preencha os dados do evento'}
              </p>
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
                className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500 transition-colors"
              >
                <Save className="h-3.5 w-3.5" />
                Salvar evento
              </button>
              <button
                onClick={onClose}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-app-subtle hover:bg-app-surface2 hover:text-app-text transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-6">

          {/* ── Informações do evento ──────────────────────────────────── */}
          <section>
            <h4 className="flex items-center gap-2 text-xs font-semibold text-app-subtle uppercase tracking-wider mb-3">
              <Calendar className="h-3.5 w-3.5" />
              Informações do Evento
            </h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">

              <div className="col-span-2">
                <Field label="Nome do Cliente" draftKey="cliente" required placeholder="Ex: João Silva" />
              </div>

              {/* Espaço */}
              <div className="col-span-2">
                <label className="text-xs text-app-subtle mb-0.5 block">
                  Espaço<span className="text-red-400 ml-0.5">*</span>
                </label>
                <select
                  value={draft.espaco}
                  onChange={e => set('espaco', e.target.value)}
                  disabled={!!espacoPadrao}
                  className={`w-full rounded-lg border ${
                    submitted && errors.espaco ? 'border-red-500/50' : 'border-app-border2'
                  } bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:border-violet-500 focus:outline-none cursor-pointer disabled:opacity-60 disabled:cursor-default`}
                >
                  <option value="">— Selecione um espaço —</option>
                  {ESPACOS.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
                {submitted && errors.espaco && (
                  <p className="text-xs text-red-400 mt-0.5">Campo obrigatório</p>
                )}
              </div>

              <Field label="Data" draftKey="data" type="date" required />

              {/* Status */}
              <div>
                <label className="text-xs text-app-subtle mb-0.5 block">Status</label>
                <select
                  value={draft.status}
                  onChange={e => set('status', e.target.value)}
                  className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:border-violet-500 focus:outline-none cursor-pointer"
                >
                  <option value="tentativo">Tentativo</option>
                  <option value="confirmado">Confirmado</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>

              <Field label="Hora início" draftKey="horaInicio" type="time" required />
              <Field label="Hora fim"    draftKey="horaFim"    type="time" required />

              <div>
                <label className="text-xs text-app-subtle mb-0.5 block">Tipo do Evento</label>
                <input
                  type="text"
                  value={draft.tipo}
                  onChange={e => set('tipo', e.target.value)}
                  placeholder="Ex: Casamento, Workshop, Show…"
                  className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:border-violet-500 focus:outline-none"
                />
              </div>

              {/* Categoria */}
              <div>
                <label className="text-xs text-app-subtle mb-0.5 block">Categoria</label>
                <select
                  value={draft.tipoEvento}
                  onChange={e => set('tipoEvento', e.target.value)}
                  className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:border-violet-500 focus:outline-none cursor-pointer"
                >
                  <option value="">— Selecione —</option>
                  <option value="Festivo">Festivo</option>
                  <option value="Corporativo">Corporativo</option>
                  <option value="Audiovisual">Audiovisual</option>
                </select>
              </div>

            </div>
          </section>

          {/* ── Capacidade e financeiro ────────────────────────────────── */}
          <section>
            <h4 className="flex items-center gap-2 text-xs font-semibold text-app-subtle uppercase tracking-wider mb-3">
              <DollarSign className="h-3.5 w-3.5" />
              Capacidade e Financeiro
            </h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Field label="Nº de Pessoas" draftKey="numeroPessoas" type="number" placeholder="0" />
              <Field label="Valor (R$)"    draftKey="valor"         type="number" required placeholder="0,00" />
              <div className="col-span-2">
                <label className="text-xs text-app-subtle mb-0.5 block">Forma de Pagamento</label>
                <select
                  value={draft.formaPagamento}
                  onChange={e => set('formaPagamento', e.target.value)}
                  className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:border-violet-500 focus:outline-none cursor-pointer"
                >
                  <option value="">— Selecione —</option>
                  {FORMAS_PAGAMENTO.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            </div>
          </section>

          {/* ── Responsável ────────────────────────────────────────────── */}
          <section>
            <h4 className="flex items-center gap-2 text-xs font-semibold text-app-subtle uppercase tracking-wider mb-3">
              <User className="h-3.5 w-3.5" />
              Responsável
            </h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Field label="Nome do Responsável" draftKey="responsavel"     placeholder="Nome completo" />
              <Field label="Telefone"            draftKey="telefoneContato" placeholder="(11) 99999-9999" />
            </div>
          </section>

          {/* ── Observações ────────────────────────────────────────────── */}
          <section>
            <h4 className="flex items-center gap-2 text-xs font-semibold text-app-subtle uppercase tracking-wider mb-3">
              <ClipboardCheck className="h-3.5 w-3.5" />
              Observações
            </h4>
            <textarea
              value={draft.observacoes}
              onChange={e => set('observacoes', e.target.value)}
              rows={3}
              placeholder="Observações gerais sobre o evento…"
              className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:border-violet-500 focus:outline-none resize-none"
            />
          </section>

          {submitted && hasErrors && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5">
              <p className="text-xs text-red-400">
                Preencha todos os campos obrigatórios antes de salvar.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
