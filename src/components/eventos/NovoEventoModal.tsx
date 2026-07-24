'use client'

import { useRef, useState } from 'react'
import { X, Save, Calendar, DollarSign, User, ClipboardCheck, Paperclip, Camera, Sparkles, Plus, Trash2, MessageSquareText } from 'lucide-react'
import type { Evento, Espaco, TipoEvento, FormaPagamento } from '@/types'
import FileAttachButton from '@/components/shared/FileAttachButton'
import FileList from '@/components/shared/FileList'
import Toast from '@/components/shared/Toast'
import { useEspacos } from '@/contexts/EspacosContext'
import { useReceitas } from '@/contexts/ReceitasContext'
import { parseCurrencyBR } from '@/lib/utils'

const FORMAS_PAGAMENTO: FormaPagamento[] = [
  'PIX',
  'Transferência',
  'Dinheiro',
  'Cartão de Crédito',
  'Cartão de Débito',
  'Cheque',
  'Parcelado',
]

interface FichaExtracao {
  nomeCompleto: string | null
  telefoneCelular: string | null
  dataEvento: string | null
  espacoDesejado: string | null
  tipoEvento: string | null
  horaInicioEvento: string | null
  horaTerminoEvento: string | null
  valorLocacao: string | null
  formaPagamento: string | null
  valorSinal: string | null
  dataVencimentoSaldo: string | null
}

function parseValorBR(valor: string): string {
  const numeric = valor.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3},)/g, '').replace(',', '.')
  const n = parseFloat(numeric)
  return Number.isFinite(n) ? String(n) : ''
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

// O erro do Supabase (PostgrestError) não é uma instância de Error do JS — só tem
// um campo .message. Sem isso, err instanceof Error falha e a mensagem real some.
function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message)
  return 'Erro desconhecido.'
}

interface ParcelaDraft {
  numero: number
  label: string
  data: string
  valor: string
}

function gerarParcelasPadrao(dataEvento: string, valorTotal: number, valorSinal: string, dataVencimentoSaldo: string): ParcelaDraft[] {
  const hoje = new Date().toISOString().split('T')[0]
  const sinal = valorSinal ? parseCurrencyBR(valorSinal) : Math.round((valorTotal / 2) * 100) / 100
  const saldo = Math.round((valorTotal - sinal) * 100) / 100

  let dataSaldo = dataVencimentoSaldo
  if (!dataSaldo && dataEvento) {
    const [y, m, d] = dataEvento.split('-').map(Number)
    const dt = new Date(y, (m ?? 1) - 1, d ?? 1)
    dt.setDate(dt.getDate() - 8)
    dataSaldo = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
  }

  return [
    { numero: 1, label: 'Sinal', data: hoje, valor: String(sinal) },
    { numero: 2, label: 'Saldo', data: dataSaldo, valor: String(saldo) },
  ]
}

interface Draft {
  cliente: string
  espaco: Espaco | ''
  data: string
  horaInicio: string
  horaFim: string
  tipo: string
  tipoEvento: TipoEvento | ''
  status: 'confirmado' | 'em_negociacao' | 'cancelado'
  valor: string
  numeroPessoas: string
  responsavel: string
  telefoneContato: string
  formaPagamento: FormaPagamento | ''
  valorSinal: string
  dataVencimentoSaldo: string
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
    status: 'em_negociacao',
    valor: '',
    numeroPessoas: '',
    responsavel: '',
    telefoneContato: '',
    formaPagamento: '',
    valorSinal: '',
    dataVencimentoSaldo: '',
    observacoes: '',
  }
}

interface NovoEventoModalProps {
  espacoPadrao?: Espaco
  onClose: () => void
  onSave: (evento: Evento) => void | Promise<void>
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
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <input
        type={isCurrency ? 'text' : type}
        inputMode={isCurrency ? 'decimal' : undefined}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-lg border ${
          hasError ? 'border-red-500/50' : 'border-app-border2'
        } bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none`}
        onFocus={e => { e.currentTarget.style.borderColor = hasError ? '' : GREEN }}
        onBlur={e => { e.currentTarget.style.borderColor = '' }}
      />
      {hasError && <p className="text-xs text-red-400 mt-0.5">Campo obrigatório</p>}
    </div>
  )
}

export default function NovoEventoModal({ espacoPadrao, onClose, onSave }: NovoEventoModalProps) {
  const { espacosNomes } = useEspacos()
  const { syncParcelasDoEvento } = useReceitas()
  const [draft, setDraft]         = useState<Draft>(() => emptyDraft(espacoPadrao))
  const [submitted, setSubmitted] = useState(false)
  const [parcelas, setParcelas]   = useState<ParcelaDraft[] | null>(null)
  // Generate stable ID upfront so file attachments are linked before save
  // (precisa ser um UUID real: vira o id definitivo do evento no Postgres)
  const [eventId]                 = useState(() => crypto.randomUUID())
  const [fileCount, setFileCount] = useState(0)
  const fichaFileRef = useRef<HTMLInputElement>(null)
  const fichaCameraRef = useRef<HTMLInputElement>(null)
  const [extraindoFicha, setExtraindoFicha] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [colarTextoAberto, setColarTextoAberto] = useState(false)
  const [textoFicha, setTextoFicha] = useState('')

  const errors: Partial<Record<keyof Draft, boolean>> = {
    cliente:    !draft.cliente.trim(),
    espaco:     !draft.espaco,
    data:       !draft.data,
    horaInicio: !draft.horaInicio,
    horaFim:    !draft.horaFim,
    valor:      !draft.valor || parseCurrencyBR(draft.valor) <= 0,
  }

  const hasErrors = Object.values(errors).some(Boolean)

  function set(key: keyof Draft, value: string) {
    setDraft(d => ({ ...d, [key]: value }))
  }

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

      let novoDraft: Draft = draft
      setDraft(d => {
        novoDraft = {
          ...d,
          cliente: data.nomeCompleto ?? d.cliente,
          telefoneContato: data.telefoneCelular ?? d.telefoneContato,
          data: data.dataEvento ? parseDataBR(data.dataEvento) || d.data : d.data,
          espaco: (!espacoPadrao ? matchFromList(data.espacoDesejado, espacosNomes) as Espaco : undefined) ?? d.espaco,
          tipo: data.tipoEvento ?? d.tipo,
          horaInicio: data.horaInicioEvento ?? d.horaInicio,
          horaFim: data.horaTerminoEvento ?? d.horaFim,
          valor: data.valorLocacao ? parseValorBR(data.valorLocacao) || d.valor : d.valor,
          formaPagamento: (matchFromList(data.formaPagamento, FORMAS_PAGAMENTO) as FormaPagamento) ?? d.formaPagamento,
          valorSinal: data.valorSinal ? parseValorBR(data.valorSinal) || d.valorSinal : d.valorSinal,
          dataVencimentoSaldo: data.dataVencimentoSaldo ? parseDataBR(data.dataVencimentoSaldo) || d.dataVencimentoSaldo : d.dataVencimentoSaldo,
        }
        return novoDraft
      })
      if (novoDraft.formaPagamento === 'Parcelado' && parcelas === null) {
        setParcelas(gerarParcelasPadrao(novoDraft.data, parseCurrencyBR(novoDraft.valor), novoDraft.valorSinal, novoDraft.dataVencimentoSaldo))
      }
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

  async function handleSave() {
    setSubmitted(true)
    setSaveError(null)
    if (hasErrors) return

    const evento: Evento = {
      id:              eventId,
      cliente:         draft.cliente.trim(),
      espaco:          draft.espaco as Espaco,
      data:            draft.data,
      horaInicio:      draft.horaInicio,
      horaFim:         draft.horaFim,
      tipo:            draft.tipo.trim() || 'Evento',
      tipoEvento:      (draft.tipoEvento as TipoEvento) || undefined,
      status:          draft.status,
      valor:           parseCurrencyBR(draft.valor),
      numeroPessoas:   draft.numeroPessoas ? Number(draft.numeroPessoas) : undefined,
      responsavel:     draft.responsavel.trim() || undefined,
      telefoneContato: draft.telefoneContato.trim() || undefined,
      formaPagamento:  (draft.formaPagamento as FormaPagamento) || undefined,
      valorSinal:      draft.formaPagamento === 'Parcelado' && draft.valorSinal ? parseCurrencyBR(draft.valorSinal) : undefined,
      dataVencimentoSaldo: draft.formaPagamento === 'Parcelado' && draft.dataVencimentoSaldo ? draft.dataVencimentoSaldo : undefined,
      observacoes:     draft.observacoes.trim() || undefined,
      documentos:      [],
    }

    setSaving(true)
    try {
      await onSave(evento)
    } catch (err) {
      setSaveError(getErrorMessage(err))
      setSaving(false)
      return
    }

    // Evento já foi salvo com sucesso a partir daqui — uma falha ao gravar o plano
    // de parcelas customizado não deve parecer um erro de salvamento do evento.
    try {
      const parcelasValidas = (parcelas ?? []).filter(p => p.label.trim() && p.data && p.valor && parseCurrencyBR(p.valor) > 0)
      if (evento.formaPagamento === 'Parcelado' && parcelasValidas.length > 0) {
        await syncParcelasDoEvento({
          eventoId: evento.id,
          cliente: evento.cliente,
          espaco: evento.espaco,
          parcelas: parcelasValidas.map(p => ({ numero: p.numero, label: p.label.trim(), data: p.data, valor: parseCurrencyBR(p.valor) })),
        })
      }
    } catch {
      showToast('Evento salvo, mas não foi possível gravar o plano de parcelas customizado. Ajuste em Eventos → Receitas.')
    }
    setSaving(false)
    onClose()
  }

  function fieldProps(draftKey: keyof Draft, required = false) {
    return {
      value: draft[draftKey] as string,
      onChange: (v: string) => set(draftKey, v),
      hasError: submitted && required && !!errors[draftKey],
    }
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
                disabled={saving}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ backgroundColor: GREEN }}
                onMouseEnter={e => { if (!saving) e.currentTarget.style.backgroundColor = DARK_GREEN }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = GREEN }}
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? 'Salvando…' : 'Salvar evento'}
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

          {/* ── Preenchimento automático via ficha do cliente ───────────── */}
          <section className="rounded-lg border border-[#25D366]/30 bg-[#25D366]/5 p-4 space-y-2">
            <p className="text-sm font-medium text-app-text">Já tem a ficha do cliente preenchida?</p>
            <p className="text-xs text-app-muted">Anexe o documento e a IA preenche os campos abaixo automaticamente. Confira os dados antes de salvar.</p>
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

          {/* ── Informações do evento ──────────────────────────────────── */}
          <section>
            <h4 className="flex items-center gap-2 text-xs font-semibold text-app-subtle uppercase tracking-wider mb-3">
              <Calendar className="h-3.5 w-3.5" />
              Informações do Evento
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">

              <div className="col-span-2">
                <Field label="Nome do Cliente" {...fieldProps('cliente', true)} required placeholder="Ex: João Silva" />
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
                  } bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none cursor-pointer disabled:opacity-60 disabled:cursor-default`}
                  onFocus={e => { e.currentTarget.style.borderColor = GREEN }}
                  onBlur={e => { e.currentTarget.style.borderColor = '' }}
                >
                  <option value="">— Selecione um espaço —</option>
                  {espacosNomes.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
                {submitted && errors.espaco && (
                  <p className="text-xs text-red-400 mt-0.5">Campo obrigatório</p>
                )}
              </div>

              <Field label="Data" {...fieldProps('data', true)} type="date" required />

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

              <div>
                <label className="text-xs text-app-subtle mb-0.5 block">Tipo do Evento</label>
                <input
                  type="text"
                  value={draft.tipo}
                  onChange={e => set('tipo', e.target.value)}
                  placeholder="Ex: Casamento, Workshop, Show…"
                  className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none"
                  onFocus={e => { e.currentTarget.style.borderColor = GREEN }}
                  onBlur={e => { e.currentTarget.style.borderColor = '' }}
                />
              </div>

              {/* Categoria */}
              <div>
                <label className="text-xs text-app-subtle mb-0.5 block">Categoria</label>
                <select
                  value={draft.tipoEvento}
                  onChange={e => set('tipoEvento', e.target.value)}
                  className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none cursor-pointer"
                  onFocus={e => { e.currentTarget.style.borderColor = GREEN }}
                  onBlur={e => { e.currentTarget.style.borderColor = '' }}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
              <Field label="Nº de Pessoas" {...fieldProps('numeroPessoas')} type="number" placeholder="0" />
              <Field label="Valor (R$)"    {...fieldProps('valor', true)}   type="currency" required placeholder="0,00" />
              <div className="col-span-2">
                <label className="text-xs text-app-subtle mb-0.5 block">Forma de Pagamento</label>
                <select
                  value={draft.formaPagamento}
                  onChange={e => {
                    const valor = e.target.value
                    set('formaPagamento', valor)
                    if (valor === 'Parcelado' && parcelas === null) {
                      setParcelas(gerarParcelasPadrao(draft.data, parseCurrencyBR(draft.valor), draft.valorSinal, draft.dataVencimentoSaldo))
                    }
                  }}
                  className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none cursor-pointer"
                  onFocus={e => { e.currentTarget.style.borderColor = GREEN }}
                  onBlur={e => { e.currentTarget.style.borderColor = '' }}
                >
                  <option value="">— Selecione —</option>
                  {FORMAS_PAGAMENTO.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              {draft.formaPagamento === 'Parcelado' && (
                <div className="col-span-2 space-y-3 rounded-lg border border-[#25D366]/30 bg-[#25D366]/5 p-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Valor do sinal (R$)" {...fieldProps('valorSinal')} type="currency" placeholder="0,00" />
                    <Field label="Vencimento do saldo" {...fieldProps('dataVencimentoSaldo')} type="date" />
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-app-text">Plano de pagamento (parcelas)</p>
                    <button
                      onClick={() => setParcelas(gerarParcelasPadrao(draft.data, parseCurrencyBR(draft.valor), draft.valorSinal, draft.dataVencimentoSaldo))}
                      className="text-xs text-app-muted hover:text-app-text transition-colors underline"
                    >
                      Recalcular padrão (Sinal + Saldo)
                    </button>
                  </div>

                  <div className="space-y-2">
                    {(parcelas ?? []).map(p => (
                      <div key={p.numero} className="flex items-center gap-2">
                        <input
                          value={p.label}
                          onChange={e => setParcelas(ps => (ps ?? []).map(x => x.numero === p.numero ? { ...x, label: e.target.value } : x))}
                          placeholder="Ex: Sinal"
                          className="w-28 shrink-0 rounded-lg border border-app-border2 bg-app-surface2 px-2 py-1.5 text-xs text-app-text focus:outline-none"
                        />
                        <input
                          type="date"
                          value={p.data}
                          onChange={e => setParcelas(ps => (ps ?? []).map(x => x.numero === p.numero ? { ...x, data: e.target.value } : x))}
                          className="rounded-lg border border-app-border2 bg-app-surface2 px-2 py-1.5 text-xs text-app-text focus:outline-none"
                        />
                        <input
                          type="text" inputMode="decimal"
                          value={p.valor}
                          onChange={e => setParcelas(ps => (ps ?? []).map(x => x.numero === p.numero ? { ...x, valor: e.target.value } : x))}
                          placeholder="0,00"
                          className="w-28 rounded-lg border border-app-border2 bg-app-surface2 px-2 py-1.5 text-xs text-app-text focus:outline-none"
                        />
                        <button
                          onClick={() => setParcelas(ps => (ps ?? []).filter(x => x.numero !== p.numero))}
                          className="ml-auto shrink-0 text-red-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => setParcelas(ps => {
                        const base = ps ?? []
                        const proximo = base.length > 0 ? Math.max(...base.map(x => x.numero)) + 1 : 1
                        return [...base, { numero: proximo, label: `Parcela ${proximo}`, data: '', valor: '' }]
                      })}
                      className="flex items-center gap-1.5 rounded-lg border border-app-border2 px-3 py-1.5 text-xs text-app-muted hover:bg-app-surface2 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Adicionar parcela
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ── Responsável ────────────────────────────────────────────── */}
          <section>
            <h4 className="flex items-center gap-2 text-xs font-semibold text-app-subtle uppercase tracking-wider mb-3">
              <User className="h-3.5 w-3.5" />
              Responsável
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
              <Field label="Nome do Responsável" {...fieldProps('responsavel')}     placeholder="Nome completo" />
              <Field label="Telefone"            {...fieldProps('telefoneContato')} placeholder="(11) 99999-9999" />
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
              className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none resize-none"
              onFocus={e => { e.currentTarget.style.borderColor = GREEN }}
              onBlur={e => { e.currentTarget.style.borderColor = '' }}
            />
          </section>

          {/* ── Anexos ─────────────────────────────────────────────────── */}
          <section>
            <h4 className="flex items-center gap-2 text-xs font-semibold text-app-subtle uppercase tracking-wider mb-3">
              <Paperclip className="h-3.5 w-3.5" />
              Documentos do Evento
            </h4>
            <div className="rounded-lg border border-app-border2/60 bg-app-surface2/30 p-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                <FileAttachButton
                  module="agenda"
                  entityId={eventId}
                  entityName={draft.cliente.trim() || 'Novo Evento'}
                  espaco={(draft.espaco as Espaco) || undefined}
                  categoria="contrato"
                  label="Anexar contrato do evento"
                  onUploaded={() => setFileCount(n => n + 1)}
                />
                <FileAttachButton
                  module="agenda"
                  entityId={eventId}
                  entityName={draft.cliente.trim() || 'Novo Evento'}
                  espaco={(draft.espaco as Espaco) || undefined}
                  categoria="comprovante_sinal"
                  label="Anexar comprovante do sinal"
                  onUploaded={() => setFileCount(n => n + 1)}
                />
              </div>
              {fileCount > 0 && (
                <FileList
                  module="agenda"
                  entityId={eventId}
                  entityName={draft.cliente.trim() || 'Novo Evento'}
                  espaco={(draft.espaco as Espaco) || undefined}
                  showAttach={false}
                  compact
                />
              )}
              {fileCount === 0 && (
                <p className="text-xs text-app-subtle italic">
                  Os arquivos ficam vinculados ao evento após salvar.
                </p>
              )}
            </div>
          </section>

          {submitted && hasErrors && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5">
              <p className="text-xs text-red-400">
                Preencha todos os campos obrigatórios antes de salvar.
              </p>
            </div>
          )}

          {saveError && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5 flex items-start justify-between gap-3">
              <p className="text-xs text-red-400">
                Não foi possível salvar o evento: {saveError}
              </p>
              <button onClick={() => setSaveError(null)} className="text-xs text-red-400 hover:text-red-300 shrink-0">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
      <Toast message={toastMsg} />
    </div>
  )
}
