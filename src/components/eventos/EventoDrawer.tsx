'use client'

import { useMemo, useState } from 'react'
import { X, Save, Edit3, Users, DollarSign, User, Calendar, ClipboardCheck, Paperclip, Trash2 } from 'lucide-react'
import type { Evento, StatusVistoria, TipoEvento } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useCurrentUser } from '@/contexts/UserContext'
import { useReceitas } from '@/contexts/ReceitasContext'
import FileList from '@/components/shared/FileList'
import PlanoPagamentoSection from '@/components/eventos/PlanoPagamentoSection'
import Toast from '@/components/shared/Toast'

const statusBadge: Record<string, string> = {
  confirmado:    'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  em_negociacao: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  cancelado:     'bg-red-500/10 text-red-400 border-red-500/20',
}

const statusLabel: Record<string, string> = {
  confirmado:    'Confirmado',
  em_negociacao: 'Em negociação',
  cancelado:     'Cancelado',
}

const vistoriaStyles: Record<StatusVistoria, string> = {
  'aprovada': 'text-emerald-400',
  'aprovada com ressalvas': 'text-amber-400',
  'reprovada': 'text-red-400',
  'pendente': 'text-app-muted',
  'não realizada': 'text-app-subtle',
}

const tipoEventoBadge: Record<TipoEvento, string> = {
  'Festivo': 'bg-pink-500/15 text-pink-400 border-pink-500/20',
  'Corporativo': 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  'Audiovisual': 'bg-orange-500/15 text-orange-400 border-orange-500/20',
}

type DrawerTab = 'detalhes' | 'documentos'

interface EventoDrawerProps {
  evento: Evento
  onClose: () => void
  onUpdate: (updated: Evento) => void | Promise<void>
  onDelete: (id: string) => Promise<void>
}

export default function EventoDrawer({ evento, onClose, onUpdate, onDelete }: EventoDrawerProps) {
  const { role } = useCurrentUser()
  const { receitas, syncParcelasDoEvento, updateReceita } = useReceitas()
  const [tab, setTab] = useState<DrawerTab>('detalhes')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Evento>({ ...evento })
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  function showToast(msg: string) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3500)
  }

  const parcelas = useMemo(
    () => receitas.filter(r => r.eventoId === evento.id && r.categoriaSlug === 'aluguel' && r.parcelaNumero != null),
    [receitas, evento.id],
  )

  async function handleSyncPlano(novasParcelas: Parameters<typeof syncParcelasDoEvento>[0]['parcelas']) {
    await syncParcelasDoEvento({ eventoId: evento.id, cliente: evento.cliente, espaco: evento.espaco, parcelas: novasParcelas })
  }

  async function handleBaixa(id: string, patch: { status: 'pago'; dataRecebimento: string; metodoPagamento?: string }) {
    await updateReceita(id, patch)
  }

  async function handleSave() {
    setSaving(true)
    try {
      await onUpdate(draft)
      setEditing(false)
    } catch (err) {
      showToast(err instanceof Error ? `Não foi possível salvar: ${err.message}` : 'Não foi possível salvar as alterações. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    setDraft({ ...evento })
    setEditing(false)
  }

  async function handleDelete() {
    setDeleting(true)
    await onDelete(evento.id)
    setDeleting(false)
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
              className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:border-[#25D366] focus:outline-none cursor-pointer"
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
            className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:border-[#25D366] focus:outline-none"
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
            className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:border-[#25D366] focus:outline-none resize-none"
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
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-app-border bg-app-bg">
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-sm font-bold text-app-text">{current.cliente}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-app-muted">{current.tipo} · {current.espaco}</p>
                {current.tipoEvento && (
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${tipoEventoBadge[current.tipoEvento]}`}>
                    {current.tipoEvento}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {tab === 'detalhes' && !editing && (
                <>
                  {role === 'admin' && (
                    <button
                      onClick={() => setDeleteConfirm(true)}
                      title="Excluir evento"
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-app-subtle hover:bg-red-500/10 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => setEditing(true)}
                    className="flex items-center gap-1.5 rounded-lg border border-[#25D366]/30 bg-[#25D366]/10 px-3 py-1.5 text-xs font-medium text-[#128C7E] hover:bg-[#25D366]/20 transition-colors"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    Editar
                  </button>
                </>
              )}
              {editing && (
                <>
                  <button onClick={handleCancel} disabled={saving} className="rounded-lg border border-app-border2 px-3 py-1.5 text-xs font-medium text-app-muted hover:bg-app-surface2 transition-colors disabled:opacity-60">
                    Cancelar
                  </button>
                  <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed" style={{ backgroundColor: '#25D366' }} onMouseEnter={e=>{if(!saving)(e.currentTarget as HTMLButtonElement).style.backgroundColor='#128C7E'}} onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.backgroundColor='#25D366'}}>
                    <Save className="h-3.5 w-3.5" />
                    {saving ? 'Salvando…' : 'Salvar'}
                  </button>
                </>
              )}
              <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-app-subtle hover:bg-app-surface2 hover:text-app-text transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex px-5 gap-1">
            <button
              onClick={() => setTab('detalhes')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                tab === 'detalhes' ? 'border-[#25D366] text-[#128C7E]' : 'border-transparent text-app-muted hover:text-app-text'
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              Detalhes
            </button>
            <button
              onClick={() => setTab('documentos')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                tab === 'documentos' ? 'border-[#25D366] text-[#128C7E]' : 'border-transparent text-app-muted hover:text-app-text'
              }`}
            >
              <Paperclip className="h-3.5 w-3.5" />
              Documentos
            </button>
          </div>
        </div>

        {/* Conteúdo da aba Detalhes */}
        {tab === 'detalhes' && (
          <div className="p-5 space-y-5">
            {/* Status e valor */}
            <div className="flex items-center gap-3">
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusBadge[current.status]}`}>
                {statusLabel[current.status] ?? current.status}
              </span>
              <span className="text-xl font-bold" style={{ color: '#25D366' }}>{formatCurrency(current.valor)}</span>
            </div>

            {/* Informações básicas */}
            <section>
              <h4 className="flex items-center gap-2 text-xs font-semibold text-app-subtle uppercase tracking-wider mb-3">
                <Calendar className="h-3.5 w-3.5" />
                Informações do Evento
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                {field('Data', formatDate(current.data), 'data', 'date')}
                {field('Horário', `${current.horaInicio} – ${current.horaFim}`, 'horaInicio')}
                {field('Tipo de Evento', current.tipo, 'tipo')}
                {field('Espaço', current.espaco, 'espaco')}
                <div>
                  <p className="text-xs text-app-subtle mb-0.5">Categoria</p>
                  {editing ? (
                    <select
                      value={draft.tipoEvento ?? ''}
                      onChange={(e) => setDraft((d) => ({ ...d, tipoEvento: e.target.value as TipoEvento || undefined }))}
                      className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:border-[#25D366] focus:outline-none cursor-pointer"
                    >
                      <option value="">— Selecione —</option>
                      <option value="Festivo">Festivo</option>
                      <option value="Corporativo">Corporativo</option>
                      <option value="Audiovisual">Audiovisual</option>
                    </select>
                  ) : (
                    current.tipoEvento
                      ? <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium mt-0.5 ${tipoEventoBadge[current.tipoEvento]}`}>{current.tipoEvento}</span>
                      : <p className="text-sm text-app-subtle italic mt-0.5">—</p>
                  )}
                </div>
              </div>
            </section>

            {/* Capacidade */}
            <section>
              <h4 className="flex items-center gap-2 text-xs font-semibold text-app-subtle uppercase tracking-wider mb-3">
                <Users className="h-3.5 w-3.5" />
                Capacidade e Pessoas
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
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
                      className="h-full rounded-full"
                      style={{ backgroundColor: '#25D366', width: `${Math.min(100, Math.round((current.numeroPessoas / current.capacidadeUtilizada) * 100))}%` }}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                {field('Faturamento Bruto', current.faturamentoBruto ? formatCurrency(current.faturamentoBruto) : undefined, 'faturamentoBruto', 'number')}
                {field('Faturamento Líquido', current.faturamentoLiquido ? formatCurrency(current.faturamentoLiquido) : undefined, 'faturamentoLiquido', 'number')}
                {field('Forma de Pagamento', current.formaPagamento, 'formaPagamento', 'select', ['PIX', 'Transferência', 'Dinheiro', 'Cartão de Crédito', 'Cartão de Débito', 'Cheque', 'Parcelado'])}
                {current.formaPagamento === 'Parcelado' && (
                  <>
                    {field('Valor do Sinal', current.valorSinal ? formatCurrency(current.valorSinal) : undefined, 'valorSinal', 'number')}
                    {field('Vencimento do Saldo', current.dataVencimentoSaldo ? formatDate(current.dataVencimentoSaldo) : undefined, 'dataVencimentoSaldo', 'date')}
                  </>
                )}
              </div>
            </section>

            {/* Plano de Pagamento (sinal + parcelas) */}
            {!editing && (
              <PlanoPagamentoSection
                valorEvento={evento.valor}
                parcelas={parcelas}
                podeEditarPlano={role === 'admin'}
                onSync={handleSyncPlano}
                onBaixa={handleBaixa}
              />
            )}

            {/* Responsável */}
            <section>
              <h4 className="flex items-center gap-2 text-xs font-semibold text-app-subtle uppercase tracking-wider mb-3">
                <User className="h-3.5 w-3.5" />
                Responsável pelo Evento
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                {field('Decoração', current.decoracao, 'decoracao', 'select', ['própria', 'terceirizada', 'não aplicável'])}
                <div>
                  <p className="text-xs text-app-subtle">Status da Vistoria</p>
                  {editing ? (
                    <select
                      value={draft.statusVistoria ?? ''}
                      onChange={(e) => setDraft((d) => ({ ...d, statusVistoria: e.target.value as StatusVistoria }))}
                      className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:border-[#25D366] focus:outline-none cursor-pointer mt-0.5"
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                {textArea('Observações Gerais', 'observacoes')}
                {textArea('Observações Técnicas', 'observacoesTecnicas')}
              </div>
            </section>
          </div>
        )}

        {/* Conteúdo da aba Documentos */}
        {tab === 'documentos' && (
          <div className="p-5">
            <FileList
              module="agenda"
              entityId={evento.id}
              entityName={`${evento.cliente} — ${evento.espaco}`}
              espaco={evento.espaco}
            />
          </div>
        )}
      </div>

      {/* Confirmação de exclusão */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60" onClick={(e) => e.stopPropagation()}>
          <div className="w-full max-w-sm rounded-2xl border border-app-border bg-app-surface p-6 shadow-2xl">
            <h3 className="text-base font-bold text-app-text mb-2">Excluir evento?</h3>
            <p className="text-sm text-app-muted mb-5">
              Esta ação não pode ser desfeita. Receitas já lançadas para este evento não serão apagadas.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(false)}
                disabled={deleting}
                className="rounded-lg border border-app-border2 px-4 py-2 text-sm text-app-muted hover:bg-app-surface2 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 transition-colors disabled:opacity-50"
              >
                {deleting ? 'Excluindo…' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
      <Toast message={toastMsg} />
    </div>
  )
}
