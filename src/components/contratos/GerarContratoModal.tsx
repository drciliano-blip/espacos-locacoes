'use client'

import { useMemo, useState } from 'react'
import { X, FileSignature, Sparkles, Download, Copy, Check } from 'lucide-react'
import { getModeloPorTipo } from '@/lib/contract-templates'
import type { TipoMinuta } from '@/lib/contract-templates'
import { useEspacos } from '@/contexts/EspacosContext'
import { formatCurrency } from '@/lib/utils'
import type { Contrato, FichaCliente } from '@/types'

const GREEN = '#25D366'
const DARK_GREEN = '#128C7E'

type Origem =
  | { tipo: 'contrato'; dados: Contrato }
  | { tipo: 'ficha'; dados: FichaCliente }

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
    base.CESSIONARIA_NOME = c.cliente
    base.CESSIONARIA_CNPJ_CPF = c.cpfCnpj
    base.CESSIONARIA_ENDERECO = ''
    base.CESSIONARIA_EMAIL = ''
    base.DATA_EVENTO = formatDataBR(c.dataEvento)
    base.HORA_INICIO_MONTAGEM = ''
    base.HORA_INICIO_EVENTO = c.horaInicio
    base.HORA_TERMINO_EVENTO = c.horaFim
    base.VALOR_NEGOCIADO = formatCurrency(c.valorNegociado ?? c.valorTotal)
    base.VALOR_EXTENSO = ''
    base.FORMA_PAGAMENTO = ''
    base.DATA_PAGAMENTO = ''
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
  const dadosLegais = espacosConfig.find(e => e.nome.toLowerCase() === espaco.toLowerCase())?.dadosLegais

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
      const res = await fetch('/api/generate-contract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateText: modelo.texto, variaveis }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setErro(data.error ?? 'Erro ao gerar contrato.')
        return
      }
      setContractText(data.contractText)
    } catch {
      setErro('Falha ao conectar com a IA.')
    } finally {
      setGerando(false)
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

              {!dadosLegais?.cnpj && (
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2.5">
                  <p className="text-xs text-amber-600">
                    {espaco} ainda não tem CNPJ/responsável legal cadastrado — os campos CEDENTE ficam em branco, mas dá pra preencher manualmente abaixo. Cadastre uma vez em Espaços → {espaco} → Documentos para preencher automaticamente da próxima vez.
                  </p>
                </div>
              )}

              <p className="text-xs text-app-muted">
                Modelo: <span className="font-semibold text-app-text">{modelo.nome}</span>. Revise os campos abaixo antes de gerar.
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
