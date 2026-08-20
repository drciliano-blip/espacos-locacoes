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
import { DIVISAO_SOCIOS, nomeCanonicoSocio } from '@/lib/socios-config'
import { formatCurrency } from '@/lib/utils'
import FundoCard from './FundoCard'
import NovoFundoModal from './NovoFundoModal'
import NovaReceitaModal from '@/components/pagamentos/NovaReceitaModal'
import EditarEntradaModal from '@/components/pagamentos/EditarEntradaModal'
import NovaRetiradaSocioModal from '@/components/relatorios/NovaRetiradaSocioModal'
import EditarRetiradaSocioModal from '@/components/relatorios/EditarRetiradaSocioModal'
import LancamentoSocioListModal, { type LancamentoSocioRow, origemRetiradaLabel } from '@/components/relatorios/LancamentoSocioListModal'
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
  const [novoFundoOpen, setNovoFundoOpen] = useState(false)
  const [novoAporteOpen, setNovoAporteOpen] = useState(false)
  const [novaRetiradaOpen, setNovaRetiradaOpen] = useState(false)
  const [drillDown, setDrillDown] = useState<{ tipo: 'aportes' | 'retiradas'; titulo: string; nomes: string[]; naoIdentificado?: boolean } | null>(null)
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
    () => calcularFechamento(receitas, contasPagar, { selectedSpaces, dataInicio: filters.dataInicio, dataFim: filters.dataFim }, espacos, fundos, movimentacoes),
    [receitas, contasPagar, selectedSpaces, filters.dataInicio, filters.dataFim, espacos, fundos, movimentacoes],
  )

  const nomesSociosDisponiveis = useMemo(() => {
    const nomes = new Set<string>()
    for (const e of espacos) for (const s of DIVISAO_SOCIOS[e.nome] ?? []) nomes.add(s.nome)
    return Array.from(nomes)
  }, [espacos])

  // Aportes/retiradas em escopo pro painel de Sócios — sempre acumulado
  // (histórico completo), só respeita o espaço selecionado no filtro geral
  // da página. É uma posição atual (quanto cada sócio já aportou/retirou),
  // não um fluxo de período.
  const aportesSocioEscopo = useMemo(() => receitas.filter(r => {
    if (r.tipoEntrada !== 'aporte_societario') return false
    if (selectedSpaces?.length && (!r.espaco || !selectedSpaces.includes(r.espaco))) return false
    return true
  }), [receitas, selectedSpaces])

  const retiradasSocioEscopo = useMemo(() => contasPagar.filter(c => {
    if (c.categoria !== 'retirada_socio') return false
    if (selectedSpaces?.length && !selectedSpaces.includes(c.espaco)) return false
    return true
  }), [contasPagar, selectedSpaces])

  // Total de Aportes/Retiradas/Saldo por sócio — soma TODOS os lançamentos
  // pagos (não só o último) dentro do escopo acima. Nunca substitui o
  // histórico — é só um total calculado por cima dele, que se recalcula
  // sozinho a cada aporte/retirada criado, editado ou excluído porque lê
  // direto do ReceitasContext/ContasPagarContext.
  const resumoPorSocio = useMemo(() => {
    const porSocio = nomesSociosDisponiveis.map(nome => {
      const totalAportes = aportesSocioEscopo.filter(r => r.status === 'pago' && r.socioResponsavel && nomeCanonicoSocio(r.socioResponsavel) === nome).reduce((s, r) => s + r.valor, 0)
      const totalRetiradas = retiradasSocioEscopo.filter(c => c.status === 'pago' && c.fornecedor && nomeCanonicoSocio(c.fornecedor) === nome).reduce((s, c) => s + c.valor, 0)
      return { nome, totalAportes, totalRetiradas, saldo: totalAportes - totalRetiradas }
    })
    // Toda conta paga classificada como Retirada Sócio deve constar em algum
    // lugar aqui — se o campo Sócio não bater com nenhum dos cadastrados nem
    // com um alias conhecido (nomeCanonicoSocio), ela cai aqui em vez de
    // simplesmente desaparecer da soma.
    const totalRetiradasNaoIdentificadas = retiradasSocioEscopo
      .filter(c => c.status === 'pago' && (!c.fornecedor || !nomesSociosDisponiveis.includes(nomeCanonicoSocio(c.fornecedor))))
      .reduce((s, c) => s + c.valor, 0)
    return { porSocio, totalRetiradasNaoIdentificadas }
  }, [nomesSociosDisponiveis, aportesSocioEscopo, retiradasSocioEscopo])

  // Linhas do drill-down (Ver Aportes/Ver Retiradas) — sempre organizadas por
  // data (receitas/contas já vêm ordenadas por data desc do contexto), só do(s)
  // sócio(s) clicado(s), ou das retiradas sem sócio identificado quando
  // `naoIdentificado` está marcado. Mesmo escopo de espaço/período do resumo acima.
  const drillDownRows: LancamentoSocioRow[] = useMemo(() => {
    if (!drillDown) return []
    if (drillDown.tipo === 'aportes') {
      return aportesSocioEscopo
        .filter(r => r.socioResponsavel && drillDown.nomes.includes(nomeCanonicoSocio(r.socioResponsavel)))
        .map(r => ({ id: r.id, data: r.data, socio: r.socioResponsavel ?? '—', espaco: r.espaco ?? '—', valor: r.valor, descricao: r.descricao, observacoes: r.observacoes }))
    }
    return retiradasSocioEscopo
      .filter(c => drillDown.naoIdentificado
        ? (!c.fornecedor || !nomesSociosDisponiveis.includes(nomeCanonicoSocio(c.fornecedor)))
        : (c.fornecedor && drillDown.nomes.includes(nomeCanonicoSocio(c.fornecedor))))
      .map(c => ({
        id: c.id, data: c.dataPagamento ?? c.dataVencimento, socio: c.fornecedor ?? '—', espaco: c.espaco,
        valor: c.valor, descricao: c.descricao, observacoes: c.observacoes, origem: origemRetiradaLabel(c),
      }))
  }, [drillDown, aportesSocioEscopo, retiradasSocioEscopo, nomesSociosDisponiveis])

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

  // Obra consolidada (todos os espaços em escopo) pro Resumo Financeiro — o
  // Aporte Societário já É a receita da obra, não existe um lançamento manual
  // separado pra isso (ver fechamento-calc.ts).
  const totalAportesObra = fechamento.obraPorEspaco.reduce((s, o) => s + o.totalAportes, 0)
  const totalDespesasObra = fechamento.obraPorEspaco.reduce((s, o) => s + o.totalDespesas, 0)
  const totalResultadoObra = totalAportesObra - totalDespesasObra

  const [obraDrillDown, setObraDrillDown] = useState<{ tipo: 'aportes' | 'despesas'; titulo: string; espaco: string } | null>(null)
  // Drill-down do Resultado Operacional — mesma regra de conferência dos
  // outros cards: sempre dá pra abrir o total e ver exatamente quais
  // lançamentos pagos (mesmo filtro de período/espaço do FilterBar) o formam.
  const [resultadoDrillDown, setResultadoDrillDown] = useState<'receitas' | 'despesas' | null>(null)

  const espacosComObra = useMemo(() => new Set(fechamento.obraPorEspaco.map(o => o.nome)), [fechamento.obraPorEspaco])

  // Aporte Societário/despesa de obra em escopo pro painel de Obra — sempre
  // acumulado (histórico completo), só respeita o espaço do filtro geral da
  // página. É uma posição atual (saldo da obra desde sempre), não um fluxo
  // de período.
  const aportesObraEscopo = useMemo(() => receitas.filter(r => {
    if (r.tipoEntrada !== 'aporte_societario' && r.tipoEntrada !== 'aporte_obra') return false
    if (!r.espaco || !espacosComObra.has(r.espaco)) return false
    if (selectedSpaces?.length && !selectedSpaces.includes(r.espaco)) return false
    return true
  }), [receitas, espacosComObra, selectedSpaces])

  const despesasObraEscopo = useMemo(() => contasPagar.filter(c => {
    if (c.categoria !== 'obra') return false
    if (!espacosComObra.has(c.espaco)) return false
    if (selectedSpaces?.length && !selectedSpaces.includes(c.espaco)) return false
    return true
  }), [contasPagar, espacosComObra, selectedSpaces])

  // Linhas do drill-down (Ver Aportes/Ver Despesas) da Obra — organizadas por
  // data, só do espaço clicado, mesmo escopo do resumo acima.
  const obraDrillDownRows: LancamentoSocioRow[] = useMemo(() => {
    if (!obraDrillDown) return []
    if (obraDrillDown.tipo === 'aportes') {
      return aportesObraEscopo
        .filter(r => r.espaco === obraDrillDown.espaco)
        .map(r => ({ id: r.id, data: r.data, socio: r.socioResponsavel ?? '—', espaco: r.espaco ?? '—', valor: r.valor, descricao: r.descricao, observacoes: r.observacoes }))
    }
    return despesasObraEscopo
      .filter(c => c.espaco === obraDrillDown.espaco)
      .map(c => ({ id: c.id, data: c.dataPagamento ?? c.dataVencimento, socio: c.fornecedor ?? '—', espaco: c.espaco, valor: c.valor, descricao: c.descricao, observacoes: c.observacoes }))
  }, [obraDrillDown, aportesObraEscopo, despesasObraEscopo])

  const resultadoDrillDownRows: LancamentoSocioRow[] = useMemo(() => {
    if (resultadoDrillDown === 'receitas') {
      return fechamento.entradasOperacionais.filter(r => r.status === 'pago')
        .map(r => ({ id: r.id, data: r.data, socio: r.cliente ?? '—', espaco: r.espaco ?? '—', valor: r.valor, descricao: r.descricao, observacoes: r.observacoes }))
    }
    if (resultadoDrillDown === 'despesas') {
      return fechamento.despesasOperacionais.filter(c => c.status === 'pago')
        .map(c => ({ id: c.id, data: c.dataPagamento ?? c.dataVencimento, socio: c.fornecedor ?? '—', espaco: c.espaco, valor: c.valor, descricao: c.descricao, observacoes: c.observacoes }))
    }
    return []
  }, [resultadoDrillDown, fechamento])

  // Sócios por espaço — aporte/retirada individualizados (nunca reagrupados),
  // repasse calculado sobre o Disponível para Distribuição acumulado daquele
  // espaço (fechamento.disponivelPorEspaco — fonte única, já descontando
  // reservas e retiradas já feitas, ver fechamento-calc.ts).
  const sociosPorEspaco = useMemo(() => espacos.map(e => {
    const disponivel = fechamento.disponivelPorEspaco.find(d => d.nome === e.nome)?.disponivel ?? 0
    const socios = (DIVISAO_SOCIOS[e.nome] ?? []).map(s => ({
      nome: s.nome, percentual: s.percentual, valorDevido: disponivel * (s.percentual / 100),
    }))
    return { nome: e.nome, disponivel, socios }
  }), [espacos, fechamento])

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <FilterBar filters={filters} onChange={handleFiltersChange} />

      {/* Resumo Financeiro — Obra em cima, Operacional embaixo, cada linha
          seguindo Entrada / Saída / Resultado. Caixa Disponível e Disponível
          para Distribuição continuam explicados nas seções próprias abaixo. */}
      <div className="rounded-2xl border border-app-border bg-app-surface p-5 space-y-4">
        <h3 className="text-sm font-semibold text-app-text">Resumo Financeiro</h3>
        <div>
          <p className="text-[11px] font-medium text-app-subtle uppercase tracking-wider mb-1.5">Obra</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <ResumoStat label="Aporte Societário" valor={totalAportesObra} cor="text-violet-600" />
            <ResumoStat label="Despesas de Obra" valor={totalDespesasObra} cor="text-orange-500" />
            <ResumoStat label="Resultado Obra" valor={totalResultadoObra} cor={totalResultadoObra >= 0 ? 'text-[#128C7E]' : 'text-red-600'} />
          </div>
        </div>
        <div>
          <p className="text-[11px] font-medium text-app-subtle uppercase tracking-wider mb-1.5">Operacional</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <ResumoStat label="Receitas Operacionais" valor={fechamento.totalEntradas} cor="text-emerald-600" />
            <ResumoStat label="Despesas Operacionais" valor={fechamento.totalSaidas} cor="text-red-500" />
            <ResumoStat label="Resultado Operacional" valor={fechamento.resultado} cor={fechamento.resultado >= 0 ? 'text-[#128C7E]' : 'text-red-600'} />
          </div>
        </div>
      </div>

      {/* 1. Resultado Operacional */}
      <section className="rounded-2xl border border-app-border bg-app-surface p-5 space-y-3">
        <h4 className="text-xs font-semibold text-app-muted uppercase tracking-wide">Resultado Operacional</h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button type="button" onClick={() => setResultadoDrillDown('receitas')}
            className="min-w-0 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-left hover:border-emerald-500/40 transition-colors">
            <div className="flex items-center gap-2 mb-1"><ArrowUpCircle className="h-4 w-4 shrink-0 text-emerald-500" /><span className="text-xs text-emerald-600 font-medium">Receitas</span></div>
            <p className="text-lg font-bold text-emerald-600 break-words">{formatCurrency(fechamento.totalEntradas)}</p>
          </button>
          <button type="button" onClick={() => setResultadoDrillDown('despesas')}
            className="min-w-0 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-left hover:border-red-500/40 transition-colors">
            <div className="flex items-center gap-2 mb-1"><ArrowDownCircle className="h-4 w-4 shrink-0 text-red-500" /><span className="text-xs text-red-600 font-medium">Despesas</span></div>
            <p className="text-lg font-bold text-red-600 break-words">{formatCurrency(fechamento.totalSaidas)}</p>
          </button>
          <div className={`min-w-0 rounded-xl border p-4 ${fechamento.resultado >= 0 ? 'border-[#25D366]/25 bg-[#25D366]/5' : 'border-red-500/20 bg-red-500/5'}`}>
            <div className="flex items-center gap-2 mb-1"><Wallet className={`h-4 w-4 shrink-0 ${fechamento.resultado >= 0 ? 'text-[#128C7E]' : 'text-red-500'}`} /><span className={`text-xs font-medium ${fechamento.resultado >= 0 ? 'text-[#128C7E]' : 'text-red-600'}`}>Resultado</span></div>
            <p className={`text-lg font-bold break-words ${fechamento.resultado >= 0 ? 'text-[#128C7E]' : 'text-red-600'}`}>{formatCurrency(fechamento.resultado)}</p>
          </div>
        </div>
      </section>

      {/* 2. Obra — Aporte Societário é a receita da obra (não existe um
          lançamento manual separado); despesa de obra vem só de Contas Pagas
          classificadas como Obra. */}
      {fechamento.obraPorEspaco.length > 0 && (
        <section className="rounded-2xl border border-app-border bg-app-surface p-5 space-y-3">
          <h4 className="text-xs font-semibold text-app-muted uppercase tracking-wide">Obra</h4>
          <p className="text-xs text-app-subtle">Valores acumulados desde o início — Aporte Societário é a receita da obra, despesa de obra vem só de Contas Pagas classificadas como Obra.</p>

          <div className="space-y-3">
            {fechamento.obraPorEspaco.map(o => {
              return (
                <div key={o.nome} className="rounded-lg border border-orange-500/25 bg-orange-500/5 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-app-text flex items-center gap-1.5"><HardHat className="h-4 w-4 text-orange-500" />{o.nome}</p>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setObraDrillDown({ tipo: 'aportes', titulo: `Aporte Societário (obra) — ${o.nome}`, espaco: o.nome })}
                        className="rounded-lg border border-app-border2 px-3 py-1.5 text-xs text-app-muted hover:bg-app-surface2 transition-colors">
                        Ver Aportes
                      </button>
                      <button onClick={() => setObraDrillDown({ tipo: 'despesas', titulo: `Despesas com Obra — ${o.nome}`, espaco: o.nome })}
                        className="rounded-lg border border-app-border2 px-3 py-1.5 text-xs text-app-muted hover:bg-app-surface2 transition-colors">
                        Ver Despesas
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div><p className="text-app-subtle">Aporte Societário (receita da obra)</p><p className="font-semibold text-violet-600">{formatCurrency(o.totalAportes)}</p></div>
                    <div><p className="text-app-subtle">Despesas com Obra</p><p className="font-semibold text-red-500">{formatCurrency(o.totalDespesas)}</p></div>
                    <div><p className="text-app-subtle">Saldo da Obra</p><p className={`font-semibold ${o.saldo >= 0 ? 'text-[#128C7E]' : 'text-red-600'}`}>{formatCurrency(o.saldo)}</p></div>
                  </div>
                  {o.porSocio.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-app-muted mb-1.5">Aporte realizado por cada sócio (acumulado)</p>
                      <div className="flex flex-wrap gap-2">
                        {o.porSocio.map(s => (
                          <span key={s.nome} className="flex items-center gap-1.5 rounded-full bg-app-surface2 border border-app-border2/60 px-2.5 py-1 text-xs">
                            <span className="text-app-text font-medium">{s.nome}</span>
                            <span className="font-semibold text-violet-600">{formatCurrency(s.valor)}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* 3. Fundo de Caixa / Reservas */}
      <section className="rounded-2xl border border-app-border bg-app-surface p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-semibold text-app-muted uppercase tracking-wide">Fundo de Caixa / Reservas</h4>
            <p className="text-xs text-app-subtle mt-0.5">Total em fundos e reservas: <span className="font-semibold text-amber-600">{formatCurrency(totalFundosReservas)}</span></p>
          </div>
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

      {/* 4. Disponível para Distribuição — posição acumulada, não um fluxo do
          período: Resultado Operacional acumulado menos o que está reservado
          agora menos o que os sócios já retiraram. */}
      <section className="rounded-2xl border border-app-border bg-app-surface p-5 space-y-3">
        <h4 className="text-xs font-semibold text-app-muted uppercase tracking-wide">Disponível para Distribuição</h4>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div className="rounded-lg border border-app-border2/60 bg-app-bg p-3">
            <p className="text-app-subtle">Resultado Operacional (acumulado)</p>
            <p className="font-semibold text-app-text">{formatCurrency(fechamento.resultadoAcumulado)}</p>
          </div>
          <div className="rounded-lg border border-app-border2/60 bg-app-bg p-3">
            <p className="text-app-subtle">(−) Fundo de Caixa / Reservas</p>
            <p className="font-semibold text-amber-600">{formatCurrency(fechamento.saldoFundoAtual + fechamento.totalReservasGenericas)}</p>
          </div>
          <div className="rounded-lg border border-app-border2/60 bg-app-bg p-3">
            <p className="text-app-subtle">(−) Já retirado pelos sócios</p>
            <p className="font-semibold text-fuchsia-600">{formatCurrency(fechamento.totalRetiradasSocioAcumulado)}</p>
          </div>
          <div className="rounded-lg border border-[#25D366]/25 bg-[#25D366]/5 p-3">
            <p className="text-app-subtle">= Disponível para Distribuição</p>
            <p className={`text-lg font-bold ${fechamento.disponivelParaDistribuicao >= 0 ? 'text-[#128C7E]' : 'text-red-600'}`}>{formatCurrency(fechamento.disponivelParaDistribuicao)}</p>
          </div>
        </div>
        <p className="text-xs text-app-subtle">
          Valores acumulados desde o início, não travados ao período do filtro acima — é uma posição atual, não um resultado de mês. Reservas e retiradas nunca são despesa (não reduzem o Resultado Operacional), só reduzem o quanto ainda pode sair da empresa pros sócios.
        </p>
      </section>

      {/* 5. Sócios — organizado por sócio (não por data); o histórico
          cronológico de cada um fica no "Ver Aportes"/"Ver Retiradas". */}
      <section className="rounded-2xl border border-app-border bg-app-surface p-5 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h4 className="text-xs font-semibold text-app-muted uppercase tracking-wide">Sócios</h4>
          {podeLancar && (
            <div className="flex items-center gap-2">
              <button onClick={() => setNovoAporteOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-xs font-medium text-violet-600 hover:bg-violet-500/20 transition-colors">
                <Plus className="h-3.5 w-3.5" />Aporte
              </button>
              <button onClick={() => setNovaRetiradaOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1.5 text-xs font-medium text-fuchsia-600 hover:bg-fuchsia-500/20 transition-colors">
                <Plus className="h-3.5 w-3.5" />Retirada
              </button>
            </div>
          )}
        </div>

        <p className="text-xs text-app-subtle">Valores acumulados desde o início. Retiradas somam lançamentos manuais e Contas Pagas classificadas como Retirada Sócio, sem duplicidade.</p>

        {/* Resumo por sócio — nome, total de aportes, total de retiradas, saldo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {resumoPorSocio.porSocio.map(s => (
            <SocioResumoCard
              key={s.nome}
              nome={s.nome}
              totalAportes={s.totalAportes}
              totalRetiradas={s.totalRetiradas}
              saldo={s.saldo}
              onVerAportes={() => setDrillDown({ tipo: 'aportes', titulo: `Aportes — ${s.nome}`, nomes: [s.nome] })}
              onVerRetiradas={() => setDrillDown({ tipo: 'retiradas', titulo: `Retiradas — ${s.nome}`, nomes: [s.nome] })}
            />
          ))}
        </div>
        {resumoPorSocio.porSocio.length === 0 && (
          <p className="text-sm text-app-subtle text-center py-4">Nenhum sócio configurado para os espaços filtrados.</p>
        )}

        {resumoPorSocio.totalRetiradasNaoIdentificadas > 0 && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 space-y-2">
            <p className="text-sm font-semibold text-amber-700">Retiradas sem sócio identificado</p>
            <p className="text-xs text-app-subtle">
              Essas contas estão classificadas como Retirada Sócio em Contas a Pagar, mas o campo Sócio não bate com nenhum dos sócios cadastrados
              (Camilo, Alex, Giscard, Trupe Labels) — provavelmente lançadas antes do campo virar dropdown. Não entram no total de ninguém até
              você corrigir o Sócio de cada uma em Contas a Pagar.
            </p>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-amber-700">{formatCurrency(resumoPorSocio.totalRetiradasNaoIdentificadas)}</p>
              <button
                onClick={() => setDrillDown({ tipo: 'retiradas', titulo: 'Retiradas sem sócio identificado', nomes: [], naoIdentificado: true })}
                className="rounded-lg border border-amber-500/40 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-500/20 transition-colors"
              >
                Ver lançamentos
              </button>
            </div>
          </div>
        )}

        {/* Participação societária (% e valor devido) — sobre o Disponível
            para Distribuição acumulado do espaço (fechamento.disponivelPorEspaco). */}
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
                    {['Sócio', '%', 'Valor Devido'].map(h => (
                      <th key={h} className="px-2 py-1.5 text-left font-medium text-app-subtle uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border/50">
                  {e.socios.map(s => (
                    <tr key={s.nome}>
                      <td className="px-2 py-1.5 font-medium text-app-text whitespace-nowrap">{s.nome}</td>
                      <td className="px-2 py-1.5 text-app-text2 whitespace-nowrap">{s.percentual}%</td>
                      <td className={`px-2 py-1.5 font-semibold whitespace-nowrap ${s.valorDevido >= 0 ? 'text-[#128C7E]' : 'text-red-600'}`}>{formatCurrency(s.valorDevido)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
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

      {drillDown && (
        <LancamentoSocioListModal
          titulo={drillDown.titulo}
          rows={drillDownRows}
          fileModule={drillDown.tipo === 'aportes' ? 'receitas' : 'contas'}
          onClose={() => setDrillDown(null)}
          onEdit={drillDown.tipo === 'aportes' ? id => setEditandoAporteId(id) : id => setEditandoRetiradaId(id)}
        />
      )}

      {resultadoDrillDown && (
        <LancamentoSocioListModal
          titulo={resultadoDrillDown === 'receitas' ? 'Receitas Operacionais — período filtrado' : 'Despesas Operacionais — período filtrado'}
          rows={resultadoDrillDownRows}
          fileModule={resultadoDrillDown === 'receitas' ? 'receitas' : 'contas'}
          colunaPessoa={resultadoDrillDown === 'receitas' ? 'Cliente' : 'Fornecedor'}
          onClose={() => setResultadoDrillDown(null)}
        />
      )}

      {obraDrillDown && (
        <LancamentoSocioListModal
          titulo={obraDrillDown.titulo}
          rows={obraDrillDownRows}
          fileModule={obraDrillDown.tipo === 'aportes' ? 'receitas' : 'contas'}
          colunaPessoa={obraDrillDown.tipo === 'aportes' ? 'Sócio' : 'Fornecedor'}
          onClose={() => setObraDrillDown(null)}
          // Aporte pode ser editado aqui (mesmo fluxo de Sócios). Despesa de
          // obra é uma conta comum — edita pela tela de Contas a Pagar, não
          // tem um modal de edição dedicado aqui.
          onEdit={obraDrillDown.tipo === 'aportes' ? id => setEditandoAporteId(id) : undefined}
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

function SocioResumoCard({ nome, totalAportes, totalRetiradas, saldo, onVerAportes, onVerRetiradas }: {
  nome: string
  totalAportes: number
  totalRetiradas: number
  saldo: number
  onVerAportes: () => void
  onVerRetiradas: () => void
}) {
  return (
    <div className="rounded-lg border border-app-border2/60 bg-app-bg p-4 space-y-3">
      <p className="text-sm font-semibold text-app-text">{nome}</p>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-app-subtle">Aportes</p>
          <p className="font-semibold text-violet-600">{formatCurrency(totalAportes)}</p>
        </div>
        <div>
          <p className="text-app-subtle">Retiradas</p>
          <p className="font-semibold text-fuchsia-600">{formatCurrency(totalRetiradas)}</p>
        </div>
        <div>
          <p className="text-app-subtle">Saldo</p>
          <p className={`font-semibold ${saldo >= 0 ? 'text-[#128C7E]' : 'text-red-600'}`}>{formatCurrency(saldo)}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={onVerAportes} className="rounded-lg border border-app-border2 px-3 py-1.5 text-xs text-app-muted hover:bg-app-surface2 transition-colors">
          Ver Aportes
        </button>
        <button onClick={onVerRetiradas} className="rounded-lg border border-app-border2 px-3 py-1.5 text-xs text-app-muted hover:bg-app-surface2 transition-colors">
          Ver Retiradas
        </button>
      </div>
    </div>
  )
}
