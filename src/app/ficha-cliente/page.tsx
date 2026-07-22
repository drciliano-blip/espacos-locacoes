'use client'

import { useEffect, useRef, useState } from 'react'
import { Building2, Camera, CheckCircle2, Paperclip, Send, Sparkles } from 'lucide-react'
import { maskCPF, maskCNPJ, maskPhone, maskCEP } from '@/lib/utils'
import { saveFile } from '@/lib/file-storage'
import { createClient } from '@/lib/supabase/client'
import Toast from '@/components/shared/Toast'

const GREEN = '#25D366'
const DARK_GREEN = '#128C7E'

const TIPOS_EVENTO = ['Casamento', 'Corporativo', 'Formatura', 'Show/Festival', 'Aniversário', 'Outro']
const FORMAS_PAGAMENTO = ['PIX', 'Transferência', 'Cartão', 'Outro']

interface FichaExtracao {
  nomeCompleto: string | null
  cpf: string | null
  rg: string | null
  dataNascimento: string | null
  email: string | null
  telefoneCelular: string | null
  endereco: { rua: string | null; numero: string | null; complemento: string | null; bairro: string | null; cidade: string | null; estado: string | null; cep: string | null }
  pessoaJuridica: boolean
  razaoSocial: string | null
  nomeFantasia: string | null
  cnpj: string | null
  nomeEvento: string | null
  espacoDesejado: string | null
  tipoEvento: string | null
  dataEvento: string | null
  horaInicioMontagem: string | null
  horaInicioEvento: string | null
  horaTerminoEvento: string | null
  valorLocacao: string | null
  formaPagamento: string | null
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
  const found = options.find(o => o.toLowerCase() === value.toLowerCase())
  return found
}

interface Endereco {
  rua: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  estado: string
  cep: string
}

const ENDERECO_VAZIO: Endereco = { rua: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', cep: '' }

interface FormState {
  nomeCompleto: string
  cpf: string
  rg: string
  dataNascimento: string
  email: string
  telefoneCelular: string
  endereco: Endereco
  pessoaJuridica: boolean
  razaoSocial: string
  nomeFantasia: string
  cnpj: string
  enderecoEmpresa: Endereco
  nomeEvento: string
  espacoDesejado: string
  tipoEvento: string
  dataEvento: string
  horaInicioMontagem: string
  horaInicioEvento: string
  horaTerminoEvento: string
  valorLocacao: string
  formaPagamento: string
}

const FORM_VAZIO: FormState = {
  nomeCompleto: '', cpf: '', rg: '', dataNascimento: '', email: '', telefoneCelular: '',
  endereco: ENDERECO_VAZIO,
  pessoaJuridica: false, razaoSocial: '', nomeFantasia: '', cnpj: '', enderecoEmpresa: ENDERECO_VAZIO,
  nomeEvento: '', espacoDesejado: '', tipoEvento: '', dataEvento: '',
  horaInicioMontagem: '', horaInicioEvento: '', horaTerminoEvento: '', valorLocacao: '', formaPagamento: '',
}

function Field({
  label, value, onChange, required = false, type = 'text', placeholder = '',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  required?: boolean
  type?: string
  placeholder?: string
}) {
  return (
    <div>
      <label className="text-xs text-stone-600 mb-1 block">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#25D366]/40"
      />
    </div>
  )
}

function EnderecoFields({ endereco, onChange }: { endereco: Endereco; onChange: (e: Endereco) => void }) {
  function set<K extends keyof Endereco>(k: K, v: string) {
    onChange({ ...endereco, [k]: v })
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      <div className="col-span-2">
        <Field label="Rua" value={endereco.rua} onChange={v => set('rua', v)} />
      </div>
      <Field label="Número" value={endereco.numero} onChange={v => set('numero', v)} />
      <Field label="Complemento" value={endereco.complemento} onChange={v => set('complemento', v)} />
      <Field label="Bairro" value={endereco.bairro} onChange={v => set('bairro', v)} />
      <Field label="Cidade" value={endereco.cidade} onChange={v => set('cidade', v)} />
      <Field label="Estado" value={endereco.estado} onChange={v => set('estado', v.toUpperCase().slice(0, 2))} placeholder="SP" />
      <Field label="CEP" value={endereco.cep} onChange={v => set('cep', maskCEP(v))} placeholder="00000-000" />
    </div>
  )
}

export default function FichaClientePage() {
  const [form, setForm] = useState<FormState>(FORM_VAZIO)
  const [documento, setDocumento] = useState<File | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [espacos, setEspacos] = useState<string[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const fichaFileRef = useRef<HTMLInputElement>(null)
  const fichaCameraRef = useRef<HTMLInputElement>(null)
  const [extraindoFicha, setExtraindoFicha] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  function showToast(msg: string) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3500)
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

    setExtraindoFicha(true)
    try {
      const body = new FormData()
      body.append('file', file)
      const res = await fetch('/api/extract-ficha', { method: 'POST', body })
      const data: FichaExtracao & { error?: string } = await res.json()

      if (!res.ok || data.error) {
        showToast(data.error ?? 'Não foi possível ler o documento com a IA.')
        return
      }

      const algumCampo = data.nomeCompleto || data.cpf || data.nomeEvento || data.dataEvento
      if (!algumCampo) {
        showToast('A IA não conseguiu identificar os dados nesta ficha. Preencha os campos manualmente.')
        return
      }

      setForm(f => ({
        ...f,
        nomeCompleto: data.nomeCompleto ?? f.nomeCompleto,
        cpf: data.cpf ? maskCPF(data.cpf) : f.cpf,
        rg: data.rg ?? f.rg,
        dataNascimento: data.dataNascimento ? parseDataBR(data.dataNascimento) || f.dataNascimento : f.dataNascimento,
        email: data.email ?? f.email,
        telefoneCelular: data.telefoneCelular ? maskPhone(data.telefoneCelular) : f.telefoneCelular,
        endereco: {
          rua: data.endereco?.rua ?? f.endereco.rua,
          numero: data.endereco?.numero ?? f.endereco.numero,
          complemento: data.endereco?.complemento ?? f.endereco.complemento,
          bairro: data.endereco?.bairro ?? f.endereco.bairro,
          cidade: data.endereco?.cidade ?? f.endereco.cidade,
          estado: data.endereco?.estado ?? f.endereco.estado,
          cep: data.endereco?.cep ? maskCEP(data.endereco.cep) : f.endereco.cep,
        },
        pessoaJuridica: data.pessoaJuridica || f.pessoaJuridica,
        razaoSocial: data.razaoSocial ?? f.razaoSocial,
        nomeFantasia: data.nomeFantasia ?? f.nomeFantasia,
        cnpj: data.cnpj ? maskCNPJ(data.cnpj) : f.cnpj,
        nomeEvento: data.nomeEvento ?? f.nomeEvento,
        espacoDesejado: matchFromList(data.espacoDesejado, espacos) ?? f.espacoDesejado,
        tipoEvento: matchFromList(data.tipoEvento, TIPOS_EVENTO) ?? f.tipoEvento,
        dataEvento: data.dataEvento ? parseDataBR(data.dataEvento) || f.dataEvento : f.dataEvento,
        horaInicioMontagem: data.horaInicioMontagem ?? f.horaInicioMontagem,
        horaInicioEvento: data.horaInicioEvento ?? f.horaInicioEvento,
        horaTerminoEvento: data.horaTerminoEvento ?? f.horaTerminoEvento,
        valorLocacao: data.valorLocacao ? parseValorBR(data.valorLocacao) || f.valorLocacao : f.valorLocacao,
        formaPagamento: matchFromList(data.formaPagamento, FORMAS_PAGAMENTO) ?? f.formaPagamento,
      }))
      showToast('Campos preenchidos automaticamente pela IA — confira antes de enviar.')
    } catch {
      showToast('Falha ao conectar com a IA. Preencha os campos manualmente.')
    } finally {
      setExtraindoFicha(false)
      if (fichaFileRef.current) fichaFileRef.current.value = ''
      if (fichaCameraRef.current) fichaCameraRef.current.value = ''
    }
  }

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('espacos')
      .select('nome')
      .eq('status', 'ativo')
      .order('nome')
      .then(({ data }) => setEspacos(((data as { nome: string }[]) ?? []).map(r => r.nome)))
  }, [])

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  const errors = {
    nomeCompleto: !form.nomeCompleto.trim(),
    cpf: !form.cpf.trim(),
    email: !form.email.trim(),
    telefoneCelular: !form.telefoneCelular.trim(),
    nomeEvento: !form.nomeEvento.trim(),
    espacoDesejado: !form.espacoDesejado,
    tipoEvento: !form.tipoEvento,
    dataEvento: !form.dataEvento,
  }
  const hasErrors = Object.values(errors).some(Boolean)

  async function handleSubmit() {
    setSubmitted(true)
    if (hasErrors) return
    setSaving(true)
    setErro(null)

    const id = crypto.randomUUID()
    let documentoFileId: string | undefined
    if (documento) {
      const stored = await saveFile(documento, {
        module: 'fichas',
        entityId: id,
        entityName: form.nomeCompleto.trim(),
      })
      documentoFileId = stored.id
    }

    const supabase = createClient()
    const { error } = await supabase.from('fichas_clientes').insert({
      id,
      nome_completo: form.nomeCompleto.trim(),
      cpf: form.cpf,
      rg: form.rg || null,
      data_nascimento: form.dataNascimento || null,
      email: form.email.trim(),
      telefone_celular: form.telefoneCelular,
      endereco: form.endereco,
      pessoa_juridica: form.pessoaJuridica,
      razao_social: form.pessoaJuridica ? form.razaoSocial || null : null,
      nome_fantasia: form.pessoaJuridica ? form.nomeFantasia || null : null,
      cnpj: form.pessoaJuridica ? form.cnpj || null : null,
      endereco_empresa: form.pessoaJuridica ? form.enderecoEmpresa : null,
      nome_evento: form.nomeEvento.trim(),
      espaco_desejado: form.espacoDesejado,
      tipo_evento: form.tipoEvento,
      data_evento: form.dataEvento,
      hora_inicio_montagem: form.horaInicioMontagem || null,
      hora_inicio_evento: form.horaInicioEvento || null,
      hora_termino_evento: form.horaTerminoEvento || null,
      valor_locacao: form.valorLocacao || null,
      forma_pagamento: form.formaPagamento || null,
      documento_file_id: documentoFileId ?? null,
    })

    setSaving(false)
    if (error) {
      setErro('Não foi possível enviar a ficha. Tente novamente.')
      return
    }
    setEnviado(true)
  }

  if (enviado) {
    return (
      <div className="min-h-screen bg-[#F0F2F5] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-stone-200 shadow-lg p-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366]/15 mx-auto mb-4">
            <CheckCircle2 className="h-7 w-7" style={{ color: GREEN }} />
          </div>
          <h1 className="text-lg font-bold text-stone-900 mb-2">Ficha enviada com sucesso!</h1>
          <p className="text-sm text-stone-600">Nossa equipe entrará em contato.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F0F2F5] py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6 justify-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#25D366]/15 border border-[#25D366]/30">
            <Building2 className="h-5 w-5" style={{ color: GREEN }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-stone-900 leading-none">Espaços & Locações</p>
            <p className="text-xs text-stone-500">Ficha de Cadastro do Cliente</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-6">

          {/* Preenchimento automático via IA */}
          <section className="rounded-xl border border-[#25D366]/30 bg-[#25D366]/5 p-4 space-y-2">
            <p className="text-sm font-medium text-stone-800">Já tem uma ficha preenchida?</p>
            <p className="text-xs text-stone-500">Anexe o documento e a IA preenche os campos abaixo automaticamente. Confira os dados antes de enviar.</p>
            <input ref={fichaFileRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={e => handleFichaAnexo(e.target.files?.[0] ?? null)} />
            <input ref={fichaCameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handleFichaAnexo(e.target.files?.[0] ?? null)} />
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <button
                type="button"
                onClick={() => fichaFileRef.current?.click()}
                disabled={extraindoFicha}
                className="flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-50 transition-colors disabled:opacity-60"
              >
                <Paperclip className="h-3.5 w-3.5" />
                Selecionar arquivo…
              </button>
              <button
                type="button"
                onClick={() => fichaCameraRef.current?.click()}
                disabled={extraindoFicha}
                className="flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-50 transition-colors disabled:opacity-60"
              >
                <Camera className="h-3.5 w-3.5" />
                Tirar foto
              </button>
              {extraindoFicha && (
                <span className="flex items-center gap-1.5 text-xs" style={{ color: DARK_GREEN }}>
                  <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                  Analisando com IA…
                </span>
              )}
            </div>
          </section>

          {/* Dados pessoais */}
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-500">Dados Pessoais</h2>
            <div className="col-span-2">
              <Field label="Nome completo" required value={form.nomeCompleto} onChange={v => set('nomeCompleto', v)} />
              {submitted && errors.nomeCompleto && <p className="text-xs text-red-500 mt-0.5">Campo obrigatório</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Field label="CPF" required value={form.cpf} onChange={v => set('cpf', maskCPF(v))} placeholder="000.000.000-00" />
                {submitted && errors.cpf && <p className="text-xs text-red-500 mt-0.5">Campo obrigatório</p>}
              </div>
              <Field label="RG" value={form.rg} onChange={v => set('rg', v)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Data de nascimento" type="date" value={form.dataNascimento} onChange={v => set('dataNascimento', v)} />
              <div>
                <Field label="Telefone celular" required value={form.telefoneCelular} onChange={v => set('telefoneCelular', maskPhone(v))} placeholder="(11) 99999-9999" />
                {submitted && errors.telefoneCelular && <p className="text-xs text-red-500 mt-0.5">Campo obrigatório</p>}
              </div>
            </div>
            <div>
              <Field label="E-mail" required type="email" value={form.email} onChange={v => set('email', v)} placeholder="voce@email.com" />
              {submitted && errors.email && <p className="text-xs text-red-500 mt-0.5">Campo obrigatório</p>}
            </div>
            <EnderecoFields endereco={form.endereco} onChange={e => set('endereco', e)} />
          </section>

          {/* Empresa */}
          <section className="space-y-3 pt-2 border-t border-stone-100">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.pessoaJuridica}
                onChange={e => set('pessoaJuridica', e.target.checked)}
                className="h-4 w-4 rounded border-stone-300 accent-[#25D366]"
              />
              <span className="text-sm font-medium text-stone-800">É pessoa jurídica?</span>
            </label>

            {form.pessoaJuridica && (
              <div className="space-y-3 pl-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Razão Social" value={form.razaoSocial} onChange={v => set('razaoSocial', v)} />
                  <Field label="Nome Fantasia" value={form.nomeFantasia} onChange={v => set('nomeFantasia', v)} />
                </div>
                <Field label="CNPJ" value={form.cnpj} onChange={v => set('cnpj', maskCNPJ(v))} placeholder="00.000.000/0000-00" />
                <p className="text-xs text-stone-500">Endereço da empresa</p>
                <EnderecoFields endereco={form.enderecoEmpresa} onChange={e => set('enderecoEmpresa', e)} />
              </div>
            )}
          </section>

          {/* Evento */}
          <section className="space-y-3 pt-2 border-t border-stone-100">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-500">Informações do Evento</h2>
            <div>
              <Field label="Nome do evento" required value={form.nomeEvento} onChange={v => set('nomeEvento', v)} />
              {submitted && errors.nomeEvento && <p className="text-xs text-red-500 mt-0.5">Campo obrigatório</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-stone-600 mb-1 block">Espaço desejado<span className="text-red-500 ml-0.5">*</span></label>
                <select
                  value={form.espacoDesejado}
                  onChange={e => set('espacoDesejado', e.target.value)}
                  className="w-full cursor-pointer rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#25D366]/40"
                >
                  <option value="">— Selecione —</option>
                  {espacos.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
                {submitted && errors.espacoDesejado && <p className="text-xs text-red-500 mt-0.5">Campo obrigatório</p>}
              </div>
              <div>
                <label className="text-xs text-stone-600 mb-1 block">Tipo de evento<span className="text-red-500 ml-0.5">*</span></label>
                <select
                  value={form.tipoEvento}
                  onChange={e => set('tipoEvento', e.target.value)}
                  className="w-full cursor-pointer rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#25D366]/40"
                >
                  <option value="">— Selecione —</option>
                  {TIPOS_EVENTO.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                {submitted && errors.tipoEvento && <p className="text-xs text-red-500 mt-0.5">Campo obrigatório</p>}
              </div>
            </div>
            <div>
              <Field label="Data do evento" required type="date" value={form.dataEvento} onChange={v => set('dataEvento', v)} />
              {submitted && errors.dataEvento && <p className="text-xs text-red-500 mt-0.5">Campo obrigatório</p>}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Início montagem" type="time" value={form.horaInicioMontagem} onChange={v => set('horaInicioMontagem', v)} />
              <Field label="Início evento" type="time" value={form.horaInicioEvento} onChange={v => set('horaInicioEvento', v)} />
              <Field label="Término evento" type="time" value={form.horaTerminoEvento} onChange={v => set('horaTerminoEvento', v)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Valor da locação (R$)" type="number" value={form.valorLocacao} onChange={v => set('valorLocacao', v)} placeholder="0,00" />
              <div>
                <label className="text-xs text-stone-600 mb-1 block">Forma de pagamento</label>
                <select
                  value={form.formaPagamento}
                  onChange={e => set('formaPagamento', e.target.value)}
                  className="w-full cursor-pointer rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#25D366]/40"
                >
                  <option value="">— Selecione —</option>
                  {FORMAS_PAGAMENTO.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-stone-600 mb-1 block">Documento (CNH ou RG frente e verso)</label>
              <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden" onChange={e => setDocumento(e.target.files?.[0] ?? null)} />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-1.5 rounded-lg border border-stone-300 px-3 py-2 text-xs text-stone-600 hover:bg-stone-50 transition-colors"
                >
                  <Paperclip className="h-3.5 w-3.5" />
                  {documento ? documento.name : 'Selecionar arquivo…'}
                </button>
                {documento && (
                  <button type="button" onClick={() => { setDocumento(null); if (fileRef.current) fileRef.current.value = '' }} className="text-xs text-red-500 hover:underline">
                    remover
                  </button>
                )}
              </div>
            </div>
          </section>

          {submitted && hasErrors && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
              <p className="text-xs text-red-600">Preencha todos os campos obrigatórios antes de enviar.</p>
            </div>
          )}

          {erro && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
              <p className="text-xs text-red-600">{erro}</p>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white transition-colors disabled:opacity-60"
            style={{ backgroundColor: GREEN }}
            onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = DARK_GREEN }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = GREEN }}
          >
            <Send className="h-4 w-4" />
            {saving ? 'Enviando…' : 'Enviar ficha'}
          </button>
        </div>
      </div>
      <Toast message={toastMsg} />
    </div>
  )
}
