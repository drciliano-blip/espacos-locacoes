'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, Plus, Landmark, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import { useConciliacao, type ImportarExtratoResultado } from '@/contexts/ConciliacaoContext'
import { useCurrentUser } from '@/contexts/UserContext'
import { useEspacoAtivo, MSG_ESPACO_ESPECIFICO_NECESSARIO } from '@/contexts/EspacoAtivoContext'
import { useReceitas } from '@/contexts/ReceitasContext'
import { useContasPagar } from '@/contexts/ContasPagarContext'
import {
  conciliar, receitaParaLancamento, contaParaLancamento,
  type StatusConciliacao, type ItemConciliacao, type LancamentoResumo, type MovimentacaoBancaria,
} from '@/lib/conciliacao-bancaria'
import { formatCurrency } from '@/lib/utils'
import { getPeriodRange } from '@/lib/relatorios-utils'
import FilterBar, { type RelatorioFilters } from '@/components/relatorios/FilterBar'
import Toast from '@/components/shared/Toast'
import ImportarExtratoModal from './ImportarExtratoModal'
import CriarLancamentoDeBancoModal from './CriarLancamentoDeBancoModal'

const STATUS_LABEL: Record<StatusConciliacao, string> = {
  conciliado: 'Conciliado',
  nao_encontrado_sistema: 'Não encontrado no sistema',
  nao_encontrado_banco: 'Não encontrado no banco',
  divergente: 'Possível divergência',
  duplicidade_possivel: 'Possível duplicidade',
}

const STATUS_COLOR: Record<StatusConciliacao, string> = {
  conciliado: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20',
  nao_encontrado_sistema: 'text-red-500 bg-red-500/10 border-red-500/20',
  nao_encontrado_banco: 'text-orange-500 bg-orange-500/10 border-orange-500/20',
  divergente: 'text-amber-600 bg-amber-500/10 border-amber-500/20',
  duplicidade_possivel: 'text-fuchsia-600 bg-fuchsia-500/10 border-fuchsia-500/20',
}

function getDefaultFilters(): RelatorioFilters {
  const { inicio, fim } = getPeriodRange('mensal')
  return { periodo: 'mensal', dataInicio: inicio, dataFim: fim }
}

function direcaoDoItem(item: ItemConciliacao): 'entrada' | 'saida' {
  if (item.movimentacao) return item.movimentacao.tipo
  return item.lancamento?.tipo === 'receita' ? 'entrada' : 'saida'
}

// Ação por linha: "Criar lançamento" abre o modal completo; "Vincular a…"
// resolve o caso comum de duplicidade/divergência com 1 clique (o lançamento
// certo já existe, só falta apontar pra ele); "Desvincular" desfaz um vínculo
// manual (o automático nunca precisa — é recalculado sozinho a cada render).
function AcaoConferencia({
  item, candidatos, onCriar, onVincular, onDesvincular,
}: {
  item: ItemConciliacao
  candidatos: LancamentoResumo[]
  onCriar: () => void
  onVincular: (l: LancamentoResumo) => Promise<void>
  onDesvincular: () => Promise<void>
}) {
  const [selecionado, setSelecionado] = useState('')
  const [processando, setProcessando] = useState(false)

  if (item.vinculoManual) {
    return (
      <button
        onClick={async () => { setProcessando(true); try { await onDesvincular() } finally { setProcessando(false) } }}
        disabled={processando}
        className="text-[11px] text-app-subtle hover:text-red-500 underline underline-offset-2 disabled:opacity-40"
      >
        Desvincular
      </button>
    )
  }
  if (!item.movimentacao || item.lancamento) return null

  async function handleVincular() {
    const alvo = candidatos.find(c => `${c.tipo}:${c.id}` === selecionado)
    if (!alvo) return
    setProcessando(true)
    try { await onVincular(alvo) } finally { setProcessando(false) }
  }

  return (
    <div className="flex flex-col gap-1.5 min-w-[170px]">
      <button
        onClick={onCriar}
        className="rounded-lg border border-[#25D366]/40 bg-[#25D366]/10 px-2 py-1 text-[11px] font-medium text-[#128C7E] hover:bg-[#25D366]/20 transition-colors"
      >
        Criar lançamento
      </button>
      {candidatos.length > 0 && (
        <div className="flex items-center gap-1">
          <select
            value={selecionado}
            onChange={e => setSelecionado(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-app-border2 bg-app-surface2 px-1.5 py-1 text-[11px] text-app-text focus:outline-none"
          >
            <option value="">Vincular a…</option>
            {candidatos.map(c => (
              <option key={`${c.tipo}:${c.id}`} value={`${c.tipo}:${c.id}`}>{c.data} — {formatCurrency(c.valor)} — {c.descricao.slice(0, 24)}</option>
            ))}
          </select>
          <button
            onClick={handleVincular}
            disabled={!selecionado || processando}
            className="rounded-lg border border-app-border2 px-1.5 py-1 text-[11px] text-app-muted hover:bg-app-surface2 disabled:opacity-40 transition-colors"
          >
            OK
          </button>
        </div>
      )}
    </div>
  )
}

// Tela de conferência banco x sistema — status nunca é persistido, sempre
// recalculado aqui a partir do que está carregado (ver src/lib/conciliacao-bancaria.ts).
export default function ConciliacaoBancariaClient() {
  const { extratos, movimentacoes, loading, importarExtrato, vincularMovimentacao, desvincularMovimentacao } = useConciliacao()
  const { receitas, categorias, addReceita } = useReceitas()
  const { contas: contasPagar, addConta } = useContasPagar()
  const { role } = useCurrentUser()
  const { espacoUnico, espacosEmEscopo: selectedSpaces, precisaEspacoEspecifico } = useEspacoAtivo()
  const podeVer = role === 'admin' || role === 'financeiro'

  const [filters, setFilters] = useState<RelatorioFilters>(getDefaultFilters)
  const [statusFiltro, setStatusFiltro] = useState<StatusConciliacao | 'todos'>('todos')
  const [direcaoFiltro, setDirecaoFiltro] = useState<'todas' | 'entrada' | 'saida'>('todas')
  const [importOpen, setImportOpen] = useState(false)
  const [criarLancamentoAlvo, setCriarLancamentoAlvo] = useState<MovimentacaoBancaria | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  function showToast(msg: string) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 4000)
  }

  function handleAbrirCriar(mov: MovimentacaoBancaria) {
    if (precisaEspacoEspecifico()) { showToast(MSG_ESPACO_ESPECIFICO_NECESSARIO); return }
    setCriarLancamentoAlvo(mov)
  }

  async function handleVincularExistente(mov: MovimentacaoBancaria, l: LancamentoResumo) {
    try {
      await vincularMovimentacao(mov.id, l.tipo, l.id)
      showToast('Movimentação vinculada.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Falha ao vincular.')
    }
  }

  async function handleDesvincular(mov: MovimentacaoBancaria) {
    try {
      await desvincularMovimentacao(mov.id)
      showToast('Vínculo removido — movimentação volta pra conferência automática.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Falha ao desvincular.')
    }
  }

  function handleImportado(resultado: ImportarExtratoResultado) {
    const partes = [`${resultado.totalNovas} movimentação(ões) importada(s)`]
    if (resultado.totalDuplicadas > 0) partes.push(`${resultado.totalDuplicadas} já existente(s), ignorada(s)`)
    showToast(partes.join(' — ') + '.')
  }

  // Mesma regra de escopo por espaço já usada no resto do Financeiro (ex:
  // fundosEmEscopo em FechamentoClient) — item sem espaço é da empresa toda,
  // sempre aparece; item com espaço só aparece se estiver no filtro global.
  function noEscopo(espaco: string | undefined): boolean {
    return !selectedSpaces?.length || !espaco || selectedSpaces.includes(espaco)
  }

  const movimentacoesEmEscopo = useMemo(() => movimentacoes.filter(m =>
    noEscopo(m.espaco) && m.data >= filters.dataInicio && m.data <= filters.dataFim,
  ), [movimentacoes, selectedSpaces, filters])

  const receitasEmEscopo = useMemo(() => receitas.filter(r => {
    if (!noEscopo(r.espaco)) return false
    const dataRef = r.dataRecebimento ?? r.data
    return dataRef >= filters.dataInicio && dataRef <= filters.dataFim
  }), [receitas, selectedSpaces, filters])

  const contasPagarEmEscopo = useMemo(() => contasPagar.filter(c => {
    if (!noEscopo(c.espaco !== 'Todos' ? c.espaco : undefined)) return false
    const dataRef = c.dataPagamento ?? c.dataVencimento
    return dataRef >= filters.dataInicio && dataRef <= filters.dataFim
  }), [contasPagar, selectedSpaces, filters])

  const resultado = useMemo(
    () => conciliar(movimentacoesEmEscopo, receitasEmEscopo, contasPagarEmEscopo),
    [movimentacoesEmEscopo, receitasEmEscopo, contasPagarEmEscopo],
  )

  const itensFiltrados = useMemo(() => resultado.itens.filter(item => {
    if (statusFiltro !== 'todos' && item.status !== statusFiltro) return false
    if (direcaoFiltro !== 'todas' && direcaoDoItem(item) !== direcaoFiltro) return false
    return true
  }), [resultado, statusFiltro, direcaoFiltro])

  // Lançamentos pagos, no escopo filtrado, que já viraram um "conciliado"
  // automático — ficam de fora das opções de "Vincular a…" (evita apontar
  // duas movimentações pro mesmo lançamento).
  const lancamentosJaConciliados = useMemo(() => {
    const set = new Set<string>()
    resultado.itens.forEach(item => { if (item.status === 'conciliado' && item.lancamento) set.add(`${item.lancamento.tipo}:${item.lancamento.id}`) })
    return set
  }, [resultado])

  const candidatosEntradaLivres = useMemo(
    () => receitasEmEscopo.filter(r => r.status === 'pago').map(receitaParaLancamento).filter(l => !lancamentosJaConciliados.has(`${l.tipo}:${l.id}`)),
    [receitasEmEscopo, lancamentosJaConciliados],
  )
  const candidatosSaidaLivres = useMemo(
    () => contasPagarEmEscopo.filter(c => c.status === 'pago').map(contaParaLancamento).filter(l => !lancamentosJaConciliados.has(`${l.tipo}:${l.id}`)),
    [contasPagarEmEscopo, lancamentosJaConciliados],
  )

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <Link href="/fechamento" className="inline-flex items-center gap-1 text-xs text-app-subtle hover:text-app-text transition-colors">
        <ChevronLeft className="h-3.5 w-3.5" />
        Voltar ao Financeiro
      </Link>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-lg font-semibold text-app-text flex items-center gap-2">
          <Landmark className="h-5 w-5 text-[#25D366]" />
          Conciliação Bancária
        </h1>
        {podeVer && (
          <button
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white transition-colors"
            style={{ backgroundColor: '#25D366' }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#128C7E' }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#25D366' }}
          >
            <Plus className="h-4 w-4" />
            Importar Extrato
          </button>
        )}
      </div>

      {!podeVer ? (
        <div className="rounded-2xl border border-app-border bg-app-surface p-8 text-center">
          <p className="text-sm text-app-subtle">Esta área é restrita a administradores e financeiro.</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-app-subtle">
            Importe o extrato do banco (OFX, CSV, XLS ou PDF) pra conferir se cada movimentação bate com o que já está lançado no sistema. A importação nunca cria ou altera lançamentos sozinha.
          </p>

          <FilterBar filters={filters} onChange={setFilters} />

          {/* Resumo — totais de banco x sistema no período/espaço filtrado. */}
          <div className="rounded-2xl border border-app-border bg-app-surface p-5 space-y-3">
            <h4 className="text-xs font-semibold text-app-muted uppercase tracking-wide">Resumo</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                <p className="text-app-subtle">Entradas no Banco</p>
                <p className="font-semibold text-emerald-600">{formatCurrency(resultado.resumo.totalBancoEntradas)}</p>
              </div>
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                <p className="text-app-subtle">Entradas no Sistema</p>
                <p className="font-semibold text-emerald-600">{formatCurrency(resultado.resumo.totalSistemaEntradas)}</p>
              </div>
              <div className="rounded-lg border border-app-border2/60 bg-app-bg p-3">
                <p className="text-app-subtle">Diferença (Entradas)</p>
                <p className={`font-semibold ${Math.abs(resultado.resumo.diferencaEntradas) < 0.01 ? 'text-[#128C7E]' : 'text-amber-600'}`}>{formatCurrency(resultado.resumo.diferencaEntradas)}</p>
              </div>
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                <p className="text-app-subtle">Saídas no Banco</p>
                <p className="font-semibold text-red-500">{formatCurrency(resultado.resumo.totalBancoSaidas)}</p>
              </div>
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                <p className="text-app-subtle">Saídas no Sistema</p>
                <p className="font-semibold text-red-500">{formatCurrency(resultado.resumo.totalSistemaSaidas)}</p>
              </div>
              <div className="rounded-lg border border-app-border2/60 bg-app-bg p-3">
                <p className="text-app-subtle">Diferença (Saídas)</p>
                <p className={`font-semibold ${Math.abs(resultado.resumo.diferencaSaidas) < 0.01 ? 'text-[#128C7E]' : 'text-amber-600'}`}>{formatCurrency(resultado.resumo.diferencaSaidas)}</p>
              </div>
            </div>

            {/* Badges de status — clicáveis, funcionam como atalho do filtro abaixo. */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <button
                onClick={() => setStatusFiltro('todos')}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${statusFiltro === 'todos' ? 'border-app-text2 text-app-text' : 'border-app-border2 text-app-subtle hover:text-app-text2'}`}
              >
                Todos ({resultado.itens.length})
              </button>
              {(Object.keys(STATUS_LABEL) as StatusConciliacao[]).map(status => (
                <button
                  key={status}
                  onClick={() => setStatusFiltro(status)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${statusFiltro === status ? STATUS_COLOR[status] : 'border-app-border2 text-app-subtle hover:text-app-text2'}`}
                >
                  {STATUS_LABEL[status]} ({resultado.resumo.porStatus[status]})
                </button>
              ))}
            </div>
          </div>

          {/* Tabela de conferência lado a lado */}
          <div className="rounded-2xl border border-app-border bg-app-surface p-5 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h4 className="text-xs font-semibold text-app-muted uppercase tracking-wide">Conferência</h4>
              <div className="flex gap-1.5">
                {(['todas', 'entrada', 'saida'] as const).map(d => (
                  <button
                    key={d}
                    onClick={() => setDirecaoFiltro(d)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${direcaoFiltro === d ? 'bg-app-surface3 text-app-text' : 'bg-app-surface2 text-app-subtle hover:text-app-text2'}`}
                  >
                    {d === 'todas' ? 'Todas' : d === 'entrada' ? 'Entradas' : 'Saídas'}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <p className="text-sm text-app-subtle text-center py-6">Carregando…</p>
            ) : itensFiltrados.length === 0 ? (
              <p className="text-sm text-app-subtle text-center py-6">
                {resultado.itens.length === 0 ? 'Nenhuma movimentação bancária ou lançamento no período/espaço filtrado.' : 'Nenhum item bate com os filtros selecionados.'}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-app-border2/60">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-app-border bg-app-surface2">
                      {['Movimentação Bancária', 'Lançamento no Sistema', 'Status', 'Ação'].map(h => (
                        <th key={h} className="px-2 py-2 text-left font-medium text-app-subtle uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-app-border/50">
                    {itensFiltrados.map((item, i) => (
                      <tr key={i}>
                        <td className="px-2 py-2 align-top">
                          {item.movimentacao ? (
                            <div className="min-w-[180px]">
                              <div className="flex items-center gap-1.5">
                                {item.movimentacao.tipo === 'entrada'
                                  ? <ArrowUpCircle className="h-3 w-3 shrink-0 text-emerald-500" />
                                  : <ArrowDownCircle className="h-3 w-3 shrink-0 text-red-500" />}
                                <span className="text-app-text2 whitespace-nowrap">{item.movimentacao.data}</span>
                                <span className={`font-semibold whitespace-nowrap ${item.movimentacao.tipo === 'entrada' ? 'text-emerald-600' : 'text-red-500'}`}>{formatCurrency(item.movimentacao.valor)}</span>
                              </div>
                              <p className="text-app-text mt-0.5 break-words">{item.movimentacao.descricao}</p>
                            </div>
                          ) : <span className="text-app-subtle">—</span>}
                        </td>
                        <td className="px-2 py-2 align-top">
                          {item.lancamento ? (
                            <div className="min-w-[180px]">
                              <div className="flex items-center gap-1.5">
                                <span className="text-app-text2 whitespace-nowrap">{item.lancamento.data}</span>
                                <span className={`font-semibold whitespace-nowrap ${item.lancamento.tipo === 'receita' ? 'text-emerald-600' : 'text-red-500'}`}>{formatCurrency(item.lancamento.valor)}</span>
                                <span className="text-[10px] text-app-subtle uppercase">{item.lancamento.tipo === 'receita' ? 'Receita' : 'Conta Paga'}</span>
                              </div>
                              <p className="text-app-text mt-0.5 break-words">{item.lancamento.descricao}</p>
                            </div>
                          ) : <span className="text-app-subtle">—</span>}
                        </td>
                        <td className="px-2 py-2 align-top whitespace-nowrap">
                          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_COLOR[item.status]}`}>{STATUS_LABEL[item.status]}</span>
                          {item.vinculoManual && <span className="block text-[10px] text-app-subtle mt-1">Vinculado manualmente</span>}
                        </td>
                        <td className="px-2 py-2 align-top">
                          {item.movimentacao && (
                            <AcaoConferencia
                              item={item}
                              candidatos={direcaoDoItem(item) === 'entrada' ? candidatosEntradaLivres : candidatosSaidaLivres}
                              onCriar={() => handleAbrirCriar(item.movimentacao!)}
                              onVincular={l => handleVincularExistente(item.movimentacao!, l)}
                              onDesvincular={() => handleDesvincular(item.movimentacao!)}
                            />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-app-border bg-app-surface p-5 space-y-3">
            <h4 className="text-xs font-semibold text-app-muted uppercase tracking-wide">Extratos importados</h4>
            {extratos.length === 0 ? (
              <p className="text-sm text-app-subtle text-center py-4">Nenhum extrato importado ainda.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-app-border2/60">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-app-border bg-app-surface2">
                      {['Arquivo', 'Espaço', 'Banco/Conta', 'Período', 'Movimentações', 'Importado em'].map(h => (
                        <th key={h} className="px-2 py-2 text-left font-medium text-app-subtle uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-app-border/50">
                    {extratos.map(e => (
                      <tr key={e.id}>
                        <td className="px-2 py-2 font-medium text-app-text whitespace-nowrap">{e.nomeArquivo}</td>
                        <td className="px-2 py-2 text-app-text2 whitespace-nowrap">{e.espaco ?? 'Empresa toda'}</td>
                        <td className="px-2 py-2 text-app-text2 whitespace-nowrap">{[e.banco, e.conta].filter(Boolean).join(' — ') || '—'}</td>
                        <td className="px-2 py-2 text-app-text2 whitespace-nowrap">{e.periodoInicio && e.periodoFim ? `${e.periodoInicio} a ${e.periodoFim}` : '—'}</td>
                        <td className="px-2 py-2 text-app-text2 whitespace-nowrap">{movimentacoes.filter(m => m.extratoId === e.id).length} de {e.totalMovimentacoes}</td>
                        <td className="px-2 py-2 text-app-subtle whitespace-nowrap">{new Date(e.createdAt).toLocaleDateString('pt-BR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {importOpen && (
        <ImportarExtratoModal
          espacoPadrao={espacoUnico ?? undefined}
          onClose={() => setImportOpen(false)}
          onImportar={importarExtrato}
          onImportado={handleImportado}
        />
      )}

      {criarLancamentoAlvo && espacoUnico && (
        <CriarLancamentoDeBancoModal
          movimentacao={criarLancamentoAlvo}
          espacoPadrao={espacoUnico}
          categorias={categorias}
          onClose={() => setCriarLancamentoAlvo(null)}
          onSaveReceita={addReceita}
          onSaveConta={addConta}
          onVincular={vincularMovimentacao}
          onCriado={() => showToast('Lançamento criado e vinculado à movimentação.')}
        />
      )}

      <Toast message={toastMsg} />
    </div>
  )
}
