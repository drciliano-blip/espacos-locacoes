'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, Sparkles, ArrowUpCircle, ArrowDownCircle, X } from 'lucide-react'
import { useConciliacao } from '@/contexts/ConciliacaoContext'
import { useReceitas, type TipoEntrada, type CategoriaReceita } from '@/contexts/ReceitasContext'
import { useContasPagar } from '@/contexts/ContasPagarContext'
import { usePadroesClassificacao } from '@/contexts/PadroesClassificacaoContext'
import { useCurrentUser } from '@/contexts/UserContext'
import { useEspacoAtivo, MSG_ESPACO_ESPECIFICO_NECESSARIO } from '@/contexts/EspacoAtivoContext'
import { sugerirPadrao, type PadraoClassificacao } from '@/lib/padroes-classificacao'
import type { MovimentacaoBancaria } from '@/lib/conciliacao-bancaria'
import type { CategoriaContaPagar, SubcategoriaContaPagar, ContaPagar } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { getPeriodRange } from '@/lib/relatorios-utils'
import FilterBar, { type RelatorioFilters } from '@/components/relatorios/FilterBar'
import Toast from '@/components/shared/Toast'

const CATEGORIAS_CONTA: CategoriaContaPagar[] = ['operacional', 'obra', 'financeiro', 'retirada_socio']
const CATEGORIA_CONTA_LABEL: Record<CategoriaContaPagar, string> = {
  operacional: 'Operacional', obra: 'Obra', financeiro: 'Financeiro', retirada_socio: 'Retirada Sócio',
  fundo_caixa: 'Fundo de Caixa', reembolso_evento: 'Reembolso de Evento',
}
const SUBCATEGORIAS_CONTA: SubcategoriaContaPagar[] = ['aluguel', 'energia', 'agua', 'iptu', 'internet', 'funcionários', 'manutenção', 'fornecedores', 'extras', 'outros']
const SUBCATEGORIA_LABEL: Record<SubcategoriaContaPagar, string> = {
  aluguel: 'Aluguel', energia: 'Energia', agua: 'Água', iptu: 'IPTU', internet: 'Internet', funcionários: 'Funcionários',
  manutenção: 'Manutenção', fornecedores: 'Fornecedores', extras: 'Extras', outros: 'Outros', despesa_a_comprovar: 'Despesa a ser comprovada',
}
const TIPOS_ENTRADA: TipoEntrada[] = ['evento', 'outras_entradas']
const TIPO_ENTRADA_LABEL: Record<TipoEntrada, string> = {
  evento: 'Receita de Evento', aporte_societario: 'Aporte Societário', outras_entradas: 'Outras Entradas',
  retorno_fundo_caixa: 'Retorno do Fundo de Caixa', aporte_obra: 'Aporte para Obra',
}

type Draft =
  | { tipo: 'lancamento'; espaco: string; categoriaId?: string; tipoEntrada?: TipoEntrada; categoriaConta?: CategoriaContaPagar; subcategoriaConta?: SubcategoriaContaPagar }
  | { tipo: 'transferencia' }
  | { tipo: 'ignorar' }

function getDefaultFilters(): RelatorioFilters {
  const { inicio, fim } = getPeriodRange('mensal')
  return { periodo: 'mensal', dataInicio: inicio, dataFim: fim }
}

function draftLabel(draft: Draft, categorias: CategoriaReceita[]): string {
  if (draft.tipo === 'transferencia') return 'Transferência entre contas'
  if (draft.tipo === 'ignorar') return 'Ignorar'
  if (draft.categoriaConta) return `${CATEGORIA_CONTA_LABEL[draft.categoriaConta]} — ${SUBCATEGORIA_LABEL[draft.subcategoriaConta ?? 'outros']}`
  const cat = categorias.find(c => c.id === draft.categoriaId)
  return `${TIPO_ENTRADA_LABEL[draft.tipoEntrada ?? 'outras_entradas']}${cat ? ` — ${cat.nome}` : ''}`
}

function sugestaoLabel(sugestao: PadraoClassificacao, categorias: CategoriaReceita[]): string {
  if (sugestao.classificacao === 'transferencia') return 'Transferência entre contas'
  if (sugestao.classificacao === 'ignorar') return 'Ignorar'
  if (sugestao.categoriaConta) return `${CATEGORIA_CONTA_LABEL[sugestao.categoriaConta as CategoriaContaPagar]} — ${SUBCATEGORIA_LABEL[(sugestao.subcategoriaConta as SubcategoriaContaPagar) ?? 'outros']}`
  const cat = categorias.find(c => c.id === sugestao.categoriaReceitaId)
  return cat ? cat.nome : (sugestao.tipoEntrada ? TIPO_ENTRADA_LABEL[sugestao.tipoEntrada as TipoEntrada] : 'Lançamento')
}

// Classificação em lote das movimentações que a Conciliação Bancária não
// encontrou no sistema — pensada pra reconstruir histórico (Importação
// Histórica): seleciona várias, aplica Espaço/Categoria de uma vez, ou marca
// como Transferência/Ignorar. Nada é salvo até "Confirmar Classificação".
export default function ClassificacaoEmLoteClient() {
  const { movimentacoes, loading, vincularMovimentacao, marcarClassificacaoEspecial } = useConciliacao()
  const { categorias, addReceita } = useReceitas()
  const { addConta } = useContasPagar()
  const { padroes, registrarPadrao } = usePadroesClassificacao()
  const { role } = useCurrentUser()
  const { espacoUnico, espacosEmEscopo: selectedSpaces, precisaEspacoEspecifico } = useEspacoAtivo()
  const podeVer = role === 'admin' || role === 'financeiro'

  const [filters, setFilters] = useState<RelatorioFilters>(getDefaultFilters)
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [drafts, setDrafts] = useState<Map<string, Draft>>(new Map())
  const [bulkCategoriaId, setBulkCategoriaId] = useState('')
  const [bulkTipoEntrada, setBulkTipoEntrada] = useState<TipoEntrada>('outras_entradas')
  const [bulkCategoriaConta, setBulkCategoriaConta] = useState<CategoriaContaPagar>('operacional')
  const [bulkSubcategoriaConta, setBulkSubcategoriaConta] = useState<SubcategoriaContaPagar>('outros')
  const [confirmando, setConfirmando] = useState(false)
  const [progresso, setProgresso] = useState<{ atual: number; total: number } | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  function showToast(msg: string) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 4500)
  }

  function noEscopo(espaco: string | undefined): boolean {
    return !selectedSpaces?.length || !espaco || selectedSpaces.includes(espaco)
  }

  const pendentes = useMemo(() => movimentacoes.filter(m =>
    !m.lancamentoTipo && !m.classificacaoEspecial && noEscopo(m.espaco) && m.data >= filters.dataInicio && m.data <= filters.dataFim,
  ), [movimentacoes, selectedSpaces, filters])

  const pendentesPorId = useMemo(() => new Map(pendentes.map(m => [m.id, m])), [pendentes])

  const tipoHomogeneo = useMemo(() => {
    const tipos = new Set(Array.from(selecionados).map(id => pendentesPorId.get(id)?.tipo).filter(Boolean))
    return tipos.size === 1 ? (Array.from(tipos)[0] as 'entrada' | 'saida') : null
  }, [selecionados, pendentesPorId])

  const resumoDrafts = useMemo(() => {
    let lancamentos = 0, transferencias = 0, ignoradas = 0
    drafts.forEach(d => { if (d.tipo === 'lancamento') lancamentos++; else if (d.tipo === 'transferencia') transferencias++; else ignoradas++ })
    return { lancamentos, transferencias, ignoradas, pendentes: pendentes.length - drafts.size }
  }, [drafts, pendentes])

  function toggleSelecionado(id: string) {
    setSelecionados(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleTodos() {
    const selecionaveis = pendentes.filter(m => !drafts.has(m.id))
    setSelecionados(prev => prev.size === selecionaveis.length ? new Set() : new Set(selecionaveis.map(m => m.id)))
  }

  function aplicarDraft(ids: string[], draft: Draft) {
    setDrafts(prev => {
      const next = new Map(prev)
      ids.forEach(id => next.set(id, draft))
      return next
    })
    setSelecionados(new Set())
  }

  function removerDraft(id: string) {
    setDrafts(prev => {
      const next = new Map(prev)
      next.delete(id)
      return next
    })
  }

  function handleAplicarLancamento() {
    if (!tipoHomogeneo) return
    if (precisaEspacoEspecifico()) { showToast(MSG_ESPACO_ESPECIFICO_NECESSARIO); return }
    const draft: Draft = tipoHomogeneo === 'entrada'
      ? { tipo: 'lancamento', espaco: espacoUnico!, categoriaId: bulkCategoriaId || categorias[0]?.id, tipoEntrada: bulkTipoEntrada }
      : { tipo: 'lancamento', espaco: espacoUnico!, categoriaConta: bulkCategoriaConta, subcategoriaConta: bulkSubcategoriaConta }
    aplicarDraft(Array.from(selecionados), draft)
  }

  function handleMarcarEspecial(tipo: 'transferencia' | 'ignorar') {
    aplicarDraft(Array.from(selecionados), { tipo })
  }

  function handleUsarSugestao(mov: MovimentacaoBancaria) {
    const sugestao = sugerirPadrao(mov.descricao, mov.tipo, padroes)
    if (!sugestao) return
    if (sugestao.classificacao !== 'lancamento') {
      aplicarDraft([mov.id], { tipo: sugestao.classificacao })
      return
    }
    if (precisaEspacoEspecifico()) { showToast(MSG_ESPACO_ESPECIFICO_NECESSARIO); return }
    aplicarDraft([mov.id], {
      tipo: 'lancamento',
      espaco: espacoUnico!,
      categoriaId: sugestao.categoriaReceitaId,
      tipoEntrada: (sugestao.tipoEntrada as TipoEntrada) ?? 'outras_entradas',
      categoriaConta: sugestao.categoriaConta as CategoriaContaPagar | undefined,
      subcategoriaConta: sugestao.subcategoriaConta as SubcategoriaContaPagar | undefined,
    })
  }

  async function handleConfirmar() {
    const entradas = Array.from(drafts.entries())
    if (entradas.length === 0) return
    setConfirmando(true)
    setProgresso({ atual: 0, total: entradas.length })
    let criados = 0
    const transferencias: string[] = []
    const ignoradas: string[] = []
    try {
      for (const [movId, draft] of entradas) {
        const mov = pendentesPorId.get(movId)
        if (mov) {
          if (draft.tipo === 'lancamento') {
            if (mov.tipo === 'entrada') {
              const nova = await addReceita({
                categoriaId: draft.categoriaId || categorias[0]?.id || '',
                espaco: draft.espaco,
                cliente: mov.favorecidoPagador,
                descricao: mov.descricao,
                data: mov.data,
                dataRecebimento: mov.data,
                valor: mov.valor,
                status: 'pago',
                tipoEntrada: draft.tipoEntrada ?? 'outras_entradas',
                comprovanteIdentificador: mov.identificadorTransacao,
                horaRecebimento: mov.hora,
                origem: 'extrato_bancario',
              })
              await vincularMovimentacao(mov.id, 'receita', nova.id)
              await registrarPadrao(mov.descricao, 'entrada', {
                classificacao: 'lancamento', espaco: draft.espaco, categoriaReceitaId: draft.categoriaId, tipoEntrada: draft.tipoEntrada,
              })
            } else {
              const id = crypto.randomUUID()
              await addConta({
                id,
                descricao: mov.descricao,
                espaco: draft.espaco as ContaPagar['espaco'],
                categoria: draft.categoriaConta ?? 'operacional',
                subcategoria: draft.subcategoriaConta ?? 'outros',
                valor: mov.valor,
                status: 'pago',
                dataVencimento: mov.data,
                dataPagamento: mov.data,
                horaPagamento: mov.hora,
                comprovanteIdentificador: mov.identificadorTransacao,
                fornecedor: mov.favorecidoPagador,
                origem: 'extrato_bancario',
              })
              await vincularMovimentacao(mov.id, 'conta_pagar', id)
              await registrarPadrao(mov.descricao, 'saida', {
                classificacao: 'lancamento', espaco: draft.espaco, categoriaConta: draft.categoriaConta, subcategoriaConta: draft.subcategoriaConta,
              })
            }
            criados++
          } else if (draft.tipo === 'transferencia') {
            transferencias.push(mov.id)
            await registrarPadrao(mov.descricao, mov.tipo, { classificacao: 'transferencia' })
          } else {
            ignoradas.push(mov.id)
            await registrarPadrao(mov.descricao, mov.tipo, { classificacao: 'ignorar' })
          }
        }
        setProgresso(prev => prev ? { atual: prev.atual + 1, total: prev.total } : null)
      }
      if (transferencias.length > 0) await marcarClassificacaoEspecial(transferencias, 'transferencia')
      if (ignoradas.length > 0) await marcarClassificacaoEspecial(ignoradas, 'ignorado')
      setDrafts(new Map())
      showToast(`${criados} lançamento(s) criado(s) — ${transferencias.length} marcada(s) como transferência — ${ignoradas.length} ignorada(s).`)
    } catch (err) {
      showToast(err instanceof Error ? `Falha ao confirmar: ${err.message}` : 'Falha ao confirmar a classificação. Tente novamente.')
    } finally {
      setConfirmando(false)
      setProgresso(null)
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <Link href="/fechamento/conciliacao" className="inline-flex items-center gap-1 text-xs text-app-subtle hover:text-app-text transition-colors">
        <ChevronLeft className="h-3.5 w-3.5" />
        Voltar à Conciliação Bancária
      </Link>

      <h1 className="text-lg font-semibold text-app-text">Classificação em Lote</h1>

      {!podeVer ? (
        <div className="rounded-2xl border border-app-border bg-app-surface p-8 text-center">
          <p className="text-sm text-app-subtle">Esta área é restrita a administradores e financeiro.</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-app-subtle">
            Selecione movimentações e classifique em lote como Receita/Conta Paga, Transferência entre contas ou Ignorar. Nada é salvo até "Confirmar Classificação".
          </p>

          <FilterBar filters={filters} onChange={setFilters} />

          {/* Resumo do rascunho — a confirmação antes de gravar de verdade. */}
          <div className="rounded-2xl border border-app-border bg-app-surface p-4">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
              <span className="text-app-text2"><span className="font-semibold text-[#128C7E]">{resumoDrafts.lancamentos}</span> pronta(s) como lançamento</span>
              <span className="text-app-text2"><span className="font-semibold text-sky-600">{resumoDrafts.transferencias}</span> como transferência</span>
              <span className="text-app-text2"><span className="font-semibold text-zinc-500">{resumoDrafts.ignoradas}</span> pra ignorar</span>
              <span className="text-app-subtle"><span className="font-semibold">{resumoDrafts.pendentes}</span> ainda pendente(s)</span>
              <button
                onClick={handleConfirmar}
                disabled={drafts.size === 0 || confirmando}
                className="ml-auto flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                style={{ backgroundColor: '#25D366' }}
              >
                {confirmando && progresso ? `Confirmando ${progresso.atual} de ${progresso.total}…` : 'Confirmar Classificação'}
              </button>
            </div>
          </div>

          {/* Barra de ação em lote — aparece com ≥1 movimentação selecionada. */}
          {selecionados.size > 0 && (
            <div className="rounded-2xl border border-[#25D366]/30 bg-[#25D366]/5 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-sm font-medium text-app-text">{selecionados.size} movimentação(ões) selecionada(s)</p>
                <button onClick={() => setSelecionados(new Set())} className="text-xs text-app-subtle hover:text-app-text transition-colors">Limpar seleção</button>
              </div>

              <div className="flex flex-wrap items-end gap-2">
                {tipoHomogeneo ? (
                  <>
                    {tipoHomogeneo === 'entrada' ? (
                      <>
                        <select value={bulkCategoriaId} onChange={e => setBulkCategoriaId(e.target.value)}
                          className="rounded-lg border border-app-border2 bg-app-surface px-2.5 py-1.5 text-sm text-app-text focus:outline-none cursor-pointer">
                          {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                        </select>
                        <select value={bulkTipoEntrada} onChange={e => setBulkTipoEntrada(e.target.value as TipoEntrada)}
                          className="rounded-lg border border-app-border2 bg-app-surface px-2.5 py-1.5 text-sm text-app-text focus:outline-none cursor-pointer">
                          {TIPOS_ENTRADA.map(t => <option key={t} value={t}>{TIPO_ENTRADA_LABEL[t]}</option>)}
                        </select>
                      </>
                    ) : (
                      <>
                        <select value={bulkCategoriaConta} onChange={e => setBulkCategoriaConta(e.target.value as CategoriaContaPagar)}
                          className="rounded-lg border border-app-border2 bg-app-surface px-2.5 py-1.5 text-sm text-app-text focus:outline-none cursor-pointer">
                          {CATEGORIAS_CONTA.map(c => <option key={c} value={c}>{CATEGORIA_CONTA_LABEL[c]}</option>)}
                        </select>
                        <select value={bulkSubcategoriaConta} onChange={e => setBulkSubcategoriaConta(e.target.value as SubcategoriaContaPagar)}
                          className="rounded-lg border border-app-border2 bg-app-surface px-2.5 py-1.5 text-sm text-app-text focus:outline-none cursor-pointer">
                          {SUBCATEGORIAS_CONTA.map(s => <option key={s} value={s}>{SUBCATEGORIA_LABEL[s]}</option>)}
                        </select>
                      </>
                    )}
                    <button onClick={handleAplicarLancamento}
                      className="rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors" style={{ backgroundColor: '#25D366' }}>
                      Aplicar como Lançamento
                    </button>
                  </>
                ) : (
                  <p className="text-xs text-app-subtle py-1.5">Selecione só entradas ou só saídas pra aplicar Categoria em lote.</p>
                )}
                <button onClick={() => handleMarcarEspecial('transferencia')}
                  className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-sm font-medium text-sky-600 hover:bg-sky-500/20 transition-colors">
                  Marcar como Transferência
                </button>
                <button onClick={() => handleMarcarEspecial('ignorar')}
                  className="rounded-lg border border-app-border2 px-3 py-1.5 text-sm font-medium text-app-muted hover:bg-app-surface2 transition-colors">
                  Marcar como Ignorar
                </button>
              </div>
            </div>
          )}

          {/* Tabela de pendentes */}
          <div className="rounded-2xl border border-app-border bg-app-surface p-5 space-y-3">
            {loading ? (
              <p className="text-sm text-app-subtle text-center py-6">Carregando…</p>
            ) : pendentes.length === 0 ? (
              <p className="text-sm text-app-subtle text-center py-6">Nenhuma movimentação pendente no período/espaço filtrado.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-app-border2/60">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-app-border bg-app-surface2">
                      <th className="px-2 py-2 text-left w-8">
                        <input type="checkbox" checked={selecionados.size > 0 && selecionados.size === pendentes.filter(m => !drafts.has(m.id)).length} onChange={toggleTodos} className="cursor-pointer" />
                      </th>
                      {['Data', 'Descrição', 'Valor', 'Classificação'].map(h => (
                        <th key={h} className="px-2 py-2 text-left font-medium text-app-subtle uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-app-border/50">
                    {pendentes.map(mov => {
                      const draft = drafts.get(mov.id)
                      const sugestao = !draft ? sugerirPadrao(mov.descricao, mov.tipo, padroes) : null
                      return (
                        <tr key={mov.id}>
                          <td className="px-2 py-2 align-top">
                            <input type="checkbox" checked={selecionados.has(mov.id)} disabled={!!draft}
                              onChange={() => toggleSelecionado(mov.id)} className="cursor-pointer disabled:opacity-30" />
                          </td>
                          <td className="px-2 py-2 align-top whitespace-nowrap text-app-text2">{mov.data}</td>
                          <td className="px-2 py-2 align-top">
                            <div className="flex items-center gap-1.5 min-w-[160px]">
                              {mov.tipo === 'entrada'
                                ? <ArrowUpCircle className="h-3 w-3 shrink-0 text-emerald-500" />
                                : <ArrowDownCircle className="h-3 w-3 shrink-0 text-red-500" />}
                              <span className="text-app-text break-words">{mov.descricao}</span>
                            </div>
                          </td>
                          <td className={`px-2 py-2 align-top whitespace-nowrap font-semibold ${mov.tipo === 'entrada' ? 'text-emerald-600' : 'text-red-500'}`}>
                            {formatCurrency(mov.valor)}
                          </td>
                          <td className="px-2 py-2 align-top">
                            {draft ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#25D366]/30 bg-[#25D366]/10 px-2 py-0.5 text-[11px] font-medium text-[#128C7E]">
                                Pronto: {draftLabel(draft, categorias)}
                                <button onClick={() => removerDraft(mov.id)} className="hover:text-red-500"><X className="h-3 w-3" /></button>
                              </span>
                            ) : sugestao ? (
                              <button onClick={() => handleUsarSugestao(mov)}
                                className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 hover:bg-amber-500/20 transition-colors">
                                <Sparkles className="h-3 w-3" />
                                Sugestão: {sugestaoLabel(sugestao, categorias)}
                              </button>
                            ) : (
                              <span className="text-app-subtle">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <Toast message={toastMsg} />
    </div>
  )
}
