'use client'

import { useState } from 'react'
import { Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import { formatCurrency, formatDate, parseCurrencyBR } from '@/lib/utils'
import FileAttachButton from '@/components/shared/FileAttachButton'
import FileList from '@/components/shared/FileList'
import { DIVISAO_SOCIOS } from '@/lib/socios-config'
import type { Receita, ParcelaPlano, BaixaReceitaInput } from '@/contexts/ReceitasContext'

const GREEN = '#25D366'
const DARK_GREEN = '#128C7E'

const statusStyles: Record<string, string> = {
  pago: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  pendente: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  atrasado: 'bg-red-500/10 text-red-400 border-red-500/20',
}
const statusLabels: Record<string, string> = { pago: 'Pago', pendente: 'Pendente', atrasado: 'Atrasado' }
const FORMAS_PAGAMENTO = ['PIX', 'Transferência', 'Dinheiro', 'Cartão de Crédito', 'Cartão de Débito', 'Cheque', 'Repasse Sócio']

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
  podeEditarPlano: boolean
  onSync: (parcelas: ParcelaPlano[]) => Promise<void>
  onBaixa: (id: string, patch: BaixaReceitaInput) => Promise<void>
  // O valor do evento segue o plano, não o contrário: desconto dado, parceria
  // renegociada etc. sempre mudam a soma das parcelas, então é o plano que
  // manda no valor "oficial" do evento, atualizado sozinho a cada "Salvar
  // plano" — nunca precisa bater com um valor travado em outro lugar.
  onValorEventoChange: (novoValor: number) => Promise<void>
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

// Formulário completo de uma parcela — sempre disponível, qualquer status.
// Nenhum campo do Plano de Pagamento fica travado só por já ter sido pago:
// se algo foi lançado errado (valor, data, comprovante), corrige aqui.
interface EditarParcelaForm {
  valor: string
  data: string
  status: Receita['status']
  dataRecebimento: string
  horaRecebimento: string
  metodoPagamento: string
  observacoes: string
  parcelaLabel: string
  socioRepasse: string
}

function formFromParcela(p: Receita): EditarParcelaForm {
  return {
    valor: String(p.valor),
    data: p.data,
    status: p.status,
    dataRecebimento: p.dataRecebimento ?? '',
    horaRecebimento: p.horaRecebimento ?? '',
    metodoPagamento: p.metodoPagamento ?? '',
    observacoes: p.observacoes ?? '',
    parcelaLabel: p.parcelaLabel ?? p.descricao,
    socioRepasse: p.socioResponsavel ?? '',
  }
}

function EditarParcelaModal({ parcela, onClose, onSalvar }: {
  parcela: Receita
  onClose: () => void
  onSalvar: (patch: BaixaReceitaInput) => Promise<void>
}) {
  const [form, setForm] = useState<EditarParcelaForm>(() => formFromParcela(parcela))
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filesVersion, setFilesVersion] = useState(0)

  function set<K extends keyof EditarParcelaForm>(k: K, v: EditarParcelaForm[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  const sociosDoEspaco = DIVISAO_SOCIOS[parcela.espaco ?? ''] ?? []

  const errors = {
    valor: !form.valor || parseCurrencyBR(form.valor) <= 0,
    data: !form.data,
    dataRecebimento: form.status === 'pago' && !form.dataRecebimento,
    socioRepasse: form.metodoPagamento === 'Repasse Sócio' && !form.socioRepasse,
  }
  const hasErrors = Object.values(errors).some(Boolean)

  async function handleSalvar() {
    setSubmitted(true)
    if (hasErrors) return
    setSaving(true)
    try {
      await onSalvar({
        status: form.status,
        valor: parseCurrencyBR(form.valor),
        data: form.data,
        dataRecebimento: form.dataRecebimento || undefined,
        horaRecebimento: form.horaRecebimento || undefined,
        metodoPagamento: form.metodoPagamento || undefined,
        observacoes: form.observacoes.trim() || undefined,
        comprovanteInstituicao: parcela.comprovanteInstituicao,
        comprovanteIdentificador: parcela.comprovanteIdentificador,
        parcelaLabel: form.parcelaLabel.trim() || undefined,
        socioRepasse: form.metodoPagamento === 'Repasse Sócio' ? form.socioRepasse : undefined,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-app-border bg-app-surface shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-app-border sticky top-0 bg-app-surface z-10">
          <p className="text-sm font-semibold text-app-text">Editar parcela</p>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-app-subtle hover:bg-app-surface2 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-app-subtle mb-0.5 block">Identificação da parcela</label>
            <input
              value={form.parcelaLabel}
              onChange={e => set('parcelaLabel', e.target.value)}
              className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-app-subtle mb-0.5 block">Valor (R$)<span className="text-red-400 ml-0.5">*</span></label>
              <input
                type="text" inputMode="decimal"
                value={form.valor}
                onChange={e => set('valor', e.target.value)}
                className={`w-full rounded-lg border ${submitted && errors.valor ? 'border-red-500/50' : 'border-app-border2'} bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none`}
              />
            </div>
            <div>
              <label className="text-xs text-app-subtle mb-0.5 block">Vencimento<span className="text-red-400 ml-0.5">*</span></label>
              <input
                type="date"
                value={form.data}
                onChange={e => set('data', e.target.value)}
                className={`w-full rounded-lg border ${submitted && errors.data ? 'border-red-500/50' : 'border-app-border2'} bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none`}
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-app-subtle mb-0.5 block">Status</label>
            <select
              value={form.status}
              onChange={e => set('status', e.target.value as Receita['status'])}
              className="w-full cursor-pointer rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none"
            >
              <option value="pendente">Pendente</option>
              <option value="pago">Pago</option>
              <option value="atrasado">Atrasado</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-app-subtle mb-0.5 block">
                Data de pagamento{form.status === 'pago' && <span className="text-red-400 ml-0.5">*</span>}
              </label>
              <input
                type="date"
                value={form.dataRecebimento}
                onChange={e => set('dataRecebimento', e.target.value)}
                className={`w-full rounded-lg border ${submitted && errors.dataRecebimento ? 'border-red-500/50' : 'border-app-border2'} bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none`}
              />
            </div>
            <div>
              <label className="text-xs text-app-subtle mb-0.5 block">Hora do pagamento</label>
              <input
                type="time"
                value={form.horaRecebimento}
                onChange={e => set('horaRecebimento', e.target.value)}
                className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-app-subtle mb-0.5 block">Forma de pagamento</label>
            <select
              value={form.metodoPagamento}
              onChange={e => set('metodoPagamento', e.target.value)}
              className="w-full cursor-pointer rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none"
            >
              <option value="">— Selecione —</option>
              {FORMAS_PAGAMENTO.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          {form.metodoPagamento === 'Repasse Sócio' && (
            <div>
              <label className="text-xs text-app-subtle mb-0.5 block">
                Sócio<span className="text-red-400 ml-0.5">*</span>
              </label>
              <select
                value={form.socioRepasse}
                onChange={e => set('socioRepasse', e.target.value)}
                className={`w-full cursor-pointer rounded-lg border ${submitted && errors.socioRepasse ? 'border-red-500/50' : 'border-app-border2'} bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none`}
              >
                <option value="">— Selecione —</option>
                {sociosDoEspaco.map(s => <option key={s.nome} value={s.nome}>{s.nome}</option>)}
              </select>
              <p className="text-xs text-app-subtle mt-1">
                Registra automaticamente um repasse pra esse sócio no valor da parcela, descontando do que ele ainda tem a receber.
              </p>
            </div>
          )}

          <div>
            <label className="text-xs text-app-subtle mb-0.5 block">Observações</label>
            <textarea
              value={form.observacoes}
              onChange={e => set('observacoes', e.target.value)}
              rows={2}
              className="w-full resize-none rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs text-app-subtle mb-1 block">Comprovante</label>
            <FileAttachButton
              module="receitas"
              entityId={parcela.id}
              entityName={form.parcelaLabel || parcela.descricao}
              espaco={parcela.espaco}
              categoria="comprovante"
              label="Anexar comprovante"
              onUploaded={() => setFilesVersion(v => v + 1)}
            />
            <div key={filesVersion} className="mt-2">
              <FileList module="receitas" entityId={parcela.id} entityName={form.parcelaLabel || parcela.descricao} compact />
            </div>
          </div>

          {submitted && hasErrors && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5">
              <p className="text-xs text-red-400">Preencha os campos obrigatórios (valor, vencimento{form.status === 'pago' ? ', data de pagamento' : ''}{form.metodoPagamento === 'Repasse Sócio' ? ', sócio' : ''}).</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-app-border">
          <button onClick={onClose} className="rounded-lg border border-app-border2 px-4 py-2 text-sm text-app-muted hover:bg-app-surface2 transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 transition-colors"
            style={{ backgroundColor: GREEN }}
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PlanoPagamentoSection({ valorEvento, parcelas, podeEditarPlano, onSync, onBaixa, onValorEventoChange }: Props) {
  const [editando, setEditando] = useState(false)
  const [draft, setDraft] = useState<DraftParcela[]>(() => toDraft(parcelas))
  const [saving, setSaving] = useState(false)
  const [parcelaEditando, setParcelaEditando] = useState<Receita | null>(null)

  const totalPlano = parcelas.reduce((s, p) => s + p.valor, 0)
  const totalPago = parcelas.filter(p => p.status === 'pago').reduce((s, p) => s + p.valor, 0)
  const totalAberto = totalPlano - totalPago

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
    const parcelasValidas = draft.filter(p => p.label.trim() && p.data && p.valor && parseCurrencyBR(p.valor) > 0)
    if (parcelasValidas.length === 0) return
    setSaving(true)
    try {
      const novoTotal = Math.round(parcelasValidas.reduce((s, p) => s + parseCurrencyBR(p.valor), 0) * 100) / 100
      await onSync(parcelasValidas.map(p => ({ numero: p.numero, label: p.label.trim(), data: p.data, valor: parseCurrencyBR(p.valor) })))
      if (novoTotal !== valorEvento) await onValorEventoChange(novoTotal)
      setEditando(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-app-border bg-app-surface p-4 space-y-3">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm font-semibold text-app-text">Plano de Pagamento</p>
        {!editando && podeEditarPlano && (
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
                <button
                  onClick={() => setParcelaEditando(p)}
                  className="flex items-center gap-1 rounded-lg border border-app-border2 px-2.5 py-1 text-xs font-medium text-app-muted hover:bg-app-surface2 transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Editar
                </button>
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
                className="w-32 shrink-0 rounded-lg border border-app-border2 bg-app-surface px-2 py-1.5 text-xs text-app-text focus:outline-none"
              />
              <input
                type="date"
                value={p.data}
                onChange={e => setCampo(p.numero, 'data', e.target.value)}
                className="rounded-lg border border-app-border2 bg-app-surface px-2 py-1.5 text-xs text-app-text focus:outline-none"
              />
              <input
                type="text" inputMode="decimal"
                value={p.valor}
                onChange={e => setCampo(p.numero, 'valor', e.target.value)}
                placeholder="0,00"
                className="w-28 rounded-lg border border-app-border2 bg-app-surface px-2 py-1.5 text-xs text-app-text focus:outline-none"
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

      {parcelaEditando && (
        <EditarParcelaModal
          parcela={parcelaEditando}
          onClose={() => setParcelaEditando(null)}
          onSalvar={patch => onBaixa(parcelaEditando.id, patch)}
        />
      )}
    </div>
  )
}
