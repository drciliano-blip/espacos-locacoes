'use client'

import { useEffect, useMemo, useState } from 'react'
import { X, FileSignature, Sparkles, Download, Copy, Check, Paperclip, FileCheck2, AlertTriangle } from 'lucide-react'
import { getModeloPorTipo } from '@/lib/contract-templates'
import type { TipoMinuta } from '@/lib/contract-templates'
import { useEspacos } from '@/contexts/EspacosContext'
import { formatCurrency } from '@/lib/utils'
import { saveFile, getFiles, type StoredFile } from '@/lib/file-storage'
import type { Contrato, FichaCliente, Evento } from '@/types'

async function gerarPdfFile(texto: string, nomeArquivo: string): Promise<File> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const margin = 48
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const maxWidth = pageWidth - margin * 2
  const lineHeight = 14

  doc.setFont('times', 'normal')
  doc.setFontSize(11)
  const lines = doc.splitTextToSize(texto, maxWidth) as string[]

  let y = margin
  for (const line of lines) {
    if (y > pageHeight - margin) {
      doc.addPage()
      y = margin
    }
    doc.text(line, margin, y)
    y += lineHeight
  }

  const blob = doc.output('blob')
  return new File([blob], nomeArquivo, { type: 'application/pdf' })
}

const GREEN = '#25D366'
const DARK_GREEN = '#128C7E'

type Origem =
  | { tipo: 'contrato'; dados: Contrato; eventoOrigem?: Evento }
  | { tipo: 'ficha'; dados: FichaCliente }

function destinoAnexo(origem: Origem): { module: 'contratos' | 'fichas'; entityId: string; entityName: string; espaco?: string } {
  if (origem.tipo === 'contrato') {
    const c = origem.dados
    return { module: 'contratos', entityId: c.id, entityName: `${c.cliente} — ${c.numeroContrato}`, espaco: c.espaco }
  }
  const f = origem.dados
  return { module: 'fichas', entityId: f.id, entityName: f.nomeCompleto }
}

interface Props {
  origem: Origem
  onClose: () => void
}

function formatDataBR(iso?: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

function labelFor(campo: string): string {
  return campo
    .toLowerCase()
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function espacoDaOrigem(origem: Origem): string {
  return origem.tipo === 'contrato' ? origem.dados.espaco : origem.dados.espacoDesejado
}

interface DadosLegaisEspaco {
  cnpj?: string
  responsavelNome?: string
  responsavelRg?: string
  responsavelCpf?: string
}

function valoresIniciais(origem: Origem, campos: string[], dadosLegais: DadosLegaisEspaco | undefined, espacoNome: string): Record<string, string> {
  const hoje = new Date().toISOString().split('T')[0]
  const base: Record<string, string> = {}

  base.CEDENTE_NOME = `Sociedade vinculada ao espaço ${espacoNome}`
  base.CEDENTE_CNPJ = dadosLegais?.cnpj ?? ''
  base.CEDENTE_ENDERECO = ''
  base.CEDENTE_RESPONSAVEL = dadosLegais?.responsavelNome ?? ''
  base.CEDENTE_RESPONSAVEL_RG = dadosLegais?.responsavelRg ?? ''
  base.CEDENTE_RESPONSAVEL_CPF = dadosLegais?.responsavelCpf ?? ''

  if (origem.tipo === 'contrato') {
    const c = origem.dados
    const ev = origem.eventoOrigem
    const cnpjCpf = ev ? (ev.pessoaJuridica ? ev.cnpj : ev.cpf) : undefined
    const enderecoEv = ev ? (ev.pessoaJuridica ? ev.enderecoEmpresa : ev.endereco) : undefined
    base.CESSIONARIA_NOME = ev && ev.pessoaJuridica && ev.razaoSocial ? ev.razaoSocial : c.cliente
    base.CESSIONARIA_CNPJ_CPF = cnpjCpf || c.cpfCnpj
    base.CESSIONARIA_ENDERECO = enderecoEv
      ? [enderecoEv.rua, enderecoEv.numero, enderecoEv.bairro, enderecoEv.cidade, enderecoEv.estado].filter(Boolean).join(', ')
      : ''
    base.CESSIONARIA_EMAIL = ev?.email ?? ''
    base.DATA_EVENTO = formatDataBR(c.dataEvento)
    base.HORA_INICIO_MONTAGEM = ev?.horaInicioMontagem ?? ''
    base.HORA_INICIO_EVENTO = c.horaInicio
    base.HORA_TERMINO_EVENTO = c.horaFim
    base.VALOR_NEGOCIADO = formatCurrency(c.valorNegociado ?? c.valorTotal)
    base.VALOR_EXTENSO = ''
    base.FORMA_PAGAMENTO = ev?.formaPagamento ?? ''
    base.DATA_PAGAMENTO = ev?.dataVencimentoSaldo ? formatDataBR(ev.dataVencimentoSaldo) : ''
    base.PERCENTUAL_CESSIONARIA = ''
    base.PERCENTUAL_CEDENTE = ''
    base.VALOR_MINIMO = ''
    base.OBSERVACAO_NEGOCIACAO = c.observacaoNegociacao ?? ''
    base.OBSERVACAO_PARCERIA = c.observacaoParceria ?? ''
    base.DATA_ASSINATURA = formatDataBR(hoje)
  } else {
    const f = origem.dados
    base.CESSIONARIA_NOME = f.pessoaJuridica ? (f.razaoSocial || f.nomeCompleto) : f.nomeCompleto
    base.CESSIONARIA_CNPJ_CPF = f.pessoaJuridica ? (f.cnpj || '') : f.cpf
    const end = f.endereco
    base.CESSIONARIA_ENDERECO = [end?.rua, end?.numero, end?.bairro, end?.cidade, end?.estado].filter(Boolean).join(', ')
    base.CESSIONARIA_EMAIL = f.email
    base.DATA_EVENTO = formatDataBR(f.dataEvento)
    base.HORA_INICIO_MONTAGEM = f.horaInicioMontagem || ''
    base.HORA_INICIO_EVENTO = f.horaInicioEvento || ''
    base.HORA_TERMINO_EVENTO = f.horaTerminoEvento || ''
    base.VALOR_NEGOCIADO = f.valorLocacao ? formatCurrency(Number(f.valorLocacao)) : ''
    base.VALOR_EXTENSO = ''
    base.FORMA_PAGAMENTO = f.formaPagamento || ''
    base.DATA_PAGAMENTO = ''
    base.PERCENTUAL_CESSIONARIA = ''
    base.PERCENTUAL_CEDENTE = ''
    base.VALOR_MINIMO = ''
    base.OBSERVACAO_NEGOCIACAO = ''
    base.OBSERVACAO_PARCERIA = ''
    base.DATA_ASSINATURA = formatDataBR(hoje)
  }

  const out: Record<string, string> = {}
  for (const campo of campos) out[campo] = base[campo] ?? ''
  return out
}

export default function GerarContratoModal({ origem, onClose }: Props) {
  const { espacosConfig } = useEspacos()
  const espaco = espacoDaOrigem(origem)
  const espacoConfig = espacosConfig.find(e => e.nome.toLowerCase() === espaco.toLowerCase())
  const dadosLegais = espacoConfig?.dadosLegais

  const [tipoMinuta, setTipoMinuta] = useState<TipoMinuta>(
    (origem.tipo === 'contrato' && origem.dados.tipoMinuta) || 'locacao'
  )
  const modelo = useMemo(() => getModeloPorTipo(tipoMinuta), [tipoMinuta])
  const [variaveis, setVariaveis] = useState<Record<string, string>>(
    () => valoresIniciais(origem, modelo.variaveis, dadosLegais, espaco)
  )
  const [gerando, setGerando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [contractText, setContractText] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [anexando, setAnexando] = useState(false)
  const [anexado, setAnexado] = useState(false)
  const [minutaReal, setMinutaReal] = useState<StoredFile | null>(null)
  const [carregandoMinuta, setCarregandoMinuta] = useState(true)

  useEffect(() => {
    let ativo = true
    setCarregandoMinuta(true)
    setMinutaReal(null)
    if (!espacoConfig?.id) {
      setCarregandoMinuta(false)
      return
    }
    getFiles({ module: 'espacos', entityId: espacoConfig.id }).then(arquivos => {
      if (!ativo) return
      const categoria = `minuta_${tipoMinuta}`
      const encontrada = arquivos
        .filter(f => f.categoria === categoria)
        .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))[0]
      setMinutaReal(encontrada ?? null)
      setCarregandoMinuta(false)
    })
    return () => { ativo = false }
  }, [espacoConfig?.id, tipoMinuta])

  function trocarTipoMinuta(novoTipo: TipoMinuta) {
    setTipoMinuta(novoTipo)
    setVariaveis(valoresIniciais(origem, getModeloPorTipo(novoTipo).variaveis, dadosLegais, espaco))
  }

  function setVar(campo: string, valor: string) {
    setVariaveis(v => ({ ...v, [campo]: valor }))
  }

  async function handleGerar() {
    setGerando(true)
    setErro(null)
    try {
      const usaMinutaReal = !!minutaReal
      const res = await fetch(usaMinutaReal ? '/api/generate-contract-from-minuta' : '/api/generate-contract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          usaMinutaReal ? { fileId: minutaReal!.id, variaveis } : { templateText: modelo.texto, variaveis }
        ),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setErro(data.error ?? 'Erro ao gerar contrato.')
        return
      }
      setContractText(data.contractText)
      anexarAoSistema(data.contractText)
    } catch {
      setErro('Falha ao conectar com a IA.')
    } finally {
      setGerando(false)
    }
  }

  async function anexarAoSistema(texto: string) {
    setAnexando(true)
    try {
      const destino = destinoAnexo(origem)
      const nomeArquivo = `contrato-${modelo.tipoMinuta}-${Date.now()}.pdf`
      const file = await gerarPdfFile(texto, nomeArquivo)
      await saveFile(file, { ...destino, categoria: 'contrato' })
      setAnexado(true)
    } catch {
      setErro('Contrato gerado, mas não foi possível anexar o PDF automaticamente. Use "Baixar como PDF" e anexe manualmente.')
    } finally {
      setAnexando(false)
    }
  }

  async function handleCopiar() {
    if (!contractText) return
    try {
      await navigator.clipboard.writeText(contractText)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      setErro('Não foi possível copiar automaticamente. Selecione o texto manualmente.')
    }
  }

  function handleBaixarPDF() {
    if (!contractText) return
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <html>
        <head>
          <title>Contrato — ${modelo.nome}</title>
          <style>
            body { font-family: Georgia, serif; padding: 48px; color: #111; line-height: 1.6; white-space: pre-wrap; }
          </style>
        </head>
        <body>${contractText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</body>
      </html>
    `)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 300)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-app-surface rounded-2xl border border-app-border shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-app-border sticky top-0 bg-app-surface z-10">
          <div className="flex items-center gap-2">
            <FileSignature className="h-4 w-4 text-[#25D366]" />
            <h2 className="text-sm font-semibold text-app-text">Gerar Contrato — {espaco}</h2>
          </div>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-app-subtle hover:bg-app-surface2 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {!contractText && (
            <>
              <div>
                <label className="text-xs text-app-subtle mb-0.5 block">Tipo de minuta</label>
                <select
                  value={tipoMinuta}
                  onChange={e => trocarTipoMinuta(e.target.value as TipoMinuta)}
                  className="w-full cursor-pointer rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none"
                  onFocus={e => { e.currentTarget.style.borderColor = GREEN }}
                  onBlur={e => { e.currentTarget.style.borderColor = '' }}
                >
                  <option value="locacao">Locação (valor fixo)</option>
                  <option value="parceria">Parceria (% sobre faturamento)</option>
                </select>
              </div>

              {!carregandoMinuta && (
                minutaReal ? (
                  <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2.5 flex items-start gap-2">
                    <FileCheck2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-emerald-600">
                      Usando a minuta real de {espaco} ({minutaReal.name}) como base — a IA preenche os dados mantendo o texto jurídico original.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2.5 flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-600">
                      {espaco} ainda não tem a minuta real de {tipoMinuta === 'parceria' ? 'Parceria' : 'Locação'} anexada — usando um modelo genérico temporário. Anexe o PDF real em Espaços → {espaco} → Documentos para usar o texto oficial.
                    </p>
                  </div>
                )
              )}

              {!dadosLegais?.cnpj && (
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2.5">
                  <p className="text-xs text-amber-600">
                    {espaco} ainda não tem CNPJ/responsável legal cadastrado — os campos CEDENTE ficam em branco, mas dá pra preencher manualmente abaixo. Cadastre uma vez em Espaços → {espaco} → Documentos para preencher automaticamente da próxima vez.
                  </p>
                </div>
              )}

              <p className="text-xs text-app-muted">
                Modelo: <span className="font-semibold text-app-text">{minutaReal ? minutaReal.name : modelo.nome}</span>. Revise os campos abaixo antes de gerar.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                {modelo.variaveis.map(campo => (
                  campo === 'OBSERVACAO_NEGOCIACAO' || campo === 'OBSERVACAO_PARCERIA' ? (
                    <div key={campo} className="col-span-2">
                      <label className="text-xs text-app-subtle mb-0.5 block">{labelFor(campo)}</label>
                      <textarea
                        value={variaveis[campo] ?? ''}
                        onChange={e => setVar(campo, e.target.value)}
                        rows={2}
                        className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none resize-none"
                        onFocus={e => { e.currentTarget.style.borderColor = GREEN }}
                        onBlur={e => { e.currentTarget.style.borderColor = '' }}
                      />
                    </div>
                  ) : (
                    <div key={campo}>
                      <label className="text-xs text-app-subtle mb-0.5 block">{labelFor(campo)}</label>
                      <input
                        value={variaveis[campo] ?? ''}
                        onChange={e => setVar(campo, e.target.value)}
                        className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none"
                        onFocus={e => { e.currentTarget.style.borderColor = GREEN }}
                        onBlur={e => { e.currentTarget.style.borderColor = '' }}
                      />
                    </div>
                  )
                ))}
              </div>

              {erro && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5">
                  <p className="text-xs text-red-400">{erro}</p>
                </div>
              )}

              <button
                onClick={handleGerar}
                disabled={gerando}
                className="flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 transition-colors"
                style={{ backgroundColor: GREEN }}
                onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = DARK_GREEN }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = GREEN }}
              >
                <Sparkles className={`h-4 w-4 ${gerando ? 'animate-pulse' : ''}`} />
                {gerando ? 'Gerando com IA…' : 'Gerar PDF'}
              </button>
            </>
          )}

          {contractText && (
            <>
              <pre className="whitespace-pre-wrap text-sm text-app-text2 bg-app-surface2/40 rounded-lg border border-app-border2/50 p-4 max-h-96 overflow-y-auto font-sans">
                {contractText}
              </pre>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleBaixarPDF}
                  className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors"
                  style={{ backgroundColor: GREEN }}
                >
                  <Download className="h-3.5 w-3.5" />
                  Baixar como PDF
                </button>
                <button
                  onClick={handleCopiar}
                  className="flex items-center gap-1.5 rounded-lg border border-app-border2 px-4 py-2 text-sm text-app-muted hover:bg-app-surface2 transition-colors"
                >
                  {copiado ? <Check className="h-3.5 w-3.5 text-[#25D366]" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiado ? 'Copiado!' : 'Copiar texto'}
                </button>
                <button
                  onClick={() => setContractText(null)}
                  className="ml-auto text-xs text-app-muted hover:text-app-text transition-colors"
                >
                  Editar campos novamente
                </button>
              </div>
              {anexando && (
                <p className="flex items-center gap-1.5 text-xs text-app-muted">
                  <Paperclip className="h-3.5 w-3.5 animate-pulse" />
                  Anexando PDF ao {origem.tipo === 'contrato' ? 'contrato' : 'registro'}…
                </p>
              )}
              {anexado && !anexando && (
                <p className="flex items-center gap-1.5 text-xs text-emerald-600">
                  <Check className="h-3.5 w-3.5" />
                  PDF anexado automaticamente — já disponível em Documentos.
                </p>
              )}
              {erro && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5">
                  <p className="text-xs text-red-400">{erro}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
