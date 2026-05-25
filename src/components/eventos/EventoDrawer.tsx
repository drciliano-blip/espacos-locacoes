'use client'

import { useState } from 'react'
import { X, Save, Edit3, Users, DollarSign, Phone, User, Calendar, ClipboardCheck } from 'lucide-react'
import type { Evento, FormaPagamento, Decoracao, StatusVistoria } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'

const statusBadge: Record<string, string> = {
  confirmado: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  tentativo: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  cancelado: 'bg-red-500/10 text-red-400 border-red-500/20',
}

const vistoriaStyles: Record<StatusVistoria, string> = {
  'aprovada': 'text-emerald-400',
  'aprovada com ressalvas': 'text-amber-400',
  'reprovada': 'text-red-400',
  'pendente': 'text-app-muted',
  'não realizada': 'text-app-subtle',
}

interface EventoDrawerProps {
  evento: Evento
  onClose: () => void
  onUpdate: (updated: Evento) => void
}

export default function EventoDrawer({ evento, onClose, onUpdate }: EventoDrawerProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Evento>({ ...evento })

  function handleSave() {
    onUpdate(draft)
    setEditing(false)
  }

  function handleCancel() {
    setDraft({ ...evento })
    setEditing(false)
  }

  const field = <T extends string | number | undefined>(
    label: string,
    value: T,
    draftKey: keyof Evento,
    type: 'text' | 'number' | 'date' | 'select' = 'text',
    options?: string[]
  ) => {
    if (editing) {
      if (type === 'select' && options) {
        return (
          <div>
            <p className="text-xs text-app-subtle mb-0.5">{label}</p>
            <select
              value={draft[draftKey] as string ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, [draftKey]: e.target.value }))}
              className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:border-violet-500 focus:outline-none cursor-pointer"
            >
              <option value="">—</option>
              {options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        )
      }
      return (
        <div>
          <p className="text-xs text-app-subtle mb-0.5">{label}</p>
          <input
            type={type}
            value={draft[draftKey] as string | number ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, [draftKey]: type === 'number' ? Number(e.target.value) || undefined : e.target.value }))}
            className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:border-violet-500 focus:outline-none"
          />
        </div>
      )
    }
    return (
      <div>
        <p className="text-xs text-app-subtle">{label}</p>
        <p className="text-sm font-medium text-app-text mt-0.5">
          {value !== undefined && value !== '' ? String(value) : <span className="text-app-subtle italic">—</span>}
        </p>
      </div>
    )
  }

  const textArea = (label: string, draftKey: keyof Evento) => {
    const val = editing ? (draft[draftKey] as string ?? '') : (evento[draftKey] as string ?? '')
    if (editing) {
      return (
        <div className="col-span-2">
          <p className="text-xs text-app-subtle mb-0.5">{label}</p>
          <textarea
            value={val}
            onChange={(e) => setDraft((d) => ({ ...d, [draftKey]: e.target.value }))}
            rows={2}
            className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:border-violet-500 focus:outline-none resize-none"
          />
        </div>
      )
    }
    return (
      <div className="col-span-2">
        <p className="text-xs text-app-subtle">{label}</p>
        <p className="text-sm text-app-text2 mt-0.5 leading-relaxed">
          {val || <span className="text-app-subtle italic">—</span>}
        </p>
      </div>
    )
  }

  const current = editing ? draft : evento

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end" onClick={onClose}>
      <div
        className="relative h-full w-full max-w-xl overflow-y-auto bg-app-bg border-l border-app-border shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-app-border bg-app-bg px-5 py-4">
          <div>
            <p className="text-sm font-bold text-app-text">{current.cliente}</p>
            <p className="text-xs text-app-muted">{current.tipo} · {current.espaco}</p>
          </div>
          <div className="flex items-center gap-2">
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-400 hover:bg-violet-500/20 transition-colors"
              >
                <Edit3 className="h-3.5 w-3.5" />
                Editar
              </button>
            ) : (
              <>
                <button
                  onClick={handleCancel}
                  className="rounded-lg border border-app-border2 px-3 py-1.5 text-xs font-medium text-app-muted hover:bg-app-surface2 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500 transition-colors"
                >
                  <Save className="h-3.5 w-3.5" />
                  Salvar
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-app-subtle hover:bg-app-surface2 hover:text-app-text transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Status e valor */}
          <div className="flex items-center gap-3">
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusBadge[current.status]}`}>
              {current.status}
            </span>
            <span className="text-xl font-bold text-violet-400">{formatCurrency(current.valor)}</span>
          </div>

          {/* Informações básicas */}
          <section>
            <h4 className="flex items-center gap-2 text-xs font-semibold text-app-subtle uppercase tracking-wider mb-3">
              <Calendar className="h-3.5 w-3.5" />
              Informações do Evento
            </h4>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {field('Data', formatDate(current.data), 'data', 'date')}
              {field('Horário', `${current.horaInicio} – ${current.horaFim}`, 'horaInicio')}
              {field('Tipo de Evento', current.tipo, 'tipo')}
              {field('Espaço', current.espaco, 'espaco')}
            </div>
          </section>

          {/* Capacidade */}
          <section>
            <h4 className="flex items-center gap-2 text-xs font-semibold text-app-subtle uppercase tracking-wider mb-3">
              <Users className="h-3.5 w-3.5" />
              Capacidade e Pessoas
            </h4>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {field('Nº de Pessoas', current.numeroPessoas, 'numeroPessoas', 'number')}
              {field('Capacidade do Espaço', current.capacidadeUtilizada, 'capacidadeUtilizada', 'number')}
            </div>
            {current.numeroPessoas && current.capacidadeUtilizada && (
              <div className="mt-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-app-subtle">Ocupação</span>
                  <span className="text-app-text2 font-medium">
                    {Math.round((current.numeroPessoas / current.capacidadeUtilizada) * 100)}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-app-surface3">
                  <div
                    className="h-full rounded-full bg-violet-500"
                    style={{ width: `${Math.min(100, Math.round((current.numeroPessoas / current.capacidadeUtilizada) * 100))}%` }}
                  />
                </div>
              </div>
            )}
          </section>

          {/* Financeiro */}
          <section>
            <h4 className="flex items-center gap-2 text-xs font-semibold text-app-subtle uppercase tracking-wider mb-3">
              <DollarSign className="h-3.5 w-3.5" />
              Financeiro
            </h4>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {field('Faturamento Bruto', current.faturamentoBruto ? formatCurrency(current.faturamentoBruto) : undefined, 'faturamentoBruto', 'number')}
              {field('Faturamento Líquido', current.faturamentoLiquido ? formatCurrency(current.faturamentoLiquido) : undefined, 'faturamentoLiquido', 'number')}
              {field('Forma de Pagamento', current.formaPagamento, 'formaPagamento', 'select', ['PIX', 'Transferência', 'Dinheiro', 'Cartão de Crédito', 'Cartão de Débito', 'Cheque'])}
              {field('Vencimento do Saldo', current.dataVencimentoSaldo ? formatDate(current.dataVencimentoSaldo) : undefined, 'dataVencimentoSaldo', 'date')}
            </div>
          </section>

          {/* Responsável */}
          <section>
            <h4 className="flex items-center gap-2 text-xs font-semibold text-app-subtle uppercase tracking-wider mb-3">
              <User className="h-3.5 w-3.5" />
              Responsável pelo Evento
            </h4>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {field('Nome do Responsável', current.responsavel, 'responsavel')}
              {field('Telefone de Contato', current.telefoneContato, 'telefoneContato')}
            </div>
          </section>

          {/* Logística */}
          <section>
            <h4 className="flex items-center gap-2 text-xs font-semibold text-app-subtle uppercase tracking-wider mb-3">
              <ClipboardCheck className="h-3.5 w-3.5" />
              Logística e Vistoria
            </h4>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {field('Decoração', current.decoracao, 'decoracao', 'select', ['própria', 'terceirizada', 'não aplicável'])}
              <div>
                <p className="text-xs text-app-subtle">Status da Vistoria</p>
                {editing ? (
                  <select
                    value={draft.statusVistoria ?? ''}
                    onChange={(e) => setDraft((d) => ({ ...d, statusVistoria: e.target.value as StatusVistoria }))}
                    className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:border-violet-500 focus:outline-none cursor-pointer mt-0.5"
                  >
                    <option value="">—</option>
                    {(['pendente', 'aprovada', 'aprovada com ressalvas', 'reprovada', 'não realizada'] as StatusVistoria[]).map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                ) : (
                  <p className={`text-sm font-medium mt-0.5 ${current.statusVistoria ? vistoriaStyles[current.statusVistoria] : 'text-app-subtle italic'}`}>
                    {current.statusVistoria ?? '—'}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Observações */}
          <section>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {textArea('Observações Gerais', 'observacoes')}
              {textArea('Observações Técnicas', 'observacoesTecnicas')}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
