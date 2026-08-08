'use client'

import { useState, useMemo, useRef } from 'react'
import {
  Receipt, TrendingDown, CheckCircle2, AlertCircle, Clock,
  Filter, X, Plus, FolderOpen, Paperclip, ChevronDown, ChevronUp, Sparkles, Camera, Banknote, Pencil, Trash2,
  MessageSquareText, RefreshCw,
} from 'lucide-react'
import { useEspacos } from '@/contexts/EspacosContext'
import { useContasPagar } from '@/contexts/ContasPagarContext'
import { formatCurrency, parseCurrencyBR } from '@/lib/utils'
import { saveFile, getFiles, getFileUrl, hashFile } from '@/lib/file-storage'
import FileList from '@/components/shared/FileList'
import FileSearchModal from '@/components/shared/FileSearchModal'
import Toast from '@/components/shared/Toast'
import type { ContaPagar, CategoriaContaPagar, StatusContaPagar } from '@/types'

interface BoletoExtracao {
  descricao: string | null
  fornecedor: string | null
  valor: string | null
  vencimento: string | null
  dataPagamento: string | null
  horaPagamento: string | null
  formaPagamento: string | null
  chavePagamento: string | null
  instituicaoFinanceira: string | null
  identificadorTransacao: string | null
  espaco: string | null
  categoria: string | null
  subcategoria: string | null
  observacoes: string | null
  cnpj: string | null
}

// Parseia valor extraído pela IA (texto livre) — usa a mesma lógica robusta de
// parseCurrencyBR, que trata corretamente "16.000" (sem vírgula) como dezesseis mil.
function parseValorBR(valor: string): string {
  const n = parseCurrencyBR(valor)
  return n > 0 ? String(n) : ''
}

// Tolerante a variações que a IA às vezes devolve mesmo quando o prompt pede
// DD/MM/AAAA — dia/mês sem zero à esquerda ("5/8/2026"), ano com 2 dígitos ou
// separador "-". Sem isso, um formato levemente diferente falhava em silêncio
// e a data de pagamento caía pro fallback (hoje), em vez da data real do
// comprovante.
function parseDataBR(data: string): string {
  const match = data.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/)
  if (!match) return ''
  let [, dd, mm, yyyy] = match
  dd = dd.padStart(2, '0')
  mm = mm.padStart(2, '0')
  if (yyyy.length === 2) yyyy = `20${yyyy}`
  return `${yyyy}-${mm}-${dd}`
}

type RelerResultado =
  | { ok: true; dataPagamento?: string; horaPagamento?: string; instituicao?: string; identificador?: string }
  | { ok: false; motivo: 'sem-comprovante' | 'sem-data' | 'erro' }

// Baixa o comprovante já anexado a uma conta e roda a leitura por IA de novo —
// usado tanto pelo botão individual "Reler comprovante" quanto pela correção em
// lote, pra atualizar a data/hora real do pagamento de contas que já tiveram
// baixa registrada (a data de registro da baixa não muda).
async function relerComprovanteDaConta(conta: ContaPagar): Promise<RelerResultado> {
  const arquivos = await getFiles({ module: 'contas', entityId: conta.id, categoria: 'comprovante_pagamento' })
  if (arquivos.length === 0) return { ok: false, motivo: 'sem-comprovante' }
  const arquivo = arquivos[0]
  const url = await getFileUrl(arquivo.id)
  if (!url) return { ok: false, motivo: 'erro' }

  try {
    const respArquivo = await fetch(url)
    const blob = await respArquivo.blob()
    const file = new File([blob], arquivo.name, { type: arquivo.mimeType || blob.type })

    const body = new FormData()
    body.append('file', file)
    const res = await fetch('/api/extract-boleto', { method: 'POST', body })
    const data: BoletoExtracao & { error?: string } = await res.json()
    if (!res.ok || data.error) return { ok: false, motivo: 'erro' }
    if (!data.dataPagamento && !data.horaPagamento) return { ok: false, motivo: 'sem-data' }

    return {
      ok: true,
      dataPagamento: data.dataPagamento ? parseDataBR(data.dataPagamento) || undefined : undefined,
      horaPagamento: data.horaPagamento ?? undefined,
      instituicao: data.instituicaoFinanceira ?? undefined,
      identificador: data.identificadorTransacao ?? undefined,
    }
  } catch {
    return { ok: false, motivo: 'erro' }
  }
}

const GREEN = '#25D366'

const statusBadge: Record<StatusContaPagar, string> = {
  pago:      'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  pendente:  'bg-amber-500/10 text-amber-600 border-amber-500/20',
  atrasado:  'bg-red-500/10 text-red-600 border-red-500/20',
}
const statusLabel: Record<StatusContaPagar, string> = { pago: 'Pago', pendente: 'Pendente', atrasado: 'Atrasado' }

// "atrasado" não é um valor gravado no banco — é calculado a partir do vencimento,
// pra toda conta pendente vencida virar "Em atraso" automaticamente, sem precisar
// de um job rodando. Só "pago" é um estado que precisa ser confirmado manualmente.
function statusEfetivo(conta: ContaPagar): StatusContaPagar {
  if (conta.status === 'pago') return 'pago'
  const hoje = new Date().toISOString().split('T')[0]
  return conta.dataVencimento < hoje ? 'atrasado' : 'pendente'
}

const CATEGORIAS: CategoriaContaPagar[] = ['operacional', 'obra', 'financeiro', 'retirada_socio']
const categoriaLabel: Record<CategoriaContaPagar, string> = {
  operacional: 'Operacional', obra: 'Obra', financeiro: 'Financeiro', retirada_socio: 'Retirada Sócio',
}
const categoriaBadge: Record<CategoriaContaPagar, string> = {
  operacional: 'bg-sky-500/10 text-sky-600', obra: 'bg-orange-500/10 text-orange-600', financeiro: 'bg-emerald-500/10 text-emerald-600',
  retirada_socio: 'bg-violet-500/10 text-violet-600',
}

const SUBCATEGORIAS: string[] = ['aluguel', 'energia', 'internet', 'funcionários', 'manutenção', 'fornecedores', 'extras', 'outros']
const subcategoriaLabel: Record<string, string> = {
  aluguel: 'Aluguel', energia: 'Energia', internet: 'Internet', funcionários: 'Funcionários',
  manutenção: 'Manutenção', fornecedores: 'Fornecedores', extras: 'Extras', outros: 'Outros',
}
const subcategoriaBadge: Record<string, string> = {
  aluguel: 'bg-violet-500/10 text-violet-600', energia: 'bg-yellow-500/10 text-yellow-600',
  internet: 'bg-sky-500/10 text-sky-600', funcionários: 'bg-blue-500/10 text-blue-600',
  manutenção: 'bg-orange-500/10 text-orange-600', fornecedores: 'bg-teal-500/10 text-teal-600',
  extras: 'bg-zinc-500/10 text-zinc-600', outros: 'bg-slate-500/10 text-slate-600',
}

interface FormState {
  descricao: string
  valor: string
  dataVencimento: string
  categoria: CategoriaContaPagar | ''
  subcategoria: string
  espaco: string
  fornecedor: string
  observacoes: string
  textoOrigemWhatsapp: string
  dataPagamento: string
  horaPagamento: string
}

const FORM_EMPTY: FormState = {
  descricao: '', valor: '', dataVencimento: '', categoria: '', subcategoria: '',
  espaco: '', fornecedor: '', observacoes: '', textoOrigemWhatsapp: '',
  dataPagamento: '', horaPagamento: '',
}

function contaParaForm(conta: ContaPagar): FormState {
  return {
    descricao: conta.descricao,
    valor: String(conta.valor),
    dataVencimento: conta.dataVencimento,
    categoria: conta.categoria,
    subcategoria: conta.subcategoria,
    espaco: conta.espaco,
    fornecedor: conta.fornecedor ?? '',
    observacoes: conta.observacoes ?? '',
    textoOrigemWhatsapp: conta.textoOrigemWhatsapp ?? '',
    dataPagamento: conta.dataPagamento ?? '',
    horaPagamento: conta.horaPagamento ?? '',
  }
}

export default function ContasPagarPage() {
  const { espacosNomes } = useEspacos()
  const { contas, addConta, updateConta, deleteConta, darBaixa, corrigirDataPagamento } = useContasPagar()
  const [contaBaixa,        setContaBaixa]        = useState<ContaPagar | null>(null)
  const [contaEditando,     setContaEditando]     = useState<ContaPagar | null>(null)
  const [contaExcluindo,    setContaExcluindo]    = useState<ContaPagar | null>(null)
  const [tab,               setTab]               = useState<'apagar' | 'pagas' | 'atraso'>('apagar')
  const [filterEspaco,      setFilterEspaco]      = useState('')
  const [filterCategoria,   setFilterCategoria]   = useState<CategoriaContaPagar | ''>('')
  const [filterSubcategoria,setFilterSubcategoria]= useState('')
  const [filterVencDe,      setFilterVencDe]      = useState('')
  const [filterVencAte,     setFilterVencAte]     = useState('')
  const [filterPagDe,       setFilterPagDe]       = useState('')
  const [filterPagAte,      setFilterPagAte]      = useState('')
  const [filterFornecedor,  setFilterFornecedor]  = useState('')
  const [filterValorMin,    setFilterValorMin]    = useState('')
  const [filterValorMax,    setFilterValorMax]    = useState('')
  const [novaContaOpen,     setNovaContaOpen]     = useState(false)
  const [docModalOpen,      setDocModalOpen]      = useState(false)
  const [excluindo,         setExcluindo]         = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [relendoId,    setRelendoId]    = useState<string | null>(null)
  const [relendoTodas, setRelendoTodas] = useState(false)
  const [resultadoRelerTodas, setResultadoRelerTodas] = useState<string | null>(null)

  function showToast(msg: string) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3500)
  }

  const todasContas = contas

  async function handleReler(conta: ContaPagar) {
    setRelendoId(conta.id)
    try {
      const resultado = await relerComprovanteDaConta(conta)
      if (!resultado.ok) {
        showToast(
          resultado.motivo === 'sem-comprovante' ? 'Essa conta não tem comprovante anexado.' :
          resultado.motivo === 'sem-data' ? 'A IA não identificou data/hora neste comprovante.' :
          'Não foi possível reler o comprovante.'
        )
        return
      }
      // Só atualiza a data se a IA realmente identificou uma no comprovante —
      // nunca cai pro vencimento ou pra qualquer outra data como substituto.
      await corrigirDataPagamento(
        conta.id,
        resultado.dataPagamento,
        resultado.horaPagamento,
        resultado.instituicao,
        resultado.identificador,
      )
      showToast(resultado.dataPagamento ? 'Data de pagamento atualizada pelo comprovante.' : 'Comprovante lido, mas sem data identificada com segurança.')
    } finally {
      setRelendoId(null)
    }
  }

  // Corrige em lote as contas já pagas cuja data/hora exibida foi registrada como
  // a data da baixa em vez da data real do comprovante — relê cada comprovante
  // já anexado e atualiza. Roda uma de cada vez (não em paralelo) pra não
  // sobrecarregar a IA.
  async function handleRelerTodas() {
    setRelendoTodas(true)
    setResultadoRelerTodas(null)
    let corrigidas = 0, semComprovante = 0, semData = 0, erros = 0
    const contasPagas = todasContas.filter(c => statusEfetivo(c) === 'pago')
    for (const c of contasPagas) {
      const resultado = await relerComprovanteDaConta(c)
      if (!resultado.ok) {
        if (resultado.motivo === 'sem-comprovante') semComprovante++
        else if (resultado.motivo === 'sem-data') semData++
        else erros++
        continue
      }
      // Idem — nunca substitui por vencimento ou outra data quando a IA não
      // identificou a data real do pagamento no comprovante.
      await corrigirDataPagamento(
        c.id,
        resultado.dataPagamento,
        resultado.horaPagamento,
        resultado.instituicao,
        resultado.identificador,
      )
      corrigidas++
    }
    setResultadoRelerTodas(`${corrigidas} corrigida(s) · ${semComprovante} sem comprovante · ${semData} sem data identificada no comprovante · ${erros} com erro`)
    setRelendoTodas(false)
  }

  const filtered = useMemo(() => todasContas.filter(c => {
    const status = statusEfetivo(c)
    if (tab === 'apagar' && status === 'pago') return false
    if (tab === 'pagas'  && status !== 'pago') return false
    if (tab === 'atraso' && status !== 'atrasado') return false
    if (filterEspaco       && c.espaco       !== filterEspaco)       return false
    if (filterCategoria    && c.categoria    !== filterCategoria)    return false
    if (filterSubcategoria && c.subcategoria !== filterSubcategoria) return false
    if (filterVencDe       && c.dataVencimento < filterVencDe)       return false
    if (filterVencAte      && c.dataVencimento > filterVencAte)      return false
    if (filterPagDe        && (!c.dataPagamento || c.dataPagamento < filterPagDe))  return false
    if (filterPagAte       && (!c.dataPagamento || c.dataPagamento > filterPagAte)) return false
    if (filterFornecedor   && !(c.fornecedor ?? '').toLowerCase().includes(filterFornecedor.toLowerCase())) return false
    if (filterValorMin     && c.valor < parseCurrencyBR(filterValorMin)) return false
    if (filterValorMax     && c.valor > parseCurrencyBR(filterValorMax)) return false
    return true
  }), [todasContas, tab, filterEspaco, filterCategoria, filterSubcategoria, filterVencDe, filterVencAte, filterPagDe, filterPagAte, filterFornecedor, filterValorMin, filterValorMax])

  const porCategoria = CATEGORIAS.map(cat => ({ categoria: cat, rows: filtered.filter(c => c.categoria === cat) }))

  // Contas Pagas não agrupa por categoria — uma lista única, mais recente primeiro,
  // pela data e hora reais do pagamento (não a data de cadastro da conta).
  const pagasOrdenadas = useMemo(() => [...filtered].sort((a, b) => {
    const chaveA = `${a.dataPagamento ?? ''}T${a.horaPagamento ?? '00:00'}`
    const chaveB = `${b.dataPagamento ?? ''}T${b.horaPagamento ?? '00:00'}`
    return chaveB.localeCompare(chaveA)
  }), [filtered])

  const totalPago     = todasContas.filter(c => statusEfetivo(c) === 'pago').reduce((s, c) => s + c.valor, 0)
  const totalPendente = todasContas.filter(c => statusEfetivo(c) === 'pendente').reduce((s, c) => s + c.valor, 0)
  const totalAtrasado = todasContas.filter(c => statusEfetivo(c) === 'atrasado').reduce((s, c) => s + c.valor, 0)
  const totalGeral    = todasContas.reduce((s, c) => s + c.valor, 0)

  const hasFilters = !!(filterEspaco || filterCategoria || filterSubcategoria || filterVencDe || filterVencAte || filterPagDe || filterPagAte || filterFornecedor || filterValorMin || filterValorMax)
  function clearFilters() {
    setFilterEspaco(''); setFilterCategoria(''); setFilterSubcategoria('')
    setFilterVencDe(''); setFilterVencAte(''); setFilterPagDe(''); setFilterPagAte('')
    setFilterFornecedor(''); setFilterValorMin(''); setFilterValorMax('')
  }

  async function handleExcluirConfirmado() {
    if (!contaExcluindo) return
    setExcluindo(true)
    try {
      await deleteConta(contaExcluindo.id)
      setContaExcluindo(null)
      showToast('Conta excluída.')
    } catch (err) {
      showToast(err instanceof Error ? `Falha ao excluir: ${err.message}` : 'Falha ao excluir a conta.')
    } finally {
      setExcluindo(false)
    }
  }

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-xl border border-app-border bg-app-surface p-4">
          <div className="flex items-center gap-2 mb-2"><TrendingDown className="h-4 w-4 text-app-muted" /><span className="text-xs text-app-muted">Total Geral</span></div>
          <p className="text-xl font-bold text-app-text">{formatCurrency(totalGeral)}</p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <div className="flex items-center gap-2 mb-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" /><span className="text-xs text-emerald-600">Pagas</span></div>
          <p className="text-xl font-bold text-emerald-600">{formatCurrency(totalPago)}</p>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 mb-2"><Clock className="h-4 w-4 text-amber-500" /><span className="text-xs text-amber-600">Pendentes</span></div>
          <p className="text-xl font-bold text-amber-600">{formatCurrency(totalPendente)}</p>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <div className="flex items-center gap-2 mb-2"><AlertCircle className="h-4 w-4 text-red-500" /><span className="text-xs text-red-600">Atrasadas</span></div>
          <p className="text-xl font-bold text-red-600">{formatCurrency(totalAtrasado)}</p>
        </div>
      </div>

      {/* Ações */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setNovaContaOpen(true)}
          className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-opacity"
          style={{ backgroundColor: GREEN }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#128C7E' }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = GREEN }}
        >
          <Plus className="h-4 w-4" />
          Nova Conta
        </button>
        <button
          onClick={() => setDocModalOpen(true)}
          className="flex items-center gap-1.5 rounded-lg border border-app-border2 bg-app-surface px-4 py-2 text-sm font-medium text-app-text hover:bg-app-surface2 transition-colors"
        >
          <FolderOpen className="h-4 w-4 text-[#25D366]" />
          Ver documentos
        </button>
      </div>

      {/* Tabela */}
      <div className="rounded-xl border border-app-border bg-app-surface">
        {/* Tabs */}
        <div className="flex items-center justify-between px-5 pt-4 pb-0 border-b border-app-border">
          <div className="flex gap-1">
            {(['apagar', 'pagas', 'atraso'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  tab === t ? 'border-[#25D366] text-[#128C7E]' : 'border-transparent text-app-muted hover:text-app-text'
                }`}
              >
                <span className="flex items-center gap-2">
                  {t === 'apagar' ? <Receipt className="h-3.5 w-3.5" /> : t === 'pagas' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                  {t === 'apagar' ? 'Contas a Pagar' : t === 'pagas' ? 'Contas Pagas' : 'Em Atraso'}
                  <span className={`rounded-full text-xs px-1.5 py-0.5 ${t === 'apagar' ? 'bg-amber-500/15 text-amber-600' : t === 'pagas' ? 'bg-emerald-500/15 text-emerald-600' : 'bg-red-500/15 text-red-600'}`}>
                    {t === 'apagar' ? todasContas.filter(c => statusEfetivo(c) !== 'pago').length : t === 'pagas' ? todasContas.filter(c => statusEfetivo(c) === 'pago').length : todasContas.filter(c => statusEfetivo(c) === 'atrasado').length}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Filtros — combináveis entre si */}
        <div className="px-5 py-3 border-b border-app-border bg-app-surface2/30 space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-app-subtle">
            <Filter className="h-3.5 w-3.5 shrink-0" />
            Filtros
            {hasFilters && (
              <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-app-muted hover:text-red-500 transition-colors ml-auto">
                <X className="h-3.5 w-3.5" />Limpar filtros
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
            <FiltroSelect label="Espaço" value={filterEspaco} onChange={setFilterEspaco}
              options={[['', 'Todos os espaços'], ['Todos', 'Geral (Todos)'], ...espacosNomes.map(e => [e, e] as [string, string])]} />
            <FiltroSelect label="Categoria" value={filterCategoria} onChange={v => setFilterCategoria(v as CategoriaContaPagar | '')}
              options={[['', 'Todas as categorias'], ...CATEGORIAS.map(c => [c, categoriaLabel[c]] as [string, string])]} />
            <FiltroSelect label="Subcategoria" value={filterSubcategoria} onChange={setFilterSubcategoria}
              options={[['', 'Todas subcategorias'], ...SUBCATEGORIAS.map(s => [s, subcategoriaLabel[s]] as [string, string])]} />
            <FiltroTexto label="Fornecedor/Beneficiário" value={filterFornecedor} onChange={setFilterFornecedor} placeholder="Buscar por nome…" />
            <FiltroData label="Vencimento — de" value={filterVencDe} onChange={setFilterVencDe} />
            <FiltroData label="Vencimento — até" value={filterVencAte} onChange={setFilterVencAte} />
            <FiltroData label="Pagamento — de" value={filterPagDe} onChange={setFilterPagDe} />
            <FiltroData label="Pagamento — até" value={filterPagAte} onChange={setFilterPagAte} />
            <FiltroValor label="Valor — mínimo" value={filterValorMin} onChange={setFilterValorMin} />
            <FiltroValor label="Valor — máximo" value={filterValorMax} onChange={setFilterValorMax} />
          </div>
        </div>

        {/* Lista */}
        <div className="p-5 space-y-6">
          {tab === 'pagas' && (
            <div className="flex items-center justify-between gap-2 flex-wrap -mt-1">
              <button onClick={handleRelerTodas} disabled={relendoTodas}
                className="flex items-center gap-1.5 rounded-lg border border-app-border2 px-3 py-1.5 text-xs font-medium text-app-muted hover:bg-app-surface2 hover:text-app-text transition-colors disabled:opacity-60">
                <RefreshCw className={`h-3.5 w-3.5 ${relendoTodas ? 'animate-spin' : ''}`} />
                {relendoTodas ? 'Relendo comprovantes…' : 'Recalcular datas de todas pelos comprovantes'}
              </button>
              {resultadoRelerTodas && <span className="text-xs text-app-subtle">{resultadoRelerTodas}</span>}
            </div>
          )}

          {tab === 'pagas' ? (
            pagasOrdenadas.length > 0 && (
              <div className="space-y-2">
                {pagasOrdenadas.map(conta => (
                  <ContaRow
                    key={conta.id}
                    conta={conta}
                    onDarBaixa={() => setContaBaixa(conta)}
                    onEditar={() => setContaEditando(conta)}
                    onExcluir={() => setContaExcluindo(conta)}
                    onReler={() => handleReler(conta)}
                    relendo={relendoId === conta.id || relendoTodas}
                  />
                ))}
              </div>
            )
          ) : (
            porCategoria.map(({ categoria, rows }) =>
              rows.length > 0 && (
                <section key={categoria}>
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-app-subtle">{categoriaLabel[categoria]}</h3>
                    <span className="text-xs text-app-subtle">— {formatCurrency(rows.reduce((s, c) => s + c.valor, 0))}</span>
                  </div>
                  <div className="space-y-2">
                    {rows.map(conta => (
                      <ContaRow
                        key={conta.id}
                        conta={conta}
                        onDarBaixa={() => setContaBaixa(conta)}
                        onEditar={() => setContaEditando(conta)}
                        onExcluir={() => setContaExcluindo(conta)}
                        onReler={() => handleReler(conta)}
                        relendo={relendoId === conta.id}
                      />
                    ))}
                  </div>
                </section>
              )
            )
          )}

          {filtered.length === 0 && (
            <p className="text-sm text-app-subtle text-center py-8">Nenhuma conta encontrada.</p>
          )}

          {filtered.length > 0 && (
            <div className="flex justify-between items-center pt-3 border-t border-app-border">
              <span className="text-xs text-app-muted">{filtered.length} contas</span>
              <span className="text-sm font-bold text-app-text">Total: {formatCurrency(filtered.reduce((s, c) => s + c.valor, 0))}</span>
            </div>
          )}
        </div>
      </div>

      {/* Modal Nova Conta */}
      {novaContaOpen && (
        <ContaFormModal
          onClose={() => setNovaContaOpen(false)}
          onSave={async conta => { await addConta(conta); showToast('Conta cadastrada com sucesso.') }}
        />
      )}

      {/* Modal Editar Conta */}
      {contaEditando && (
        <ContaFormModal
          conta={contaEditando}
          onClose={() => setContaEditando(null)}
          onSave={async conta => { await updateConta(conta); showToast('Conta atualizada com sucesso.') }}
        />
      )}

      {/* Confirmação de exclusão */}
      {contaExcluindo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setContaExcluindo(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-app-border bg-app-surface p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-app-text mb-2">Excluir conta?</h3>
            <p className="text-sm text-app-muted mb-5">
              "{contaExcluindo.descricao}" — {formatCurrency(contaExcluindo.valor)}. Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setContaExcluindo(null)} disabled={excluindo}
                className="rounded-lg border border-app-border2 px-4 py-2 text-sm text-app-muted hover:bg-app-surface2 transition-colors disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={handleExcluirConfirmado} disabled={excluindo}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 transition-colors disabled:opacity-50">
                {excluindo ? 'Excluindo…' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {docModalOpen && <FileSearchModal onClose={() => setDocModalOpen(false)} defaultModule="contas" />}
      {contaBaixa && (
        <DarBaixaModal
          conta={contaBaixa}
          onClose={() => setContaBaixa(null)}
          onConfirm={async (dataPagamento, horaPagamento, comprovanteInstituicao, comprovanteIdentificador) => {
            await darBaixa(contaBaixa.id, dataPagamento, horaPagamento, comprovanteInstituicao, comprovanteIdentificador)
            setContaBaixa(null)
            showToast('Conta marcada como paga.')
          }}
        />
      )}
      <Toast message={toastMsg} />
    </div>
  )
}

function FiltroSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div>
      <label className="block text-[11px] text-app-subtle mb-0.5">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full cursor-pointer rounded-lg border border-app-border2 bg-app-surface px-2.5 py-1.5 text-xs text-app-text focus:outline-none"
        onFocus={e => { e.currentTarget.style.borderColor = GREEN }}
        onBlur={e => { e.currentTarget.style.borderColor = '' }}
      >
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  )
}

function FiltroTexto({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-[11px] text-app-subtle mb-0.5">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-lg border border-app-border2 bg-app-surface px-2.5 py-1.5 text-xs text-app-text focus:outline-none"
        onFocus={e => { e.currentTarget.style.borderColor = GREEN }}
        onBlur={e => { e.currentTarget.style.borderColor = '' }}
      />
    </div>
  )
}

function FiltroData({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-[11px] text-app-subtle mb-0.5">{label}</label>
      <input type="date" value={value} onChange={e => onChange(e.target.value)}
        className="w-full rounded-lg border border-app-border2 bg-app-surface px-2.5 py-1.5 text-xs text-app-text focus:outline-none"
        onFocus={e => { e.currentTarget.style.borderColor = GREEN }}
        onBlur={e => { e.currentTarget.style.borderColor = '' }}
      />
    </div>
  )
}

function FiltroValor({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-[11px] text-app-subtle mb-0.5">{label}</label>
      <input type="text" inputMode="decimal" value={value} onChange={e => onChange(e.target.value)} placeholder="0,00"
        className="w-full rounded-lg border border-app-border2 bg-app-surface px-2.5 py-1.5 text-xs text-app-text focus:outline-none"
        onFocus={e => { e.currentTarget.style.borderColor = GREEN }}
        onBlur={e => { e.currentTarget.style.borderColor = '' }}
      />
    </div>
  )
}

interface ContaFormModalProps {
  conta?: ContaPagar
  onClose: () => void
  onSave: (c: ContaPagar) => Promise<void>
}

function ContaFormModal({ conta, onClose, onSave }: ContaFormModalProps) {
  const { espacosNomes } = useEspacos()
  const isEdit = !!conta
  const [form, setForm] = useState<FormState>(() => conta ? contaParaForm(conta) : { ...FORM_EMPTY, espaco: espacosNomes[0] ?? '' })
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [extraindoIA, setExtraindoIA] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [colarTextoAberto, setColarTextoAberto] = useState(false)
  const [textoWhatsapp, setTextoWhatsapp] = useState('')

  const subOpts = SUBCATEGORIAS

  // Compartilhado entre o anexo (PDF/foto) e o texto colado do WhatsApp — os dois
  // caem no mesmo endpoint e preenchem os mesmos campos do formulário.
  async function processarExtracao(body: FormData, origemTexto?: string) {
    setErro(null)
    setExtraindoIA(true)
    try {
      body.append('espacos', JSON.stringify(espacosNomes))
      const res = await fetch('/api/extract-boleto', { method: 'POST', body })
      const data: BoletoExtracao & { error?: string } = await res.json()

      if (!res.ok || data.error) {
        setErro(data.error ?? 'Não foi possível ler o conteúdo com a IA.')
        return
      }

      if (!data.vencimento && !data.valor && !data.fornecedor && !data.descricao) {
        setErro('A IA não conseguiu identificar os dados. Preencha os campos manualmente.')
        return
      }

      // Forma de pagamento / chave / data de pagamento não têm campo próprio no
      // formulário — entram como observação, sem marcar a conta como paga
      // automaticamente (dar baixa continua exigindo comprovante, à parte).
      const notasExtras = [
        data.formaPagamento ? `Forma de pagamento: ${data.formaPagamento}` : null,
        data.chavePagamento ? `Chave/dados de pagamento: ${data.chavePagamento}` : null,
        data.dataPagamento ? `Pagamento informado no texto: ${data.dataPagamento}` : null,
        data.observacoes ?? null,
      ].filter((n): n is string => !!n).join('\n')

      setForm(f => ({
        ...f,
        descricao: data.descricao ?? f.descricao,
        dataVencimento: data.vencimento ? parseDataBR(data.vencimento) || f.dataVencimento : f.dataVencimento,
        valor: data.valor ? parseValorBR(data.valor) || f.valor : f.valor,
        fornecedor: data.fornecedor ?? f.fornecedor,
        espaco: data.espaco ?? f.espaco,
        categoria: (data.categoria as CategoriaContaPagar | null) ?? f.categoria,
        subcategoria: data.subcategoria ?? f.subcategoria,
        observacoes: notasExtras ? [f.observacoes, notasExtras].filter(Boolean).join('\n') : f.observacoes,
        textoOrigemWhatsapp: origemTexto ?? f.textoOrigemWhatsapp,
      }))
    } catch {
      setErro('Falha ao conectar com a IA. Preencha os campos manualmente.')
    } finally {
      setExtraindoIA(false)
    }
  }

  async function handleAnexoSelecionado(file: File | null) {
    setPendingFile(file)
    if (!file) return

    const ext = file.name.split('.').pop()?.toLowerCase()
    const isPdf = file.type === 'application/pdf' || ext === 'pdf'
    const isImage = file.type.startsWith('image/')

    if (file.type === 'image/heic' || file.type === 'image/heif') {
      setErro('Fotos em formato HEIC não são lidas pela IA — use o botão "Tirar foto" aqui do formulário (gera JPEG) ou converta o arquivo antes de anexar.')
      return
    }
    if (!isPdf && !isImage) {
      setErro('A leitura automática funciona só com PDF ou imagem. O arquivo foi anexado, mas preencha os campos manualmente.')
      return
    }

    const body = new FormData()
    body.append('file', file)
    await processarExtracao(body)
  }

  async function handleTextoWhatsapp() {
    if (!textoWhatsapp.trim()) return
    const body = new FormData()
    body.append('text', textoWhatsapp.trim())
    await processarExtracao(body, textoWhatsapp.trim())
    setColarTextoAberto(false)
    setTextoWhatsapp('')
  }

  async function handleSalvar() {
    if (!form.descricao || !form.valor || !form.dataVencimento || !form.categoria || !form.subcategoria) return
    setSaving(true)
    setErro(null)
    const id = conta?.id ?? crypto.randomUUID()
    const payload: ContaPagar = {
      id,
      descricao:       form.descricao,
      espaco:          form.espaco as ContaPagar['espaco'],
      categoria:       form.categoria as CategoriaContaPagar,
      subcategoria:    form.subcategoria as ContaPagar['subcategoria'],
      valor:           parseCurrencyBR(form.valor),
      status:          conta?.status ?? 'pendente',
      dataVencimento:  form.dataVencimento,
      dataPagamento:   form.dataPagamento || undefined,
      horaPagamento:   form.horaPagamento || undefined,
      comprovanteInstituicao:   conta?.comprovanteInstituicao,
      comprovanteIdentificador: conta?.comprovanteIdentificador,
      fornecedor:      form.fornecedor || undefined,
      observacoes:     form.observacoes || undefined,
      textoOrigemWhatsapp: form.textoOrigemWhatsapp || undefined,
    }
    try {
      if (pendingFile) {
        await saveFile(pendingFile, {
          module:     'contas',
          entityId:   id,
          entityName: form.descricao,
          espaco:     form.espaco,
        })
      }
      await onSave(payload)
      onClose()
    } catch (err) {
      setErro(err instanceof Error ? `Falha ao salvar: ${err.message}` : 'Falha ao salvar a conta. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-app-surface rounded-2xl border border-app-border shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-app-border sticky top-0 bg-app-surface z-10">
          <h2 className="text-sm font-semibold text-app-text flex items-center gap-2">
            {isEdit ? <Pencil className="h-4 w-4 text-[#25D366]" /> : <Receipt className="h-4 w-4 text-[#25D366]" />}
            {isEdit ? 'Editar Conta a Pagar' : 'Nova Conta a Pagar'}
          </h2>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-app-subtle hover:bg-app-surface2 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-app-muted mb-1">Descrição *</label>
            <input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              placeholder="Ex: Aluguel Usine — Jul/2026"
              className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-3 py-1.5 text-sm text-app-text focus:outline-none"
              onFocus={e => { e.currentTarget.style.borderColor = GREEN }}
              onBlur={e => { e.currentTarget.style.borderColor = '' }}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-app-muted mb-1">Valor (R$) *</label>
              <input type="text" inputMode="decimal" value={form.valor}
                onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
                placeholder="0,00"
                className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-3 py-1.5 text-sm text-app-text focus:outline-none"
                onFocus={e => { e.currentTarget.style.borderColor = GREEN }}
                onBlur={e => { e.currentTarget.style.borderColor = '' }}
              />
            </div>
            <div>
              <label className="block text-xs text-app-muted mb-1">Vencimento *</label>
              <input type="date" value={form.dataVencimento}
                onChange={e => setForm(f => ({ ...f, dataVencimento: e.target.value }))}
                className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-3 py-1.5 text-sm text-app-text focus:outline-none"
                onFocus={e => { e.currentTarget.style.borderColor = GREEN }}
                onBlur={e => { e.currentTarget.style.borderColor = '' }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-app-muted mb-1">Tipo de despesa *</label>
              <select value={form.categoria}
                onChange={e => setForm(f => ({ ...f, categoria: e.target.value as CategoriaContaPagar | '' }))}
                className="w-full cursor-pointer rounded-lg border border-app-border2 bg-app-surface2 px-3 py-1.5 text-sm text-app-text focus:outline-none"
                onFocus={e => { e.currentTarget.style.borderColor = GREEN }}
                onBlur={e => { e.currentTarget.style.borderColor = '' }}
              >
                <option value="">Selecionar…</option>
                {CATEGORIAS.map(c => <option key={c} value={c}>{categoriaLabel[c]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-app-muted mb-1">Subcategoria *</label>
              <select value={form.subcategoria}
                onChange={e => setForm(f => ({ ...f, subcategoria: e.target.value }))}
                className="w-full cursor-pointer rounded-lg border border-app-border2 bg-app-surface2 px-3 py-1.5 text-sm text-app-text focus:outline-none"
                onFocus={e => { e.currentTarget.style.borderColor = GREEN }}
                onBlur={e => { e.currentTarget.style.borderColor = '' }}
              >
                <option value="">Selecionar…</option>
                {subOpts.map(s => <option key={s} value={s}>{subcategoriaLabel[s]}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-app-muted mb-1">Espaço vinculado *</label>
              <select value={form.espaco} onChange={e => setForm(f => ({ ...f, espaco: e.target.value }))}
                className="w-full cursor-pointer rounded-lg border border-app-border2 bg-app-surface2 px-3 py-1.5 text-sm text-app-text focus:outline-none"
                onFocus={e => { e.currentTarget.style.borderColor = GREEN }}
                onBlur={e => { e.currentTarget.style.borderColor = '' }}
              >
                <option value="Todos">Todos (Geral)</option>
                {espacosNomes.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-app-muted mb-1">Beneficiário</label>
              <input value={form.fornecedor} onChange={e => setForm(f => ({ ...f, fornecedor: e.target.value }))}
                placeholder="Nome do beneficiário"
                className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-3 py-1.5 text-sm text-app-text focus:outline-none"
                onFocus={e => { e.currentTarget.style.borderColor = GREEN }}
                onBlur={e => { e.currentTarget.style.borderColor = '' }}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-app-muted mb-1">Observações</label>
            <textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
              rows={2} placeholder="Observações adicionais…"
              className="w-full resize-none rounded-lg border border-app-border2 bg-app-surface2 px-3 py-1.5 text-sm text-app-text focus:outline-none"
              onFocus={e => { e.currentTarget.style.borderColor = GREEN }}
              onBlur={e => { e.currentTarget.style.borderColor = '' }}
            />
          </div>

          {isEdit && conta?.status === 'pago' ? (
            <div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-app-muted mb-1">Data do pagamento</label>
                  <input type="date" value={form.dataPagamento} onChange={e => setForm(f => ({ ...f, dataPagamento: e.target.value }))}
                    className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-3 py-1.5 text-sm text-app-text focus:outline-none"
                    onFocus={e => { e.currentTarget.style.borderColor = GREEN }}
                    onBlur={e => { e.currentTarget.style.borderColor = '' }}
                  />
                </div>
                <div>
                  <label className="block text-xs text-app-muted mb-1">Hora do pagamento</label>
                  <input type="time" value={form.horaPagamento} onChange={e => setForm(f => ({ ...f, horaPagamento: e.target.value }))}
                    className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-3 py-1.5 text-sm text-app-text focus:outline-none"
                    onFocus={e => { e.currentTarget.style.borderColor = GREEN }}
                    onBlur={e => { e.currentTarget.style.borderColor = '' }}
                  />
                </div>
              </div>
              <p className="text-xs text-app-subtle italic mt-1">
                Preenchidos automaticamente pela leitura do comprovante — corrija aqui se a leitura errou ou não identificou. Isso também reordena a conta em "Contas Pagas".
              </p>
              <p className="text-xs text-app-subtle italic mt-2">Status não é alterado aqui.</p>
            </div>
          ) : isEdit && (
            <p className="text-xs text-app-subtle italic">
              Status e data de pagamento não são alterados aqui — use "Dar baixa" na lista para marcar como paga (exige comprovante).
            </p>
          )}

          {/* Anexo */}
          <div>
            <label className="block text-xs text-app-muted mb-1">Documento (opcional)</label>
            <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.xlsx,.doc,.docx" className="hidden"
              onChange={e => handleAnexoSelecionado(e.target.files?.[0] ?? null)} />
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={e => handleAnexoSelecionado(e.target.files?.[0] ?? null)} />
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => fileRef.current?.click()} disabled={extraindoIA}
                className="flex items-center gap-1.5 rounded-lg border border-app-border2 px-3 py-1.5 text-xs text-app-muted hover:bg-app-surface2 transition-colors disabled:opacity-60">
                <Paperclip className="h-3.5 w-3.5" />
                {pendingFile ? pendingFile.name : 'Selecionar arquivo…'}
              </button>
              <button onClick={() => cameraRef.current?.click()} disabled={extraindoIA}
                className="flex items-center gap-1.5 rounded-lg border border-app-border2 px-3 py-1.5 text-xs text-app-muted hover:bg-app-surface2 transition-colors disabled:opacity-60">
                <Camera className="h-3.5 w-3.5" />
                Tirar foto
              </button>
              <button onClick={() => setColarTextoAberto(v => !v)} disabled={extraindoIA}
                className="flex items-center gap-1.5 rounded-lg border border-app-border2 px-3 py-1.5 text-xs text-app-muted hover:bg-app-surface2 transition-colors disabled:opacity-60">
                <MessageSquareText className="h-3.5 w-3.5" />
                Colar Texto WhatsApp
              </button>
              {pendingFile && !extraindoIA && (
                <button onClick={() => { setPendingFile(null); if (fileRef.current) fileRef.current.value = '' }}
                  className="text-xs text-red-500 hover:underline">remover</button>
              )}
              {extraindoIA && (
                <span className="flex items-center gap-1.5 text-xs text-[#128C7E]">
                  <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                  Analisando com IA…
                </span>
              )}
            </div>
            {colarTextoAberto && (
              <div className="space-y-2 pt-2">
                <textarea
                  value={textoWhatsapp}
                  onChange={e => setTextoWhatsapp(e.target.value)}
                  rows={5}
                  placeholder="Cole aqui a Ordem de Serviço/Pagamento recebida pelo WhatsApp…"
                  className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none resize-none"
                />
                <button
                  onClick={handleTextoWhatsapp}
                  disabled={extraindoIA || !textoWhatsapp.trim()}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  style={{ backgroundColor: GREEN }}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Extrair dados do texto
                </button>
              </div>
            )}
            {form.textoOrigemWhatsapp && !colarTextoAberto && (
              <p className="text-xs text-app-subtle italic mt-1.5">Texto do WhatsApp usado no preenchimento fica salvo com esta conta.</p>
            )}
          </div>

          {erro && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5">
              <p className="text-xs text-red-400">{erro}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-app-border">
          <button onClick={onClose}
            className="rounded-lg border border-app-border2 px-4 py-2 text-sm text-app-muted hover:bg-app-surface2 transition-colors">
            Cancelar
          </button>
          <button onClick={handleSalvar} disabled={saving || !form.descricao || !form.valor || !form.dataVencimento || !form.categoria || !form.subcategoria}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            style={{ backgroundColor: GREEN }}>
            {saving ? 'Salvando…' : isEdit ? 'Salvar alterações' : 'Salvar conta'}
          </button>
        </div>
      </div>
    </div>
  )
}

const COMPROVANTE_DUPLICADO_MSG = 'Este comprovante já foi utilizado para dar baixa em outra conta. Verifique para evitar pagamentos ou lançamentos duplicados.'

function DarBaixaModal({ conta, onClose, onConfirm }: {
  conta: ContaPagar
  onClose: () => void
  onConfirm: (dataPagamento: string, horaPagamento?: string, comprovanteInstituicao?: string, comprovanteIdentificador?: string) => Promise<void>
}) {
  const { contas: todasContas } = useContasPagar()
  // Sem valor padrão de propósito: a Data de Pagamento só pode vir do comprovante
  // (ou do preenchimento manual do usuário) — nunca da data de hoje/da baixa.
  const [dataPagamento, setDataPagamento] = useState('')
  const [horaPagamento, setHoraPagamento] = useState('')
  const [instituicao, setInstituicao] = useState('')
  const [identificador, setIdentificador] = useState('')
  const [comprovante, setComprovante] = useState<File | null>(null)
  const [fileHashAtual, setFileHashAtual] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [extraindoIA, setExtraindoIA] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [duplicado, setDuplicado] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  // Lê data e hora do pagamento diretamente do comprovante anexado — se a IA não
  // identificar, o campo fica em branco pro usuário preencher manualmente (nunca
  // cai pra data de hoje, de cadastro ou de vencimento). Também verifica se esse
  // mesmo comprovante (por hash do arquivo, ou pelos dados da transação) já foi
  // usado pra dar baixa em outra conta.
  async function handleComprovanteSelecionado(file: File | null) {
    setComprovante(file)
    setFileHashAtual(null)
    setErro(null)
    setDuplicado(false)
    if (!file) return

    setExtraindoIA(true)
    try {
      const hash = await hashFile(file)
      setFileHashAtual(hash)

      const outrosComprovantes = await getFiles({ module: 'contas', categoria: 'comprovante_pagamento' })
      const jaUsado = outrosComprovantes.some(f => f.entityId !== conta.id && f.fileHash === hash)
      if (jaUsado) {
        setDuplicado(true)
        setErro(COMPROVANTE_DUPLICADO_MSG)
        return
      }

      const ext = file.name.split('.').pop()?.toLowerCase()
      const isPdf = file.type === 'application/pdf' || ext === 'pdf'
      const isImage = file.type.startsWith('image/')
      if (!isPdf && !isImage) return

      const body = new FormData()
      body.append('file', file)
      const res = await fetch('/api/extract-boleto', { method: 'POST', body })
      const data: BoletoExtracao & { error?: string } = await res.json()
      if (!res.ok || data.error) {
        setErro(data.error ? `Não foi possível ler o comprovante: ${data.error}` : 'Não foi possível ler a data/hora automaticamente — preencha manualmente.')
        return
      }

      // Duplicidade pelos dados da transação — cobre o caso do comprovante ter
      // sido reenviado com outro nome/conteúdo (ex: reexportado), mas ainda
      // representando o mesmo pagamento já usado em outra conta.
      const mesmaTransacaoJaUsada = todasContas.some(c =>
        c.id !== conta.id && c.status === 'pago' && c.valor === conta.valor && (
          (!!data.dataPagamento && !!data.horaPagamento && c.dataPagamento === parseDataBR(data.dataPagamento) && c.horaPagamento === data.horaPagamento) ||
          (!!data.identificadorTransacao && !!c.comprovanteIdentificador && c.comprovanteIdentificador === data.identificadorTransacao)
        )
      )
      if (mesmaTransacaoJaUsada) {
        setDuplicado(true)
        setErro(COMPROVANTE_DUPLICADO_MSG)
        return
      }

      if (!data.dataPagamento && !data.horaPagamento) {
        setErro('A IA não identificou data/hora neste comprovante — preencha manualmente.')
        return
      }

      setDataPagamento(d => (data.dataPagamento ? parseDataBR(data.dataPagamento) || d : d))
      setHoraPagamento(h => data.horaPagamento ?? h)
      setInstituicao(data.instituicaoFinanceira ?? '')
      setIdentificador(data.identificadorTransacao ?? '')
    } catch {
      setErro('Falha ao conectar com a IA — preencha data/hora manualmente.')
    } finally {
      setExtraindoIA(false)
    }
  }

  async function handleConfirm() {
    setSubmitted(true)
    if (!comprovante || !dataPagamento || duplicado) return
    setSaving(true)
    try {
      await saveFile(comprovante, {
        module: 'contas',
        entityId: conta.id,
        entityName: conta.descricao,
        espaco: conta.espaco === 'Todos' ? undefined : conta.espaco,
        categoria: 'comprovante_pagamento',
        fileHash: fileHashAtual ?? undefined,
      })
      await onConfirm(dataPagamento, horaPagamento || undefined, instituicao || undefined, identificador || undefined)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-app-surface rounded-2xl border border-app-border shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-app-border">
          <h2 className="text-sm font-semibold text-app-text flex items-center gap-2">
            <Banknote className="h-4 w-4 text-[#25D366]" />
            Dar baixa — {conta.descricao}
          </h2>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-app-subtle hover:bg-app-surface2 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-app-subtle">
            Valor: <span className="font-semibold text-app-text">{formatCurrency(conta.valor)}</span>
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-app-muted mb-1">Data do pagamento *</label>
              <input type="date" value={dataPagamento} onChange={e => setDataPagamento(e.target.value)}
                className={`w-full rounded-lg border ${submitted && !dataPagamento ? 'border-red-500/50' : 'border-app-border2'} bg-app-surface2 px-3 py-1.5 text-sm text-app-text focus:outline-none`}
              />
            </div>
            <div>
              <label className="block text-xs text-app-muted mb-1">Hora do pagamento</label>
              <input type="time" value={horaPagamento} onChange={e => setHoraPagamento(e.target.value)}
                className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-3 py-1.5 text-sm text-app-text focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-app-muted mb-1">
              Comprovante de pagamento<span className="text-red-400 ml-0.5">*</span>
            </label>
            <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg" className="hidden"
              onChange={e => handleComprovanteSelecionado(e.target.files?.[0] ?? null)} />
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={e => handleComprovanteSelecionado(e.target.files?.[0] ?? null)} />
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => fileRef.current?.click()} disabled={extraindoIA}
                className="flex items-center gap-1.5 rounded-lg border border-app-border2 px-3 py-1.5 text-xs text-app-muted hover:bg-app-surface2 transition-colors disabled:opacity-60">
                <Paperclip className="h-3.5 w-3.5" />
                {comprovante ? comprovante.name : 'Selecionar arquivo…'}
              </button>
              <button onClick={() => cameraRef.current?.click()} disabled={extraindoIA}
                className="flex items-center gap-1.5 rounded-lg border border-app-border2 px-3 py-1.5 text-xs text-app-muted hover:bg-app-surface2 transition-colors disabled:opacity-60">
                <Camera className="h-3.5 w-3.5" />
                Tirar foto
              </button>
              {extraindoIA && (
                <span className="flex items-center gap-1.5 text-xs text-[#128C7E]">
                  <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                  Verificando comprovante…
                </span>
              )}
            </div>
            {comprovante && !extraindoIA && !duplicado && (
              <p className="text-xs text-app-subtle mt-1">Data e hora acima já vêm do comprovante quando identificadas — confira e corrija se precisar.</p>
            )}
            {erro && (
              <div className={`mt-2 rounded-lg border px-3 py-2 ${duplicado ? 'bg-red-500/10 border-red-500/30' : ''}`}>
                <p className={`text-xs ${duplicado ? 'font-medium text-red-500' : 'text-red-400'}`}>{erro}</p>
              </div>
            )}
            {submitted && !comprovante && (
              <p className="text-xs text-red-400 mt-1">Anexe o comprovante antes de confirmar o pagamento.</p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-app-border">
          <button onClick={onClose} className="rounded-lg border border-app-border2 px-4 py-2 text-sm text-app-muted hover:bg-app-surface2 transition-colors">
            Cancelar
          </button>
          <button onClick={handleConfirm} disabled={saving || extraindoIA || duplicado}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            style={{ backgroundColor: GREEN }}>
            <CheckCircle2 className="h-3.5 w-3.5" />
            {saving ? 'Confirmando…' : 'Confirmar pagamento'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface ContaRowProps {
  conta: ContaPagar
  onDarBaixa: () => void
  onEditar: () => void
  onExcluir: () => void
  onReler: () => void
  relendo: boolean
}

function ContaRow({ conta, onDarBaixa, onEditar, onExcluir, onReler, relendo }: ContaRowProps) {
  const [expanded, setExpanded] = useState(false)
  const status = statusEfetivo(conta)

  return (
    <div className="rounded-lg border border-app-border2/50 bg-app-surface2/40 overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-app-text break-words">{conta.descricao}</p>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${categoriaBadge[conta.categoria]}`}>
              {categoriaLabel[conta.categoria]}
            </span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${subcategoriaBadge[conta.subcategoria]}`}>
              {subcategoriaLabel[conta.subcategoria]}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            <span className="text-xs text-app-subtle">{conta.espaco}</span>
            {conta.fornecedor && <span className="text-xs text-app-subtle">· {conta.fornecedor}</span>}
            <span className="text-xs text-app-subtle">· Venc. {conta.dataVencimento.split('-').reverse().join('/')}</span>
            {conta.dataPagamento && (
              <span className="text-xs text-emerald-600">
                · Pago {conta.dataPagamento.split('-').reverse().join('/')}{conta.horaPagamento ? ` às ${conta.horaPagamento}` : ''}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap sm:shrink-0">
          <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadge[status]}`}>
            {statusLabel[status]}
          </span>
          <span className="shrink-0 text-sm font-bold text-app-text sm:w-24 sm:text-right">{formatCurrency(conta.valor)}</span>
          {status !== 'pago' && (
            <button onClick={onDarBaixa}
              className="flex shrink-0 items-center gap-1.5 rounded-md border border-app-border2 px-2.5 py-1 text-xs font-medium text-app-muted hover:border-[#25D366] hover:text-[#128C7E] transition-colors"
              title="Dar baixa">
              <Banknote className="h-3.5 w-3.5" />
              Dar baixa
            </button>
          )}
          {status === 'pago' && (
            <button onClick={onReler} disabled={relendo}
              className="flex shrink-0 items-center gap-1.5 rounded-md border border-app-border2 px-2.5 py-1 text-xs font-medium text-app-muted hover:border-[#25D366] hover:text-[#128C7E] transition-colors disabled:opacity-60"
              title="Reler a data/hora do pagamento a partir do comprovante anexado">
              <RefreshCw className={`h-3.5 w-3.5 ${relendo ? 'animate-spin' : ''}`} />
              {relendo ? 'Relendo…' : 'Reler comprovante'}
            </button>
          )}
          <button onClick={onEditar}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-app-subtle hover:bg-app-surface2 hover:text-app-text transition-colors"
            title="Editar">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button onClick={onExcluir}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-app-subtle hover:bg-red-500/10 hover:text-red-500 transition-colors"
            title="Excluir">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setExpanded(v => !v)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-app-subtle hover:bg-app-surface2 transition-colors"
            title="Documentos">
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-app-border/50 space-y-2">
          <p className="text-xs font-medium text-app-muted flex items-center gap-1.5">
            <Paperclip className="h-3 w-3" />
            Documentos anexados
          </p>
          <FileList
            module="contas"
            entityId={conta.id}
            entityName={conta.descricao}
            espaco={conta.espaco === 'Todos' ? undefined : conta.espaco}
            compact
          />
          {conta.textoOrigemWhatsapp && (
            <details className="group mt-2">
              <summary className="cursor-pointer text-xs font-medium text-app-muted hover:text-app-text transition-colors list-none flex items-center gap-1.5">
                <MessageSquareText className="h-3 w-3" />
                <span className="group-open:hidden">▶</span>
                <span className="hidden group-open:inline">▼</span>
                Texto original (WhatsApp)
              </summary>
              <p className="mt-1.5 whitespace-pre-wrap text-xs text-app-subtle bg-app-surface2/50 rounded-lg border border-app-border2/30 p-2.5">
                {conta.textoOrigemWhatsapp}
              </p>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
