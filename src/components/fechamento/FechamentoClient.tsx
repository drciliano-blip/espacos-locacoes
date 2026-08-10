'use client'

import { useMemo, useState } from 'react'
import {
  ArrowUpCircle, ArrowDownCircle, Wallet, HardHat, Vault, Plus,
} from 'lucide-react'
import FilterBar, { type RelatorioFilters } from '@/components/relatorios/FilterBar'
import { getPeriodRange } from '@/lib/relatorios-utils'
import { calcularFechamento } from '@/lib/fechamento-calc'
import { useReceitas } from '@/contexts/ReceitasContext'
import { useContasPagar } from '@/contexts/ContasPagarContext'
import { useEspacos } from '@/contexts/EspacosContext'
import { useFundos } from '@/contexts/FundosContext'
import { useCurrentUser } from '@/contexts/UserContext'
import { DIVISAO_SOCIOS, GRUPOS_SOCIOS } from '@/lib/socios-config'
import { formatCurrency } from '@/lib/utils'
import FundoCard from './FundoCard'
import NovoFundoModal from './NovoFundoModal'
import NovaReceitaModal from '@/components/pagamentos/NovaReceitaModal'
import EditarEntradaModal from '@/components/pagamentos/EditarEntradaModal'
import NovaRetiradaSocioModal from '@/components/relatorios/NovaRetiradaSocioModal'
import EditarRetiradaSocioModal from '@/components/relatorios/EditarRetiradaSocioModal'
import LancamentoSocioListModal, { type LancamentoSocioRow } from '@/components/relatorios/LancamentoSocioListModal'
import Toast from '@/components/shared/Toast'

function getDefaultFilters(): RelatorioFilters {
  const { inicio, fim } = getPeriodRange('anual')
  return { periodo: 'anual', espacos: [], dataInicio: inicio, dataFim: fim }
}

// A aba Financeiro é o centro financeiro consolidado — sempre separando os
// quatro conceitos que nunca podem se misturar automaticamente: Operação,
// Obra, Societário e Reservas. Toda a aritmética vem de fechamento-calc.ts,
// a mesma função usada em Relatórios, pra garantir números idênticos.
export default function FechamentoClient() {
  const { receitas, addReceita, editarReceita, deleteReceita, categorias } = useReceitas()
  const { contas: contasPagar, addConta, updateConta, deleteConta } = useContasPagar()
  const { espacosConfig } = useEspacos()
  const { fundos, movimentacoes, addFundo } = useFundos()
  const { role } = useCurrentUser()
  const podeLancar = role === 'admin' || role === 'financeiro'

  const [filters, setFilters] = useState<RelatorioFilters>(getDefaultFilters)
  const [socioFiltro, setSocioFiltro] = useState('')
  const [novoFundoOpen, setNovoFundoOpen] = useState(false)
  const [novoAporteOpen, setNovoAporteOpen] = useState(false)
  const [novaRetiradaOpen, setNovaRetiradaOpen] = useState(false)
  const [drillDown, setDrillDown] = useState<null | 'aportes' | 'retiradas'>(null)
  const [editandoAporteId, setEditandoAporteId] = useState<string | null>(null)
  const [editandoRetiradaId, setEditandoRetiradaId] = useState<string | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  function showToast(msg: string) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3500)
  }

  function handleFiltersChange(f: RelatorioFilters) {
    if (f.periodo !== filters.periodo) {
      const { inicio, fim } = getPeriodRange(f.periodo)
      setFilters({ ...f, dataInicio: inicio, dataFim: fim })
    } else {
      setFilters(f)
    }
  }

  const selectedSpaces = filters.espacos.length > 0 ? filters.espacos : undefined
  const espacos = useMemo(
    () => selectedSpaces ? espacosConfig.filter(e => selectedSpaces.includes(e.nome)) : espacosConfig,
    [espacosConfig, selectedSpaces],
  )
  const espacoUnico = selectedSpaces?.length === 1 ? selectedSpaces[0] : undefined

  const fechamento = useMemo(
    () => calcularFechamento(receitas, contasPagar, { selectedSpaces, dataInicio: filters.dataInicio, dataFim: filters.dataFim }, espacos),
    [receitas, contasPagar, selectedSpaces, filters.dataInicio, filters.dataFim, espacos],
  )

  const nomesSociosDisponiveis = useMemo(() => {
    const nomes = new Set<string>()
    for (const e of espacos) for (const s of DIVISAO_SOCIOS[e.nome] ?? []) nomes.add(s.nome)
    return Array.from(nomes)
  }, [espacos])

  const aportesFiltrados = socioFiltro ? fechamento.aportes.filter(r => r.socioResponsavel === socioFiltro) : fechamento.aportes
  const retiradasFiltradas = socioFiltro ? fechamento.retiradasSocio.filter(c => c.fornecedor === socioFiltro) : fechamento.retiradasSocio

  const aportesRows: LancamentoSocioRow[] = aportesFiltrados.map(r => ({
    id: r.id, data: r.data, socio: r.socioResponsavel ?? '—', espaco: r.espaco ?? '—',
    valor: r.valor, descricao: r.descricao, observacoes: r.observacoes,
  }))
  const retiradasRows: LancamentoSocioRow[] = retiradasFiltradas.map(c => ({
    id: c.id, data: c.dataPagamento ?? c.dataVencimento, socio: c.fornecedor ?? '—', espaco: c.espaco,
    valor: c.valor, descricao: c.descricao, observacoes: c.observacoes,
  }))

  // Fundos genéricos (Reservas) em escopo — um fundo sem espaço é da empresa
  // toda, então aparece independente do filtro de espaço; um fundo com espaço
  // só aparece se aquele espaço estiver no filtro (ou nenhum filtro aplicado).
  const fundosEmEscopo = useMemo(
    () => fundos.filter(f => !f.espaco || !selectedSpaces?.length || selectedSpaces.includes(f.espaco)),
    [fundos, selectedSpaces],
  )
  const totalFundosGenericos = useMemo(() => fundosEmEscopo.reduce((s, f) => {
    const movs = movimentacoes.filter(m => m.fundoId === f.id)
    const saldo = movs.filter(m => m.tipo === 'entrada').reduce((a, m) => a + m.valor, 0)
      - movs.filter(m => m.tipo === 'saida').reduce((a, m) => a + m.valor, 0)
    return s + saldo
  }, 0), [fundosEmEscopo, movimentacoes])
  const totalFundosReservas = fechamento.saldoFundoAtual + totalFundosGenericos

  // Sócios por espaço — aporte/retirada individualizados (nunca reagrupados),
  // repasse calculado sobre o Disponível para Distribuição daquele espaço.
  const sociosPorEspaco = useMemo(() => espacos.map(e => {
    const receitaTotal = fechamento.entradasOperacionais.filter(r => r.status === 'pago' && r.espaco === e.nome).reduce((s, r) => s + r.valor, 0)
    const despesaTotal = fechamento.despesasOperacionais.filter(c => c.status === 'pago' && c.espaco === e.nome).reduce((s, c) => s + c.valor, 0)
    const transferenciasEspaco = fechamento.transferenciasFundo.filter(c => c.status === 'pago' && c.espaco === e.nome).reduce((s, c) => s + c.valor, 0)
    const retornosEspaco = fechamento.retornosFundo.filter(r => r.status === 'pago' && r.espaco === e.nome).reduce((s, r) => s + r.valor, 0)
    const disponivel = receitaTotal - despesaTotal - transferenciasEspaco + retornosEspaco
    const socios = (DIVISAO_SOCIOS[e.nome] ?? []).map(s => {
      const aportado = fechamento.aportes.filter(r => r.status === 'pago' && r.espaco === e.nome && r.socioResponsavel === s.nome).reduce((sum, r) => sum + r.valor, 0)
      const retirado = fechamento.retiradasSocio.filter(c => c.status === 'pago' && c.espaco === e.nome && c.fornecedor === s.nome).reduce((sum, c) => sum + c.valor, 0)
      return { nome: s.nome, percentual: s.percentual, valorDevido: disponivel * (s.percentual / 100), aportado, retirado }
    })
    const grupos = Object.entries(GRUPOS_SOCIOS[e.nome] ?? {}).map(([grupo, membros]) => ({
      nome: grupo,
      percentual: socios.filter(s => membros.includes(s.nome)).reduce((sum, s) => sum + s.percentual, 0),
      valorDevido: socios.filter(s => membros.includes(s.nome)).reduce((sum, s) => sum + s.valorDevido, 0),
      aportado: socios.filter(s => membros.includes(s.nome)).reduce((sum, s) => sum + s.aportado, 0),
      retirado: socios.filter(s => membros.includes(s.nome)).reduce((sum, s) => sum + s.retirado, 0),
    }))
    return { nome: e.nome, disponivel, socios, grupos }
  }), [espacos, fechamento])

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <FilterBar filters={filters} onChange={handleFiltersChange} />

      {nomesSociosDisponiveis.length > 0 && (
        <div className="rounded-xl border border-app-border bg-app-surface p-4">
          <p className="text-xs font-medium text-app-subtle uppercase tracking-wider mb-2">Sócio</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setSocioFiltro('')}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium border transition-colors ${!socioFiltro ? 'border-violet-500/40 bg-violet-500/10 text-violet-300' : 'border-app-border2 bg-app-surface2 text-app-muted hover:text-app-text'}`}>
              Todos
            </button>
            {nomesSociosDisponiveis.map(nome => (
              <button key={nome} onClick={() => setSocioFiltro(nome)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium border transition-colors ${socioFiltro === nome ? 'border-violet-500/40 bg-violet-500/10 text-violet-300' : 'border-app-border2 bg-app-surface2 text-app-muted hover:text-app-text'}`}>
                {nome}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Resumo Financeiro */}
      <div className="rounded-2xl border border-app-border bg-app-surface p-5">
        <h3 className="text-sm font-semibold text-app-text mb-3">Resumo Financeiro</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <ResumoStat label="Aportes Societários" valor={fechamento.totalAportes} cor="text-violet-600" />
          <ResumoStat label="Receitas Operacionais" valor={fechamento.totalEntradas} cor="text-emerald-600" />
          <ResumoStat label="Despesas Operacionais" valor={fechamento.totalSaidas} cor="text-red-500" />
          <ResumoStat label="Resultado Operacional" valor={fechamento.resultado} cor={fechamento.resultado >= 0 ? 'text-[#128C7E]' : 'text-red-600'} />
          <ResumoStat label="Despesas de Obra" valor={fechamento.obraPorEspaco.reduce((s, o) => s + o.totalDespesas, 0)} cor="text-orange-500" />
          <ResumoStat label="Total em Fundos/Reservas" valor={totalFundosReservas} cor="text-amber-600" />
          <ResumoStat label="Caixa Disponível" valor={fechamento.saldoDisponivelForaFundo} cor="text-app-text" />
          <ResumoStat label="Disponível para Distribuição" valor={fechamento.disponivelParaDistribuicao} cor={fechamento.disponivelParaDistribuicao >= 0 ? 'text-[#128C7E]' : 'text-red-600'} />
        </div>
      </div>

      {/* 1. Resultado Operacional */}
      <section className="rounded-2xl border border-app-border bg-app-surface p-5 space-y-3">
        <h4 className="text-xs font-semibold text-app-muted uppercase tracking-wide">Resultado Operacional</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="min-w-0 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <div className="flex items-center gap-2 mb-1"><ArrowUpCircle className="h-4 w-4 shrink-0 text-emerald-500" /><span className="text-xs text-emerald-600 font-medium">Receitas</span></div>
            <p className="text-lg font-bold text-emerald-600 break-words">{formatCurrency(fechamento.totalEntradas)}</p>
          </div>
          <div className="min-w-0 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
            <div className="flex items-center gap-2 mb-1"><ArrowDownCircle className="h-4 w-4 shrink-0 text-red-500" /><span className="text-xs text-red-600 font-medium">Despesas</span></div>
            <p className="text-lg font-bold text-red-600 break-words">{formatCurrency(fechamento.totalSaidas)}</p>
          </div>
          <div className={`min-w-0 rounded-xl border p-4 ${fechamento.resultado >= 0 ? 'border-[#25D366]/25 bg-[#25D366]/5' : 'border-red-500/20 bg-red-500/5'}`}>
            <div className="flex items-center gap-2 mb-1"><Wallet className={`h-4 w-4 shrink-0 ${fechamento.resultado >= 0 ? 'text-[#128C7E]' : 'text-red-500'}`} /><span className={`text-xs font-medium ${fechamento.resultado >= 0 ? 'text-[#128C7E]' : 'text-red-600'}`}>Resultado</span></div>
            <p className={`text-lg font-bold break-words ${fechamento.resultado >= 0 ? 'text-[#128C7E]' : 'text-red-600'}`}>{formatCurrency(fechamento.resultado)}</p>
          </div>
        </div>
      </section>

      {/* 2. Obra */}
      {fechamento.obraPorEspaco.length > 0 && (
        <section className="rounded-2xl border border-app-border bg-app-surface p-5 space-y-3">
          <h4 className="text-xs font-semibold text-app-muted uppercase tracking-wide">Obra</h4>
          <div className="space-y-3">
            {fechamento.obraPorEspaco.map(o => (
              <div key={o.nome} className="rounded-lg border border-orange-500/25 bg-orange-500/5 p-4">
                <p className="text-sm font-semibold text-app-text flex items-center gap-1.5 mb-2"><HardHat className="h-4 w-4 text-orange-500" />{o.nome}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div><p className="text-app-subtle">Aportes para Obra</p><p className="font-semibold text-violet-600">{formatCurrency(o.totalAportes)}</p></div>
                  <div><p className="text-app-subtle">Gastos com Obra</p><p className="font-semibold text-red-500">{formatCurrency(o.totalDespesas)}</p></div>
                  <div><p className="text-app-subtle">Saldo da Obra</p><p className={`font-semibold ${o.saldo >= 0 ? 'text-[#128C7E]' : 'text-red-600'}`}>{formatCurrency(o.saldo)}</p></div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 3. Fundo de Caixa / Reservas */}
      <section className="rounded-2xl border border-app-border bg-app-surface p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-xs font-semibold text-app-muted uppercase tracking-wide">Fundo de Caixa / Reservas</h4>
          {podeLancar && (
            <button onClick={() => setNovoFundoOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-600 hover:bg-amber-500/20 transition-colors">
              <Plus className="h-3.5 w-3.5" />
              Criar Fundo
            </button>
          )}
        </div>
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-app-text flex items-center gap-1.5"><Vault className="h-4 w-4 text-amber-500" />Fundo de Caixa</p>
            <p className="text-lg font-bold text-amber-600">{formatCurrency(fechamento.saldoFundoAtual)}</p>
          </div>
          <p className="text-xs text-app-subtle mt-1">Acumulado desde o início — controle já existente, veja detalhes em Relatórios.</p>
        </div>
        {fundosEmEscopo.map(f => (
          <FundoCard
            key={f.id}
            fundo={f}
            movimentacoes={movimentacoes.filter(m => m.fundoId === f.id)}
            podeMovimentar={podeLancar}
            onMovimentado={showToast}
          />
        ))}
        {fundosEmEscopo.length === 0 && (
          <p className="text-sm text-app-subtle text-center py-2">Nenhum fundo criado ainda além do Fundo de Caixa.</p>
        )}
      </section>

      {/* 4. Disponível para Distribuição */}
      <section className="rounded-2xl border border-app-border bg-app-surface p-5 space-y-3">
        <h4 className="text-xs font-semibold text-app-muted uppercase tracking-wide">Disponível para Distribuição</h4>
        <div className="rounded-lg border border-[#25D366]/25 bg-[#25D366]/5 p-4">
          <p className="text-xs text-app-subtle">Resultado Operacional − Transferências pro Fundo de Caixa (período) + Retornos do Fundo (período)</p>
          <p className={`text-2xl font-bold mt-1 ${fechamento.disponivelParaDistribuicao >= 0 ? 'text-[#128C7E]' : 'text-red-600'}`}>{formatCurrency(fechamento.disponivelParaDistribuicao)}</p>
        </div>
      </section>

      {/* 5. Sócios */}
      <section className="rounded-2xl border border-app-border bg-app-surface p-5 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h4 className="text-xs font-semibold text-app-muted uppercase tracking-wide">Sócios</h4>
          <div className="flex items-center gap-2">
            {podeLancar && (
              <>
                <button onClick={() => setNovoAporteOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-600 hover:bg-violet-500/20 transition-colors">
                  <Plus className="h-3.5 w-3.5" />Aporte
                </button>
                <button onClick={() => setNovaRetiradaOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1.5 text-xs font-medium text-fuchsia-600 hover:bg-fuchsia-500/20 transition-colors">
                  <Plus className="h-3.5 w-3.5" />Retirada
                </button>
              </>
            )}
            <button onClick={() => setDrillDown('aportes')} className="rounded-lg border border-app-border2 px-3 py-1.5 text-xs text-app-muted hover:bg-app-surface2 transition-colors">
              Ver aportes ({aportesRows.length})
            </button>
            <button onClick={() => setDrillDown('retiradas')} className="rounded-lg border border-app-border2 px-3 py-1.5 text-xs text-app-muted hover:bg-app-surface2 transition-colors">
              Ver retiradas ({retiradasRows.length})
            </button>
          </div>
        </div>

        {sociosPorEspaco.map(e => (
          <div key={e.nome} className="rounded-lg border border-app-border2/60 bg-app-bg p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-app-text">{e.nome}</p>
              <p className="text-xs text-app-subtle">Disponível pra distribuição: <span className="font-semibold text-app-text">{formatCurrency(e.disponivel)}</span></p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-app-border">
                    {['Sócio', '%', 'Valor Devido', 'Aportado', 'Retirado'].map(h => (
                      <th key={h} className="px-2 py-1.5 text-left font-medium text-app-subtle uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border/50">
                  {e.socios.filter(s => !socioFiltro || s.nome === socioFiltro).map(s => (
                    <tr key={s.nome}>
                      <td className="px-2 py-1.5 font-medium text-app-text whitespace-nowrap">{s.nome}</td>
                      <td className="px-2 py-1.5 text-app-text2 whitespace-nowrap">{s.percentual}%</td>
                      <td className={`px-2 py-1.5 font-semibold whitespace-nowrap ${s.valorDevido >= 0 ? 'text-[#128C7E]' : 'text-red-600'}`}>{formatCurrency(s.valorDevido)}</td>
                      <td className="px-2 py-1.5 text-violet-600 whitespace-nowrap">{formatCurrency(s.aportado)}</td>
                      <td className="px-2 py-1.5 text-fuchsia-600 whitespace-nowrap">{formatCurrency(s.retirado)}</td>
                    </tr>
                  ))}
                  {e.grupos.filter(g => g.aportado > 0 || g.retirado > 0).map(g => (
                    <tr key={g.nome} className="bg-app-surface2/40">
                      <td className="px-2 py-1.5 font-medium text-app-subtle whitespace-nowrap italic">{g.nome} consolidado</td>
                      <td className="px-2 py-1.5 text-app-subtle whitespace-nowrap">{g.percentual}%</td>
                      <td className="px-2 py-1.5 text-app-subtle font-semibold whitespace-nowrap">{formatCurrency(g.valorDevido)}</td>
                      <td className="px-2 py-1.5 text-app-subtle whitespace-nowrap">{formatCurrency(g.aportado)}</td>
                      <td className="px-2 py-1.5 text-app-subtle whitespace-nowrap">{formatCurrency(g.retirado)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        {sociosPorEspaco.every(e => e.socios.length === 0) && (
          <p className="text-sm text-app-subtle text-center py-4">Nenhum sócio configurado para os espaços filtrados.</p>
        )}
      </section>

      {novoFundoOpen && (
        <NovoFundoModal
          onClose={() => setNovoFundoOpen(false)}
          onSave={addFundo}
          onSaved={() => showToast('Fundo criado.')}
        />
      )}

      {novoAporteOpen && (
        <NovaReceitaModal
          categorias={categorias}
          fixedTipoEntrada="aporte_societario"
          espacoPadrao={espacoUnico}
          onClose={() => setNovoAporteOpen(false)}
          onSave={async input => {
            const nova = await addReceita(input)
            showToast('Aporte societário registrado.')
            return nova
          }}
        />
      )}

      {novaRetiradaOpen && (
        <NovaRetiradaSocioModal
          onClose={() => setNovaRetiradaOpen(false)}
          onSave={addConta}
          onSaved={() => showToast('Retirada de sócio registrada.')}
        />
      )}

      {drillDown === 'aportes' && (
        <LancamentoSocioListModal
          titulo="Aportes Societários"
          rows={aportesRows}
          fileModule="receitas"
          onClose={() => setDrillDown(null)}
          onEdit={id => setEditandoAporteId(id)}
        />
      )}

      {editandoAporteId && (() => {
        const receitaEditando = receitas.find(r => r.id === editandoAporteId)
        return receitaEditando ? (
          <EditarEntradaModal
            receita={receitaEditando}
            categorias={categorias}
            onClose={() => setEditandoAporteId(null)}
            onSave={async (id, patch) => {
              await editarReceita(id, patch)
              showToast('Aporte atualizado.')
            }}
            onExcluir={async id => {
              await deleteReceita(id)
              showToast('Aporte excluído.')
            }}
          />
        ) : null
      })()}
      {drillDown === 'retiradas' && (
        <LancamentoSocioListModal
          titulo="Retiradas de Sócios"
          rows={retiradasRows}
          fileModule="contas"
          onClose={() => setDrillDown(null)}
          onEdit={id => setEditandoRetiradaId(id)}
        />
      )}

      {editandoRetiradaId && (() => {
        const contaEditando = contasPagar.find(c => c.id === editandoRetiradaId)
        return contaEditando ? (
          <EditarRetiradaSocioModal
            conta={contaEditando}
            onClose={() => setEditandoRetiradaId(null)}
            onSave={async c => {
              await updateConta(c)
              showToast('Retirada atualizada.')
            }}
            onExcluir={async id => {
              await deleteConta(id)
              showToast('Retirada excluída.')
            }}
          />
        ) : null
      })()}

      <Toast message={toastMsg} />
    </div>
  )
}

function ResumoStat({ label, valor, cor }: { label: string; valor: number; cor: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-app-border2/60 bg-app-bg p-3">
      <p className="text-[11px] text-app-subtle">{label}</p>
      <p className={`text-sm font-bold break-words ${cor}`}>{formatCurrency(valor)}</p>
    </div>
  )
}
