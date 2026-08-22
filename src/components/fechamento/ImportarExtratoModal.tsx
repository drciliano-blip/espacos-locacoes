'use client'

import { useRef, useState } from 'react'
import { X, Upload, FileUp, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import * as XLSX from 'xlsx'
import { useEspacos } from '@/contexts/EspacosContext'
import { parseCurrencyBR, formatCurrency } from '@/lib/utils'
import { parseOfx } from '@/lib/ofx-parser'
import type { ImportarExtratoInput, ImportarExtratoResultado, FormatoExtrato, MovimentacaoParaImportar } from '@/contexts/ConciliacaoContext'

const GREEN = '#25D366'
const DARK_GREEN = '#128C7E'

// Mesma tolerância usada na leitura de comprovantes (Contas a Pagar / Retirada
// de Sócio) — dia/mês sem zero à esquerda, ano com 2 ou 4 dígitos.
function parseDataBR(data: string): string {
  const match = data.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/)
  if (!match) return ''
  let [, dd, mm, yyyy] = match
  dd = dd.padStart(2, '0')
  mm = mm.padStart(2, '0')
  if (yyyy.length === 2) yyyy = `20${yyyy}`
  return `${yyyy}-${mm}-${dd}`
}

interface MovimentacaoExtraidaIA {
  data: string
  hora: string | null
  descricao: string
  valor: string
  tipo: 'entrada' | 'saida'
  tipoTransacao: MovimentacaoParaImportar['tipoTransacao'] | null
  identificadorTransacao: string | null
  favorecidoPagador: string | null
}

interface ExtratoExtraidoIA {
  banco: string | null
  conta: string | null
  periodoInicio: string | null
  periodoFim: string | null
  saldoInicial: string | null
  saldoFinal: string | null
  movimentacoes: MovimentacaoExtraidaIA[]
  truncado?: boolean
  error?: string
}

interface Preview {
  banco?: string
  conta?: string
  periodoInicio?: string
  periodoFim?: string
  saldoInicial?: number
  saldoFinal?: number
  movimentacoes: MovimentacaoParaImportar[]
  truncado?: boolean
}

function detectarFormato(nome: string): FormatoExtrato | null {
  const ext = nome.split('.').pop()?.toLowerCase()
  if (ext === 'ofx') return 'ofx'
  if (ext === 'csv') return 'csv'
  if (ext === 'xlsx') return 'xlsx'
  if (ext === 'xls') return 'xls'
  if (ext === 'pdf') return 'pdf'
  return null
}

interface Props {
  // Quando presente, o espaço vem travado nesse valor (seleção global do
  // Dashboard) — o campo aparece só como texto, não como select.
  espacoPadrao?: string
  onClose: () => void
  onImportar: (input: ImportarExtratoInput) => Promise<ImportarExtratoResultado>
  onImportado: (resultado: ImportarExtratoResultado) => void
}

export default function ImportarExtratoModal({ espacoPadrao, onClose, onImportar, onImportado }: Props) {
  const { espacosNomes } = useEspacos()
  const [espaco, setEspaco] = useState(espacoPadrao ?? '')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [formato, setFormato] = useState<FormatoExtrato | null>(null)
  const [lendo, setLendo] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [importando, setImportando] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleArquivoSelecionado(file: File | null) {
    setPreview(null)
    setErro(null)
    setArquivo(file)
    if (!file) { setFormato(null); return }

    const fmt = detectarFormato(file.name)
    setFormato(fmt)
    if (!fmt) {
      setErro('Formato não reconhecido. Envie um arquivo .ofx, .csv, .xls, .xlsx ou .pdf.')
      return
    }

    setLendo(true)
    try {
      if (fmt === 'ofx') {
        const texto = await file.text()
        const extrato = parseOfx(texto)
        if (extrato.movimentacoes.length === 0) {
          setErro('Não foi possível identificar movimentações neste arquivo OFX.')
          return
        }
        setPreview({
          banco: extrato.banco,
          conta: extrato.conta,
          periodoInicio: extrato.periodoInicio,
          periodoFim: extrato.periodoFim,
          saldoFinal: extrato.saldoFinal,
          movimentacoes: extrato.movimentacoes,
        })
        return
      }

      let body: FormData
      if (fmt === 'csv' || fmt === 'xls' || fmt === 'xlsx') {
        const buffer = await file.arrayBuffer()
        const workbook = XLSX.read(buffer, { type: 'array' })
        const primeiraAba = workbook.Sheets[workbook.SheetNames[0]]
        const textoTabular = XLSX.utils.sheet_to_csv(primeiraAba)
        body = new FormData()
        body.append('text', textoTabular)
      } else {
        body = new FormData()
        body.append('file', file)
      }

      const res = await fetch('/api/extract-extrato', { method: 'POST', body })
      const extraido: ExtratoExtraidoIA = await res.json()
      if (!res.ok || extraido.error) {
        setErro(extraido.error ?? 'Não foi possível ler este extrato.')
        return
      }
      if (extraido.movimentacoes.length === 0) {
        setErro('A IA não identificou nenhuma movimentação neste extrato.')
        return
      }

      setPreview({
        banco: extraido.banco ?? undefined,
        conta: extraido.conta ?? undefined,
        periodoInicio: extraido.periodoInicio ? parseDataBR(extraido.periodoInicio) || undefined : undefined,
        periodoFim: extraido.periodoFim ? parseDataBR(extraido.periodoFim) || undefined : undefined,
        saldoInicial: extraido.saldoInicial ? parseCurrencyBR(extraido.saldoInicial) : undefined,
        saldoFinal: extraido.saldoFinal ? parseCurrencyBR(extraido.saldoFinal) : undefined,
        truncado: extraido.truncado,
        movimentacoes: extraido.movimentacoes.map(m => ({
          data: parseDataBR(m.data),
          hora: m.hora ?? undefined,
          descricao: m.descricao,
          valor: parseCurrencyBR(m.valor),
          tipo: m.tipo,
          tipoTransacao: m.tipoTransacao ?? undefined,
          identificadorTransacao: m.identificadorTransacao ?? undefined,
          favorecidoPagador: m.favorecidoPagador ?? undefined,
        })).filter(m => m.data && m.valor > 0),
      })
    } catch {
      setErro('Falha ao ler o arquivo. Tente novamente.')
    } finally {
      setLendo(false)
    }
  }

  const resumo = preview ? {
    entradas: preview.movimentacoes.filter(m => m.tipo === 'entrada'),
    saidas: preview.movimentacoes.filter(m => m.tipo === 'saida'),
  } : null

  async function handleConfirmar() {
    if (!preview || !arquivo || !formato) return
    setImportando(true)
    setErro(null)
    try {
      const resultado = await onImportar({
        arquivo,
        formato,
        espaco: espaco || undefined,
        banco: preview.banco,
        conta: preview.conta,
        periodoInicio: preview.periodoInicio,
        periodoFim: preview.periodoFim,
        saldoInicial: preview.saldoInicial,
        saldoFinal: preview.saldoFinal,
        movimentacoes: preview.movimentacoes,
      })
      onImportado(resultado)
      onClose()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao importar o extrato. Tente novamente.')
    } finally {
      setImportando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-app-surface rounded-2xl border border-app-border shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-app-border sticky top-0 bg-app-surface z-10">
          <h2 className="text-sm font-semibold text-app-text flex items-center gap-2">
            <Upload className="h-4 w-4 text-[#25D366]" />
            Importar Extrato Bancário
          </h2>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-app-subtle hover:bg-app-surface2 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs text-app-subtle mb-0.5 block">Espaço (conta bancária vinculada)</label>
            {espacoPadrao ? (
              <p className="w-full rounded-lg border border-app-border2 bg-app-surface3 px-2.5 py-1.5 text-sm text-app-text2">{espaco}</p>
            ) : (
              <select
                value={espaco}
                onChange={e => setEspaco(e.target.value)}
                className="w-full cursor-pointer rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none"
              >
                <option value="">— Conta da empresa toda —</option>
                {espacosNomes.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            )}
          </div>

          <div>
            <label className="text-xs text-app-subtle mb-0.5 block">Arquivo do extrato<span className="text-red-400 ml-0.5">*</span></label>
            <p className="text-[11px] text-app-subtle mb-1.5">OFX é lido direto (mais confiável). CSV, XLS e PDF são lidos por IA.</p>
            <input ref={fileRef} type="file" accept=".ofx,.csv,.xls,.xlsx,.pdf" className="hidden"
              onChange={e => handleArquivoSelecionado(e.target.files?.[0] ?? null)} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={lendo}
              className="flex items-center gap-1.5 rounded-lg border border-app-border2 px-3 py-1.5 text-xs text-app-muted hover:bg-app-surface2 transition-colors disabled:opacity-60">
              <FileUp className="h-3.5 w-3.5" />
              {arquivo ? arquivo.name : 'Selecionar arquivo…'}
            </button>
            {lendo && <p className="text-xs text-app-subtle mt-1.5">Lendo extrato…</p>}
          </div>

          {erro && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5">
              <p className="text-xs text-red-400">{erro}</p>
            </div>
          )}

          {preview && resumo && (
            <div className="rounded-lg border border-app-border2 bg-app-surface2 p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-app-subtle">
                {preview.banco && <span>Banco: <span className="text-app-text2 font-medium">{preview.banco}</span></span>}
                {preview.conta && <span>Conta: <span className="text-app-text2 font-medium">{preview.conta}</span></span>}
                {preview.periodoInicio && preview.periodoFim && (
                  <span>Período: <span className="text-app-text2 font-medium">{preview.periodoInicio} a {preview.periodoFim}</span></span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                  <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-medium mb-1"><ArrowUpCircle className="h-3.5 w-3.5" />{resumo.entradas.length} entrada(s)</div>
                  <p className="text-sm font-bold text-emerald-600">{formatCurrency(resumo.entradas.reduce((s, m) => s + m.valor, 0))}</p>
                </div>
                <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                  <div className="flex items-center gap-1.5 text-red-500 text-xs font-medium mb-1"><ArrowDownCircle className="h-3.5 w-3.5" />{resumo.saidas.length} saída(s)</div>
                  <p className="text-sm font-bold text-red-500">{formatCurrency(resumo.saidas.reduce((s, m) => s + m.valor, 0))}</p>
                </div>
              </div>
              {preview.truncado && (
                <p className="text-xs text-amber-600">O extrato tem muitas movimentações e a leitura pode ter sido cortada — confira o total acima contra o extrato original. Se faltar movimentação, tente importar um arquivo com período menor.</p>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-app-border">
          <button onClick={onClose} className="rounded-lg border border-app-border2 px-4 py-2 text-sm text-app-muted hover:bg-app-surface2 transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleConfirmar}
            disabled={!preview || importando}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            style={{ backgroundColor: GREEN }}
            onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = DARK_GREEN }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = GREEN }}
          >
            <Upload className="h-3.5 w-3.5" />
            {importando ? 'Importando…' : 'Confirmar importação'}
          </button>
        </div>
      </div>
    </div>
  )
}
