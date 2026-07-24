'use client'

import { useRef, useState } from 'react'
import { X, Save, FileText, DollarSign, User, Paperclip, Camera, Sparkles, MessageSquareText, FileSignature, Handshake } from 'lucide-react'
import { useEspacos } from '@/contexts/EspacosContext'
import { maskCPF, maskCNPJ, parseCurrencyBR } from '@/lib/utils'
import Toast from '@/components/shared/Toast'
import GerarContratoModal from '@/components/contratos/GerarContratoModal'
import type { Contrato, Espaco, TipoMinuta } from '@/types'

interface FichaExtracao {
  nomeCompleto: string | null
  cpf: string | null
  cnpj: string | null
  pessoaJuridica: boolean
  espacoDesejado: string | null
  tipoEvento: string | null
  dataEvento: string | null
  horaInicioEvento: string | null
  horaTerminoEvento: string | null
  valorLocacao: string | null
  valorSinal: string | null
}

// Parseia valor extraído pela IA (texto livre) — usa a mesma lógica robusta de
// parseCurrencyBR, que trata corretamente "16.000" (sem vírgula) como dezesseis mil.
function parseValorBR(valor: string): string {
  const n = parseCurrencyBR(valor)
  return n > 0 ? String(n) : ''
}

function parseDataBR(data: string): string {
  const match = data.match(/(\d{2})\/(\d{2})\/(\d{4})/)
  if (!match) return ''
  const [, dd, mm, yyyy] = match
  return `${yyyy}-${mm}-${dd}`
}

function matchFromList(value: string | null, options: string[]): string | undefined {
  if (!value) return undefined
  return options.find(o => o.toLowerCase() === value.toLowerCase())
}

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
  tipoMinuta: TipoMinuta
  valorNegociado: string
  observacaoNegociacao: string
  observacaoParceria: string
}

function emptyDraft(): Draft {
  return {
    cliente: '', cpfCnpj: '', espaco: '', dataEvento: '',
    horaInicio: '', horaFim: '', tipo: '', valorTotal: '',
    valorEntrada: '', responsavel: '', observacoes: '',
    status: 'em_negociacao',
    tipoMinuta: 'locacao', valorNegociado: '', observacaoNegociacao: '', observacaoParceria: '',
  }
}

interface Props {
  onClose: () => void
  onSave: (c: Contrato) => void | Promise<void>
}

const GREEN = '#25D366'
const DARK_GREEN = '#128C7E'

function Field({
  label, value, onChange, type = 'text', required = false, placeholder = '', hasError = false,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: 'text' | 'number' | 'date' | 'time' | 'currency'
  required?: boolean
  placeholder?: string
  hasError?: boolean
}) {
  const isCurrency = type === 'currency'
  return (
    <div>
      <label className="text-xs text-app-subtle mb-0.5 block">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <input
        type={isCurrency ? 'text' : type}
        inputMode={isCurrency ? 'decimal' : undefined}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-lg border ${hasError ? 'border-red-500/50' : 'border-app-border2'} bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none`}
        onFocus={e => { e.currentTarget.style.borderColor = hasError ? '' : GREEN }}
        onBlur={e => { e.currentTarget.style.borderColor = '' }}
      />
      {hasError && <p className="text-xs text-red-400 mt-0.5">Campo obrigatório</p>}
    </div>
  )
}

export default function NovoContratoModal({ onClose, onSave }: Props) {
  const { espacosNomes } = useEspacos()
  // Gerado uma única vez — usado tanto no PDF gerado antes de salvar quanto no
  // contrato salvo de fato, pra não anexar arquivo a um id que nunca vira registro real.
  const [contratoId]            = useState(() => crypto.randomUUID())
  const [draft, setDraft]       = useState<Draft>(emptyDraft)
  const [submitted, setSubmitted] = useState(false)
  const fichaFileRef = useRef<HTMLInputElement>(null)
  const fichaCameraRef = useRef<HTMLInputElement>(null)
  const [extraindoFicha, setExtraindoFicha] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [colarTextoAberto, setColarTextoAberto] = useState(false)
  const [textoFicha, setTextoFicha] = useState('')
  const [saving, setSaving] = useState(false)
  const [gerarContratoOpen, setGerarContratoOpen] = useState(false)

  function showToast(msg: string) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3500)
  }

  async function processarFicha(body: FormData) {
    setExtraindoFicha(true)
    try {
      const res = await fetch('/api/extract-ficha', { method: 'POST', body })
      const data: FichaExtracao & { error?: string } = await res.json()

      if (!res.ok || data.error) {
        showToast(data.error ?? 'Não foi possível ler a ficha com a IA.')
        return
      }

      const algumCampo = data.nomeCompleto || data.dataEvento || data.valorLocacao
      if (!algumCampo) {
        showToast('A IA não conseguiu identificar os dados nesta ficha. Preencha os campos manualmente.')
        return
      }

      setDraft(d => ({
        ...d,
        cliente: data.nomeCompleto ?? d.cliente,
        cpfCnpj: data.pessoaJuridica
          ? (data.cnpj ? maskCNPJ(data.cnpj) : d.cpfCnpj)
          : (data.cpf ? maskCPF(data.cpf) : d.cpfCnpj),
        espaco: (matchFromList(data.espacoDesejado, espacosNomes) as Espaco) ?? d.espaco,
        dataEvento: data.dataEvento ? parseDataBR(data.dataEvento) || d.dataEvento : d.dataEvento,
        horaInicio: data.horaInicioEvento ?? d.horaInicio,
        horaFim: data.horaTerminoEvento ?? d.horaFim,
        tipo: data.tipoEvento ?? d.tipo,
        valorTotal: data.valorLocacao ? parseValorBR(data.valorLocacao) || d.valorTotal : d.valorTotal,
        valorEntrada: data.valorSinal ? parseValorBR(data.valorSinal) || d.valorEntrada : d.valorEntrada,
      }))
      showToast('Campos preenchidos automaticamente pela IA — confira antes de salvar.')
    } catch {
      showToast('Falha ao conectar com a IA. Preencha os campos manualmente.')
    } finally {
      setExtraindoFicha(false)
    }
  }

  async function handleFichaAnexo(file: File | null) {
    if (!file) return

    const ext = file.name.split('.').pop()?.toLowerCase()
    const isPdf = file.type === 'application/pdf' || ext === 'pdf'
    const isImage = file.type.startsWith('image/')

    if (file.type === 'image/heic' || file.type === 'image/heif') {
      showToast('Fotos em formato HEIC não são lidas pela IA — use o botão "Tirar foto" (gera JPEG) ou converta o arquivo antes de anexar.')
      return
    }
    if (!isPdf && !isImage) {
      showToast('A leitura automática funciona só com PDF ou imagem.')
      return
    }

    const body = new FormData()
    body.append('file', file)
    try {
      await processarFicha(body)
    } finally {
      if (fichaFileRef.current) fichaFileRef.current.value = ''
      if (fichaCameraRef.current) fichaCameraRef.current.value = ''
    }
  }

  async function handleFichaTexto() {
    if (!textoFicha.trim()) return
    const body = new FormData()
    body.append('text', textoFicha.trim())
    await processarFicha(body)
    setColarTextoAberto(false)
    setTextoFicha('')
  }

  const errors = {
    cliente:    !draft.cliente.trim(),
    espaco:     !draft.espaco,
    dataEvento: !draft.dataEvento,
    horaInicio: !draft.horaInicio,
    horaFim:    !draft.horaFim,
    valorTotal: !draft.valorTotal || parseCurrencyBR(draft.valorTotal) <= 0,
  }
  const hasErrors = Object.values(errors).some(Boolean)

  function set(k: keyof Draft, v: string) {
    setDraft(d => ({ ...d, [k]: v }))
  }

  function buildContrato(): Contrato {
    const now = new Date()
    const seq = String(now.getFullYear()).slice(2) + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0')
    return {
      id:              contratoId,
      numeroContrato:  `EL-${seq}-${String(Date.now()).slice(-4)}`,
      cliente:         draft.cliente.trim(),
      cpfCnpj:         draft.cpfCnpj.trim() || '—',
      espaco:          draft.espaco as Espaco,
      dataEvento:      draft.dataEvento,
      horaInicio:      draft.horaInicio,
      horaFim:         draft.horaFim,
      tipo:            draft.tipo.trim() || 'Evento',
      valorTotal:      parseCurrencyBR(draft.valorTotal),
      valorEntrada:    draft.valorEntrada ? parseCurrencyBR(draft.valorEntrada) : 0,
      dataAssinatura:  now.toISOString().split('T')[0],
      status:          draft.status,
      responsavel:     draft.responsavel.trim() || '—',
      observacoes:     draft.observacoes.trim(),
      tipoMinuta:      draft.tipoMinuta,
      valorNegociado:  draft.valorNegociado ? parseCurrencyBR(draft.valorNegociado) : undefined,
      observacaoNegociacao: draft.observacaoNegociacao.trim() || undefined,
      observacaoParceria:   draft.tipoMinuta === 'parceria' ? (draft.observacaoParceria.trim() || undefined) : undefined,
    }
  }

  async function handleSave() {
    setSubmitted(true)
    if (hasErrors) return

    const contrato = buildContrato()

    setSaving(true)
    try {
      await onSave(contrato)
      onClose()
    } catch (err) {
      showToast(err instanceof Error ? `Não foi possível salvar o contrato: ${err.message}` : 'Não foi possível salvar o contrato. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  function fieldProps(draftKey: keyof Draft, required = false) {
    return {
      value: draft[draftKey] as string,
      onChange: (v: string) => set(draftKey, v),
      hasError: submitted && required && !!(errors as Record<string, boolean>)[draftKey],
    }
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
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ backgroundColor: GREEN }}
              onMouseEnter={e => { if (!saving) e.currentTarget.style.backgroundColor = DARK_GREEN }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = GREEN }}
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? 'Salvando…' : 'Salvar contrato'}
            </button>
            <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-app-subtle hover:bg-app-surface2 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">

          {/* Preenchimento automático via ficha do cliente */}
          <section className="rounded-lg border border-[#25D366]/30 bg-[#25D366]/5 p-4 space-y-2">
            <p className="text-sm font-medium text-app-text">Já tem a ficha do cliente preenchida?</p>
            <p className="text-xs text-app-muted">Anexe o documento, tire uma foto ou cole o texto e a IA preenche os campos abaixo automaticamente.</p>
            <input ref={fichaFileRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={e => handleFichaAnexo(e.target.files?.[0] ?? null)} />
            <input ref={fichaCameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handleFichaAnexo(e.target.files?.[0] ?? null)} />
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <button
                onClick={() => fichaFileRef.current?.click()}
                disabled={extraindoFicha}
                className="flex items-center gap-1.5 rounded-lg border border-app-border2 bg-app-surface px-3 py-1.5 text-xs text-app-muted hover:bg-app-surface2 transition-colors disabled:opacity-60"
              >
                <Paperclip className="h-3.5 w-3.5" />
                Selecionar arquivo…
              </button>
              <button
                onClick={() => fichaCameraRef.current?.click()}
                disabled={extraindoFicha}
                className="flex items-center gap-1.5 rounded-lg border border-app-border2 bg-app-surface px-3 py-1.5 text-xs text-app-muted hover:bg-app-surface2 transition-colors disabled:opacity-60"
              >
                <Camera className="h-3.5 w-3.5" />
                Tirar foto
              </button>
              <button
                onClick={() => setColarTextoAberto(v => !v)}
                disabled={extraindoFicha}
                className="flex items-center gap-1.5 rounded-lg border border-app-border2 bg-app-surface px-3 py-1.5 text-xs text-app-muted hover:bg-app-surface2 transition-colors disabled:opacity-60"
              >
                <MessageSquareText className="h-3.5 w-3.5" />
                Colar texto (WhatsApp)
              </button>
              {extraindoFicha && (
                <span className="flex items-center gap-1.5 text-xs" style={{ color: DARK_GREEN }}>
                  <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                  Analisando com IA…
                </span>
              )}
            </div>
            {colarTextoAberto && (
              <div className="space-y-2 pt-1">
                <textarea
                  value={textoFicha}
                  onChange={e => setTextoFicha(e.target.value)}
                  rows={5}
                  placeholder="Cole aqui a conversa ou os dados do cliente…"
                  className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none resize-none"
                />
                <button
                  onClick={handleFichaTexto}
                  disabled={extraindoFicha || !textoFicha.trim()}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  style={{ backgroundColor: GREEN }}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Extrair dados do texto
                </button>
              </div>
            )}
          </section>

          {/* Cliente */}
          <section>
            <h4 className="flex items-center gap-2 text-xs font-semibold text-app-subtle uppercase tracking-wider mb-3">
              <User className="h-3.5 w-3.5" />
              Cliente
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
              <div className="col-span-2">
                <Field label="Nome do Cliente" {...fieldProps('cliente', true)} required placeholder="Ex: João Silva" />
              </div>
              <div className="col-span-2">
                <Field label="CPF / CNPJ" {...fieldProps('cpfCnpj')} placeholder="000.000.000-00" />
              </div>
            </div>
          </section>

          {/* Evento */}
          <section>
            <h4 className="flex items-center gap-2 text-xs font-semibold text-app-subtle uppercase tracking-wider mb-3">
              <FileText className="h-3.5 w-3.5" />
              Dados do Evento
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
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

              <Field label="Data do Evento" {...fieldProps('dataEvento', true)} type="date" required />

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

              <Field label="Hora início" {...fieldProps('horaInicio', true)} type="time" required />
              <Field label="Hora fim"    {...fieldProps('horaFim', true)}    type="time" required />

              <div className="col-span-2">
                <Field label="Tipo de Evento" {...fieldProps('tipo')} placeholder="Ex: Casamento, Workshop, Show…" />
              </div>
            </div>
          </section>

          {/* Financeiro */}
          <section>
            <h4 className="flex items-center gap-2 text-xs font-semibold text-app-subtle uppercase tracking-wider mb-3">
              <DollarSign className="h-3.5 w-3.5" />
              Financeiro
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
              <Field label="Valor Total (R$)"  {...fieldProps('valorTotal', true)}   type="currency" required placeholder="0,00" />
              <Field label="Entrada (R$)"       {...fieldProps('valorEntrada')} type="currency" placeholder="0,00" />
              <div className="col-span-2">
                <Field label="Responsável" {...fieldProps('responsavel')} placeholder="Nome do funcionário responsável" />
              </div>
            </div>
          </section>

          {/* Minuta / Negociação */}
          <section>
            <h4 className="flex items-center gap-2 text-xs font-semibold text-app-subtle uppercase tracking-wider mb-3">
              <Handshake className="h-3.5 w-3.5" />
              Minuta e Negociação
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
              <div>
                <label className="text-xs text-app-subtle mb-0.5 block">Tipo de minuta</label>
                <select
                  value={draft.tipoMinuta}
                  onChange={e => set('tipoMinuta', e.target.value)}
                  className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none cursor-pointer"
                  onFocus={e => { e.currentTarget.style.borderColor = GREEN }}
                  onBlur={e => { e.currentTarget.style.borderColor = '' }}
                >
                  <option value="locacao">Locação (valor fixo)</option>
                  <option value="parceria">Parceria (% sobre faturamento)</option>
                </select>
              </div>
              <Field label="Valor negociado (R$)" {...fieldProps('valorNegociado')} type="currency" placeholder="0,00" />
              <div className="col-span-2">
                <label className="text-xs text-app-subtle mb-0.5 block">Observação sobre a negociação</label>
                <textarea
                  value={draft.observacaoNegociacao}
                  onChange={e => set('observacaoNegociacao', e.target.value)}
                  rows={2}
                  placeholder="Ex: desconto combinado, condições específicas do acordo…"
                  className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none resize-none"
                  onFocus={e => { e.currentTarget.style.borderColor = GREEN }}
                  onBlur={e => { e.currentTarget.style.borderColor = '' }}
                />
              </div>
              {draft.tipoMinuta === 'parceria' && (
                <div className="col-span-2">
                  <label className="text-xs text-app-subtle mb-0.5 block">Observação sobre a parceria</label>
                  <textarea
                    value={draft.observacaoParceria}
                    onChange={e => set('observacaoParceria', e.target.value)}
                    rows={2}
                    placeholder="Descreva a parceria: com quem, o que cada lado cede…"
                    className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none resize-none"
                    onFocus={e => { e.currentTarget.style.borderColor = GREEN }}
                    onBlur={e => { e.currentTarget.style.borderColor = '' }}
                  />
                </div>
              )}
            </div>
            <button
              onClick={() => setGerarContratoOpen(true)}
              disabled={!draft.cliente.trim() || !draft.espaco || !draft.dataEvento}
              className="mt-3 flex items-center gap-1.5 rounded-lg border border-[#25D366]/30 bg-[#25D366]/10 px-3 py-1.5 text-xs font-medium text-[#128C7E] hover:bg-[#25D366]/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FileSignature className="h-3.5 w-3.5" />
              Gerar contrato com estes dados
            </button>
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
      <Toast message={toastMsg} />
      {gerarContratoOpen && (
        <GerarContratoModal
          origem={{ tipo: 'contrato', dados: buildContrato() }}
          onClose={() => setGerarContratoOpen(false)}
        />
      )}
    </div>
  )
}
