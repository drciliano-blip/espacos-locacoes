'use client'

import { useMemo, useState } from 'react'
import { X, Save, Edit3, Users, DollarSign, User, Calendar, ClipboardCheck, Paperclip, Trash2, FileSignature, Ban, RotateCcw, CheckCircle2 } from 'lucide-react'
import type { Evento, StatusVistoria, TipoEvento, Contrato, TipoMinuta } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useCurrentUser } from '@/contexts/UserContext'
import { useReceitas, type BaixaReceitaInput } from '@/contexts/ReceitasContext'
import { useRepasses } from '@/contexts/RepassesContext'
import { useContasPagar } from '@/contexts/ContasPagarContext'
import { useContratos } from '@/contexts/ContratosContext'
import { aplicarBaixaComRepasseAutomatico } from '@/lib/repasse-socio'
import FileList from '@/components/shared/FileList'
import FileAttachButton from '@/components/shared/FileAttachButton'
import PlanoPagamentoSection from '@/components/eventos/PlanoPagamentoSection'
import GerarContratoDoEventoModal from '@/components/eventos/GerarContratoDoEventoModal'
import GerarContratoModal from '@/components/contratos/GerarContratoModal'
import CancelarEventoModal from '@/components/eventos/CancelarEventoModal'
import NovoEventoModal from '@/components/eventos/NovoEventoModal'
import { useEventos } from '@/contexts/EventosContext'
import Toast from '@/components/shared/Toast'

const statusBadge: Record<string, string> = {
  confirmado: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  cancelado:  'bg-red-500/10 text-red-400 border-red-500/20',
}

const statusLabel: Record<string, string> = {
  confirmado: 'Confirmado',
  cancelado:  'Cancelado',
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
  'Locação Portaria': 'bg-slate-500/15 text-slate-400 border-slate-500/20',
}

const TIPOS_CONTRATO: { value: TipoMinuta; label: string }[] = [
  { value: 'locacao', label: 'Locação' },
  { value: 'parceria', label: 'Parceria' },
]
const tipoContratoLabel: Record<TipoMinuta, string> = {
  locacao: 'Locação',
  parceria: 'Parceria',
}

type DrawerTab = 'detalhes' | 'documentos'

interface EventoDrawerProps {
  evento: Evento
  onClose: () => void
  onUpdate: (updated: Evento) => void | Promise<void>
  onDelete: (id: string, motivo: string) => Promise<void>
}

export default function EventoDrawer({ evento, onClose, onUpdate, onDelete }: EventoDrawerProps) {
  const { role } = useCurrentUser()
  const { confirmarPreEvento, solicitarExclusao, recusarExclusao } = useEventos()
  const exclusaoPendente = !!evento.exclusaoSolicitadaEm
  // Pedido de exclusão (quem não é admin): sai da Agenda, admin decide depois.
  const [pedirExclusaoOpen, setPedirExclusaoOpen] = useState(false)
  const [motivoPedido, setMotivoPedido] = useState('')
  const [enviandoPedido, setEnviandoPedido] = useState(false)
  const [erroPedido, setErroPedido] = useState<string | null>(null)

  async function handlePedirExclusao() {
    if (!motivoPedido.trim()) { setErroPedido('Informe o motivo.'); return }
    setEnviandoPedido(true)
    setErroPedido(null)
    try {
      await solicitarExclusao(evento.id, motivoPedido.trim())
      setPedirExclusaoOpen(false)
      onClose()
    } catch (err) {
      setErroPedido(err instanceof Error ? err.message : 'Não foi possível excluir da agenda.')
    } finally {
      setEnviandoPedido(false)
    }
  }

  async function handleRecusarExclusao() {
    try {
      await recusarExclusao(evento.id)
      onClose()
    } catch (err) {
      showToast(err instanceof Error ? `Não foi possível recusar: ${err.message}` : 'Não foi possível recusar a exclusão.')
    }
  }
  const ehPreEvento = evento.status === 'em_negociacao'
  const [confirmarPreOpen, setConfirmarPreOpen] = useState(false)
  // Depois de confirmado, os dados deste drawer (prop `evento`) ficam velhos —
  // fecha o drawer junto com o formulário.
  const [preConfirmado, setPreConfirmado] = useState(false)
  const { receitas, syncParcelasDoEvento, updateReceita, recarregar: recarregarReceitas } = useReceitas()
  const { repasses, addRepasse } = useRepasses()
  const { addConta, recarregar: recarregarContas } = useContasPagar()
  const { contratos, addContrato, recarregar: recarregarContratos } = useContratos()
  const [tab, setTab] = useState<DrawerTab>('detalhes')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Evento>({ ...evento })
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [motivoExclusao, setMotivoExclusao] = useState('')
  const [motivoErro, setMotivoErro] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [cancelConfirm, setCancelConfirm] = useState(false)
  const [cancelarEventoOpen, setCancelarEventoOpen] = useState(false)
  const [togglingStatus, setTogglingStatus] = useState(false)
  const [trocaTipoContratoPendente, setTrocaTipoContratoPendente] = useState<TipoMinuta | null>(null)
  const [saving, setSaving] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [gerarContratoDoEventoOpen, setGerarContratoDoEventoOpen] = useState(false)
  const [contratoParaGerar, setContratoParaGerar] = useState<Contrato | null>(null)

  const contratoExistente = contratos.find(c => c.eventoId === evento.id)

  function showToast(msg: string) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3500)
  }

  const parcelas = useMemo(
    () => receitas.filter(r => r.eventoId === evento.id && r.categoriaSlug === 'aluguel' && r.parcelaNumero != null),
    [receitas, evento.id],
  )

  const totalRecebidoEvento = useMemo(
    () => receitas.filter(r => r.eventoId === evento.id && r.status === 'pago').reduce((s, r) => s + r.valor, 0),
    [receitas, evento.id],
  )

  // Exclusão de verdade: some com o evento e tudo que foi gerado a partir
  // dele (receitas e eventuais saídas de reembolso) — nunca fica só
  // "Cancelado". Usado tanto pelo ícone de lixeira quanto pela opção
  // "Excluir definitivamente" do fluxo de cancelamento.
  // Tudo sai de uma vez no banco (função excluir_evento, só admin, com
  // auditoria); depois relê receitas/contas/contratos que saíram junto.
  async function excluirEventoEDependencias(motivo: string) {
    await onDelete(evento.id, motivo)
    await Promise.all([recarregarReceitas(), recarregarContas(), recarregarContratos()])
  }

  async function handleCancelarMantendoReceita() {
    await onUpdate({ ...evento, status: 'cancelado' })
    setCancelarEventoOpen(false)
  }

  async function handleCancelarComReembolso(valor: number) {
    await addConta({
      id: crypto.randomUUID(),
      descricao: `Reembolso — ${evento.cliente} (${formatDate(evento.data)})`,
      espaco: evento.espaco,
      categoria: 'reembolso_evento',
      subcategoria: 'outros',
      valor,
      status: 'pago',
      dataVencimento: new Date().toISOString().split('T')[0],
      dataPagamento: new Date().toISOString().split('T')[0],
      fornecedor: evento.cliente,
      eventoId: evento.id,
      origem: 'automatico',
    })
    await onUpdate({ ...evento, status: 'cancelado' })
    setCancelarEventoOpen(false)
    showToast('Reembolso registrado e evento cancelado.')
  }

  async function handleExcluirDefinitivoViaModal(motivo: string) {
    await excluirEventoEDependencias(motivo)
    setCancelarEventoOpen(false)
  }

  async function handleSyncPlano(novasParcelas: Parameters<typeof syncParcelasDoEvento>[0]['parcelas']) {
    await syncParcelasDoEvento({ eventoId: evento.id, cliente: evento.cliente, espaco: evento.espaco, parcelas: novasParcelas })
  }

  async function handleBaixa(id: string, patch: BaixaReceitaInput) {
    const parcela = receitas.find(r => r.id === id)
    if (!parcela) return
    await aplicarBaixaComRepasseAutomatico(parcela, patch, updateReceita, addRepasse, repasses)
  }

  // O valor do evento segue o plano de pagamento (ver PlanoPagamentoSection) —
  // desconto dado, parceria renegociada etc. atualizam o valor "oficial"
  // sozinhos, sem precisar editar os dois lugares separadamente.
  async function handleValorEventoChange(novoValor: number) {
    await onUpdate({ ...evento, valor: novoValor })
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
    if (!motivoExclusao.trim()) { setMotivoErro(true); return }
    setDeleting(true)
    try {
      await excluirEventoEDependencias(motivoExclusao.trim())
    } catch (err) {
      showToast(err instanceof Error ? `Não foi possível excluir: ${err.message}` : 'Não foi possível excluir o evento. Tente novamente.')
    } finally {
      setDeleting(false)
    }
  }

  // Só reativação passa por aqui agora — cancelar tem o fluxo próprio de 3
  // opções (CancelarEventoModal), que decide se mantém a receita, gera
  // reembolso ou exclui tudo.
  async function handleReativar() {
    setTogglingStatus(true)
    try {
      await onUpdate({ ...evento, status: 'confirmado' })
      setCancelConfirm(false)
    } catch (err) {
      showToast(err instanceof Error ? `Não foi possível atualizar o status: ${err.message}` : 'Não foi possível atualizar o status. Tente novamente.')
    } finally {
      setTogglingStatus(false)
    }
  }

  // Trocar o tipo do evento troca automaticamente o modelo de contrato vinculado.
  // Se já existe um contrato gerado, confirma antes — o contrato já gerado não é alterado
  // retroativamente, só a próxima geração passa a usar o novo modelo.
  function handleTipoContratoChange(novoTipo: TipoMinuta) {
    if (contratoExistente && novoTipo !== evento.tipoContrato) {
      setTrocaTipoContratoPendente(novoTipo)
    } else {
      setDraft(d => ({ ...d, tipoContrato: novoTipo }))
    }
  }

  function confirmarTrocaTipoContrato() {
    if (trocaTipoContratoPendente) {
      setDraft(d => ({ ...d, tipoContrato: trocaTipoContratoPendente }))
    }
    setTrocaTipoContratoPendente(null)
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
                  {role !== 'admin' && role !== 'socio' && !exclusaoPendente && (
                    <button
                      onClick={() => { setMotivoPedido(''); setErroPedido(null); setPedirExclusaoOpen(true) }}
                      title="Tira da Agenda e libera a data; um administrador confirma a exclusão definitiva"
                      className="flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Excluir da agenda
                    </button>
                  )}
                  {role === 'admin' && (
                    <button
                      onClick={() => { setMotivoExclusao(''); setMotivoErro(false); setDeleteConfirm(true) }}
                      title="Excluir definitivamente (só administrador)"
                      className="flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Excluir definitivamente
                    </button>
                  )}
                  {role !== 'socio' && (
                    <>
                      {ehPreEvento ? (
                        <button
                          onClick={() => setConfirmarPreOpen(true)}
                          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors"
                          style={{ backgroundColor: '#25D366' }}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Confirmar evento
                        </button>
                      ) : (
                      <button
                        onClick={() => contratoExistente ? setContratoParaGerar(contratoExistente) : setGerarContratoDoEventoOpen(true)}
                        className="flex items-center gap-1.5 rounded-lg border border-app-border2 px-3 py-1.5 text-xs font-medium text-app-muted hover:bg-app-surface2 transition-colors"
                      >
                        <FileSignature className="h-3.5 w-3.5" />
                        {contratoExistente ? 'Gerar documento do contrato' : 'Gerar Contrato'}
                      </button>
                      )}
                      {ehPreEvento ? null : evento.status === 'confirmado' ? (
                        <button
                          onClick={() => setCancelarEventoOpen(true)}
                          className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors"
                        >
                          <Ban className="h-3.5 w-3.5" />
                          Cancelar evento
                        </button>
                      ) : (
                        <button
                          onClick={() => setCancelConfirm(true)}
                          className="flex items-center gap-1.5 rounded-lg border border-app-border2 px-3 py-1.5 text-xs font-medium text-app-muted hover:bg-app-surface2 transition-colors"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Reativar evento
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
            {exclusaoPendente && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 space-y-2">
                <p className="text-sm font-semibold text-red-500">Exclusão solicitada — fora da Agenda, data liberada</p>
                <p className="text-xs text-app-text">
                  Pedido em {new Date(evento.exclusaoSolicitadaEm!).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                  {evento.exclusaoMotivo ? <> · Motivo: <span className="font-medium">{evento.exclusaoMotivo}</span></> : null}
                </p>
                <p className="text-xs text-app-subtle">O evento e o faturamento continuam no sistema até um administrador aprovar ou recusar.</p>
                {role === 'admin' && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      onClick={() => { setMotivoExclusao(`Aprovado: ${evento.exclusaoMotivo ?? ''}`.trim()); setMotivoErro(false); setDeleteConfirm(true) }}
                      className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Aprovar e excluir definitivamente
                    </button>
                    <button
                      onClick={handleRecusarExclusao}
                      className="flex items-center gap-1.5 rounded-lg border border-app-border2 px-3 py-1.5 text-xs font-medium text-app-text hover:bg-app-surface2 transition-colors"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Recusar — voltar para a Agenda
                    </button>
                  </div>
                )}
              </div>
            )}
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
                      <option value="Locação Portaria">Locação Portaria</option>
                    </select>
                  ) : (
                    current.tipoEvento
                      ? <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium mt-0.5 ${tipoEventoBadge[current.tipoEvento]}`}>{current.tipoEvento}</span>
                      : <p className="text-sm text-app-subtle italic mt-0.5">—</p>
                  )}
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-app-subtle mb-0.5">Tipo do evento (contrato)</p>
                  {editing ? (
                    <select
                      value={draft.tipoContrato ?? ''}
                      onChange={(e) => handleTipoContratoChange(e.target.value as TipoMinuta)}
                      className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:border-[#25D366] focus:outline-none cursor-pointer"
                    >
                      <option value="">— Selecione —</option>
                      {TIPOS_CONTRATO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  ) : current.tipoContrato ? (
                    <p className="text-sm font-medium text-app-text mt-0.5">
                      {tipoContratoLabel[current.tipoContrato]}
                      <span className="text-app-subtle font-normal"> — Modelo vinculado: Contrato de {tipoContratoLabel[current.tipoContrato]}</span>
                    </p>
                  ) : (
                    <p className="text-sm text-app-subtle italic mt-0.5">—</p>
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
                {current.tipoContrato === 'parceria' ? (
                  <>
                    {field('Valor Envolvido', current.valor ? formatCurrency(current.valor) : undefined, 'valor', 'number')}
                    {textArea('Condições da Parceria', 'condicoesParceria')}
                  </>
                ) : (
                  <>
                    {field('Forma de Pagamento', current.formaPagamento, 'formaPagamento', 'select', ['PIX', 'Transferência', 'Dinheiro', 'Cartão de Crédito', 'Cartão de Débito', 'Cheque', 'Parcelado'])}
                    {current.formaPagamento === 'Parcelado' && (
                      <>
                        {field('Valor do Sinal', current.valorSinal ? formatCurrency(current.valorSinal) : undefined, 'valorSinal', 'number')}
                        {field('Vencimento do Saldo', current.dataVencimentoSaldo ? formatDate(current.dataVencimentoSaldo) : undefined, 'dataVencimentoSaldo', 'date')}
                      </>
                    )}
                  </>
                )}
              </div>
            </section>

            {/* Plano de Pagamento (sinal + parcelas) — também vale pra eventos de
                Parceria, sobre o "Valor Envolvido" (estimado), pra dar baixa nos
                pagamentos igual à Locação; Condições da Parceria continua sendo o
                texto livre com as regras do acordo, isso aqui é só o financeiro. */}
            {!editing && (
              <PlanoPagamentoSection
                valorEvento={evento.valor}
                parcelas={parcelas}
                podeEditarPlano={role === 'admin'}
                onSync={handleSyncPlano}
                onBaixa={handleBaixa}
                onValorEventoChange={handleValorEventoChange}
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
          <div className="p-5 space-y-3">
            <div className="flex flex-wrap gap-2">
              <FileAttachButton module="agenda" entityId={evento.id} entityName={`${evento.cliente} — ${evento.espaco}`} espaco={evento.espaco} categoria="contrato" label="Anexar contrato" permiteColarTexto />
              <FileAttachButton module="agenda" entityId={evento.id} entityName={`${evento.cliente} — ${evento.espaco}`} espaco={evento.espaco} categoria="comprovante_sinal" label="Anexar comprovante do sinal" />
              <FileAttachButton module="agenda" entityId={evento.id} entityName={`${evento.cliente} — ${evento.espaco}`} espaco={evento.espaco} categoria="documento_identidade" label="Anexar CNH/RG de quem assina" />
            </div>
            <FileList
              module="agenda"
              entityId={evento.id}
              entityName={`${evento.cliente} — ${evento.espaco}`}
              espaco={evento.espaco}
              showAttach={false}
            />
          </div>
        )}
      </div>

      {/* Confirmação de exclusão */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60" onClick={(e) => e.stopPropagation()}>
          <div className="w-full max-w-sm rounded-2xl border border-app-border bg-app-surface p-6 shadow-2xl">
            <h3 className="text-base font-bold text-app-text mb-2">Excluir evento definitivamente?</h3>
            <p className="text-sm text-app-muted mb-3">
              Esta ação não pode ser desfeita. O evento, as receitas, reembolsos e contratos vinculados a ele serão excluídos — não fica só como "Cancelado".
            </p>
            {totalRecebidoEvento > 0 && (
              <p className="text-xs text-amber-600 mb-3">Atenção: este evento tem {formatCurrency(totalRecebidoEvento)} já recebidos — esse valor sai do Financeiro.</p>
            )}
            <label className="text-xs text-app-subtle mb-0.5 block">Motivo da exclusão<span className="text-red-400 ml-0.5">*</span></label>
            <textarea value={motivoExclusao} onChange={e => { setMotivoExclusao(e.target.value); setMotivoErro(false) }} rows={2}
              placeholder="Ex.: cliente desistiu, data liberada para venda"
              className={`w-full rounded-lg border ${motivoErro ? 'border-red-500/50' : 'border-app-border2'} bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none`} />
            <p className="text-[11px] text-app-subtle mt-0.5 mb-5">Fica gravado com seu usuário, data e uma cópia do evento e dos lançamentos — o registro não pode ser apagado.</p>
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

      {/* Confirmação de reativação — cancelar tem o fluxo próprio (CancelarEventoModal) */}
      {pedirExclusaoOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={() => setPedirExclusaoOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-app-border bg-app-surface p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-app-text mb-2">Excluir da agenda?</h3>
            <p className="text-sm text-app-muted mb-3">
              O evento sai da Agenda agora e a data fica livre para venda. A exclusão definitiva (e do faturamento) fica pendente até um administrador aprovar.
            </p>
            <label className="text-xs text-app-subtle mb-0.5 block">Motivo<span className="text-red-400 ml-0.5">*</span></label>
            <textarea value={motivoPedido} onChange={e => setMotivoPedido(e.target.value)} rows={2} placeholder="Ex.: cliente desistiu"
              className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none" />
            {erroPedido && <p className="text-xs text-red-400 mt-1">{erroPedido}</p>}
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setPedirExclusaoOpen(false)} disabled={enviandoPedido}
                className="rounded-lg border border-app-border2 px-4 py-2 text-sm text-app-muted hover:bg-app-surface2 transition-colors disabled:opacity-50">Voltar</button>
              <button onClick={handlePedirExclusao} disabled={enviandoPedido}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 transition-colors disabled:opacity-50">
                {enviandoPedido ? 'Enviando…' : 'Excluir da agenda'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmarPreOpen && (
        <NovoEventoModal
          preEvento={evento}
          onSave={async ev => { await confirmarPreEvento(ev); setPreConfirmado(true) }}
          onClose={() => { setConfirmarPreOpen(false); if (preConfirmado) onClose() }}
        />
      )}

      {cancelConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60" onClick={(e) => e.stopPropagation()}>
          <div className="w-full max-w-sm rounded-2xl border border-app-border bg-app-surface p-6 shadow-2xl">
            <h3 className="text-base font-bold text-app-text mb-2">Reativar evento?</h3>
            <p className="text-sm text-app-muted mb-5">O status volta para Confirmado.</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setCancelConfirm(false)}
                disabled={togglingStatus}
                className="rounded-lg border border-app-border2 px-4 py-2 text-sm text-app-muted hover:bg-app-surface2 transition-colors disabled:opacity-50"
              >
                Voltar
              </button>
              <button
                onClick={handleReativar}
                disabled={togglingStatus}
                className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50 bg-[#25D366] hover:bg-[#128C7E]"
              >
                {togglingStatus ? 'Aguarde…' : 'Reativar evento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmação de troca de modelo de contrato (só quando já existe contrato gerado) */}
      {trocaTipoContratoPendente && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60" onClick={(e) => e.stopPropagation()}>
          <div className="w-full max-w-sm rounded-2xl border border-app-border bg-app-surface p-6 shadow-2xl">
            <h3 className="text-base font-bold text-app-text mb-2">Trocar modelo de contrato?</h3>
            <p className="text-sm text-app-muted mb-5">
              Este evento já tem um contrato gerado ({evento.tipoContrato ? tipoContratoLabel[evento.tipoContrato] : '—'}). Ao trocar para <strong>{tipoContratoLabel[trocaTipoContratoPendente]}</strong>, a próxima geração de contrato vai usar o novo modelo — o contrato já gerado não é alterado automaticamente.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setTrocaTipoContratoPendente(null)}
                className="rounded-lg border border-app-border2 px-4 py-2 text-sm text-app-muted hover:bg-app-surface2 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarTrocaTipoContrato}
                className="rounded-lg bg-[#25D366] px-4 py-2 text-sm font-medium text-white hover:bg-[#128C7E] transition-colors"
              >
                Confirmar troca
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelarEventoOpen && (
        <CancelarEventoModal
          evento={evento}
          totalRecebido={totalRecebidoEvento}
          onClose={() => setCancelarEventoOpen(false)}
          onManterReceita={handleCancelarMantendoReceita}
          onReembolso={handleCancelarComReembolso}
          podeExcluir={role === 'admin'}
          onExcluir={handleExcluirDefinitivoViaModal}
        />
      )}

      {gerarContratoDoEventoOpen && (
        <GerarContratoDoEventoModal
          evento={evento}
          onClose={() => setGerarContratoDoEventoOpen(false)}
          onSave={addContrato}
          onCreated={(contrato) => {
            setGerarContratoDoEventoOpen(false)
            setContratoParaGerar(contrato)
            showToast('Contrato criado — gerando o documento…')
          }}
        />
      )}

      {contratoParaGerar && (
        <GerarContratoModal
          origem={{ tipo: 'contrato', dados: contratoParaGerar, eventoOrigem: evento }}
          onClose={() => setContratoParaGerar(null)}
        />
      )}

      <Toast message={toastMsg} />
    </div>
  )
}
