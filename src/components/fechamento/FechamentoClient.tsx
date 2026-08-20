'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowUpCircle, ArrowDownCircle, Wallet, HardHat, Vault, Plus, X,
} from 'lucide-react'
import FilterBar, { type RelatorioFilters } from '@/components/relatorios/FilterBar'
import { getPeriodRange } from '@/lib/relatorios-utils'
import { calcularFechamento } from '@/lib/fechamento-calc'
import { useReceitas, type Receita } from '@/contexts/ReceitasContext'
import { useContasPagar } from '@/contexts/ContasPagarContext'
import type { ContaPagar } from '@/types'
import { useEspacos } from '@/contexts/EspacosContext'
import { useFundos } from '@/contexts/FundosContext'
import { useRepasses } from '@/contexts/RepassesContext'
import { useCurrentUser } from '@/contexts/UserContext'
import { DIVISAO_SOCIOS, nomeCanonicoSocio } from '@/lib/socios-config'
import { formatCurrency, parseCurrencyBR } from '@/lib/utils'
import { downloadWorkbook, type ExportSheet } from '@/lib/xlsx-export'
import { CATEGORIA_CONTA_LABEL, SUBCATEGORIA_LABEL } from '@/components/relatorios/LancamentosTables'
import ExportarRelatorioButton from '@/components/relatorios/ExportarRelatorioButton'
import FullTable from '@/components/shared/FullTable'
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

const PERIODO_LABELS: Record<string, string> = {
  semanal: 'Semanal', mensal: 'Mensal', trimestral: 'Trimestral', semestral: 'Semestral', anual: 'Anual',
}

function rowFromReceita(r: Receita): LancamentoSocioRow {
  return { id: r.id, data: r.data, socio: r.socioResponsavel ?? r.cliente ?? '—', espaco: r.espaco ?? '—', valor: r.valor, descricao: r.descricao, observacoes: r.observacoes }
}
function rowFromConta(c: ContaPagar): LancamentoSocioRow {
  return { id: c.id, data: c.dataPagamento ?? c.dataVencimento, socio: c.fornecedor ?? '—', espaco: c.espaco, valor: c.valor, descricao: c.descricao, observacoes: c.observacoes }
}

// A aba Financeiro é o centro financeiro consolidado do sistema — a única
// (a aba Relatórios foi incorporada aqui: visualização e exportação
// PDF/Excel agora vivem todas nesta tela) — sempre separando os quatro
// conceitos que nunca podem se misturar automaticamente: Operação, Obra,
// Societário e Reservas. Toda a aritmética vem de fechamento-calc.ts.
export default function FechamentoClient() {
  const { receitas, addReceita, editarReceita, deleteReceita, categorias } = useReceitas()
  const { contas: contasPagar, addConta, updateConta, deleteConta } = useContasPagar()
  const { espacosConfig } = useEspacos()
  const { fundos, movimentacoes, addFundo } = useFundos()
  const { repasses, addRepasse } = useRepasses()
  const { role } = useCurrentUser()
  const podeLancar = role === 'admin' || role === 'financeiro'

  const [filters, setFilters] = useState<RelatorioFilters>(getDefaultFilters)
  const [novoFundoOpen, setNovoFundoOpen] = useState(false)
  const [novoAporteOpen, setNovoAporteOpen] = useState(false)
  const [novaRetiradaOpen, setNovaRetiradaOpen] = useState(false)
  const [drillDown, setDrillDown] = useState<{ tipo: 'aportes' | 'retiradas'; titulo: string; nomes: string[]; naoIdentificado?: boolean } | null>(null)
  const [editandoAporteId, setEditandoAporteId] = useState<string | null>(null)
  const [editandoRetiradaId, setEditandoRetiradaId] = useState<string | null>(null)
  const [repasseAlvo, setRepasseAlvo] = useState<{ espaco: string; socio: string } | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  function showToast(msg: string) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3500)
  }

  // Impressão/PDF restrita a uma única lista (aberta pelo "Exportar" de um
  // card específico) — sem isso, "Exportar Relatório" no topo da página
  // sempre imprime o relatório completo (comprehensivo, mais abaixo).
  const [printScope, setPrintScope] = useState<{ titulo: string; rows: LancamentoSocioRow[]; colunaPessoa: string } | null>(null)
  useEffect(() => {
    if (!printScope) return
    const t = setTimeout(() => window.print(), 60)
    const aoTerminar = () => setPrintScope(null)
    window.addEventListener('afterprint', aoTerminar)
    return () => { clearTimeout(t); window.removeEventListener('afterprint', aoTerminar) }
  }, [printScope])

  function handlePrintList(titulo: string, rows: LancamentoSocioRow[], colunaPessoa = 'Sócio') {
    setPrintScope({ titulo, rows, colunaPessoa })
  }

  function handleExportListaExcel(titulo: string, rows: LancamentoSocioRow[], colunaPessoa = 'Sócio') {
    downloadWorkbook(
      [{
        name: titulo.slice(0, 31),
        rows: [
          ['Data', colunaPessoa, 'Espaço', 'Valor', 'Descrição', 'Observações'],
          ...rows.map(r => [r.data, r.socio, r.espaco, r.valor, r.descricao, r.observacoes ?? '']),
        ],
      }],
      `${titulo.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.xlsx`,
    )
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
  const espacosLabel = filters.espacos.length === 0 ? 'Todos os espaços' : filters.espacos.join(', ')
  const periodoLabel = PERIODO_LABELS[filters.periodo] ?? filters.periodo

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

  // Total de Aportes/Retiradas por sócio — soma TODOS os lançamentos pagos
  // (não só o último) dentro do escopo acima. Nunca substitui o histórico —
  // é só um total calculado por cima dele, que se recalcula sozinho a cada
  // aporte/retirada criado, editado ou excluído porque lê direto do
  // ReceitasContext/ContasPagarContext. Sem "saldo" (aporte − retirada) de
  // propósito: aporte e retirada têm finalidades diferentes e nunca devem
  // ser compensados entre si.
  const resumoPorSocio = useMemo(() => {
    const porSocio = nomesSociosDisponiveis.map(nome => {
      const totalAportes = aportesSocioEscopo.filter(r => r.status === 'pago' && r.socioResponsavel && nomeCanonicoSocio(r.socioResponsavel) === nome).reduce((s, r) => s + r.valor, 0)
      const totalRetiradas = retiradasSocioEscopo.filter(c => c.status === 'pago' && c.fornecedor && nomeCanonicoSocio(c.fornecedor) === nome).reduce((s, c) => s + c.valor, 0)
      return { nome, totalAportes, totalRetiradas }
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
  // Reaproveitado também pelos cards "Receitas/Despesas Operacionais" do
  // Resumo Financeiro no topo — mesmo dado, mesmo botão "Visualizar".
  const [resultadoDrillDown, setResultadoDrillDown] = useState<'receitas' | 'despesas' | null>(null)
  // Mesma ideia, mas pros cards "Aporte Societário"/"Despesas de Obra" do
  // Resumo Financeiro — versão consolidada (todos os espaços com obra juntos)
  // do obraDrillDown acima, que é por espaço individual.
  const [resumoObraDrillDown, setResumoObraDrillDown] = useState<'aportes' | 'despesas' | null>(null)

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

  // Versão consolidada (todos os espaços com obra) de obraDrillDownRows —
  // alimenta os cards "Aporte Societário"/"Despesas de Obra" do Resumo
  // Financeiro, que somam todos os espaços juntos (totalAportesObra acima).
  const resumoObraDrillDownRows: LancamentoSocioRow[] = useMemo(() => {
    if (resumoObraDrillDown === 'aportes') {
      return aportesObraEscopo.map(r => ({ id: r.id, data: r.data, socio: r.socioResponsavel ?? '—', espaco: r.espaco ?? '—', valor: r.valor, descricao: r.descricao, observacoes: r.observacoes }))
    }
    if (resumoObraDrillDown === 'despesas') {
      return despesasObraEscopo.map(c => ({ id: c.id, data: c.dataPagamento ?? c.dataVencimento, socio: c.fornecedor ?? '—', espaco: c.espaco, valor: c.valor, descricao: c.descricao, observacoes: c.observacoes }))
    }
    return []
  }, [resumoObraDrillDown, aportesObraEscopo, despesasObraEscopo])

  // Fundo de Caixa acumulado (movimentos completos, não só o período) — pro
  // relatório exportado/impresso, mesma base de saldoFundoAtual.
  const transferenciasFundoAllTime = useMemo(() => contasPagar.filter(c =>
    c.categoria === 'fundo_caixa' && (!selectedSpaces?.length || selectedSpaces.includes(c.espaco)),
  ), [contasPagar, selectedSpaces])
  const retornosFundoAllTime = useMemo(() => receitas.filter(r =>
    r.tipoEntrada === 'retorno_fundo_caixa' && (!selectedSpaces?.length || (r.espaco && selectedSpaces.includes(r.espaco))),
  ), [receitas, selectedSpaces])

  // Repasse aos sócios — mesma base do "Disponível para Distribuição" por
  // espaço (fechamento.disponivelPorEspaco), com o quanto já foi
  // efetivamente repassado (RepassesContext) descontado. Sempre acumulado,
  // igual ao resto da seção Sócios agora.
  const repasseSociosRows = useMemo(() => {
    const rows: { espaco: string; socio: string; percentual: number; lucro: number; valorDevido: number; jaRepassado: number; valorPendente: number }[] = []
    for (const e of espacos) {
      const lucro = fechamento.disponivelPorEspaco.find(d => d.nome === e.nome)?.disponivel ?? 0
      for (const s of DIVISAO_SOCIOS[e.nome] ?? []) {
        const valorDevido = lucro * (s.percentual / 100)
        const jaRepassado = repasses.filter(r => r.espaco === e.nome && r.socioNome === s.nome).reduce((sum, r) => sum + r.valor, 0)
        rows.push({ espaco: e.nome, socio: s.nome, percentual: s.percentual, lucro, valorDevido, jaRepassado, valorPendente: valorDevido - jaRepassado })
      }
    }
    return rows
  }, [espacos, fechamento, repasses])

  // Exportação completa do Financeiro — respeita exatamente o filtro de
  // espaço/período ativo na tela. Cada planilha usa a mesma lista que
  // alimenta o "Visualizar" do card equivalente, pra nunca divergir do que
  // está na tela (mesma regra de conferência dos totais).
  function handleExportExcelCompleto() {
    const resumoSheet: ExportSheet = {
      name: 'Resumo Financeiro',
      rows: [
        ['Espaços filtrados', espacosLabel],
        ['Período (Resultado Operacional)', `${filters.dataInicio} a ${filters.dataFim}`],
        [],
        ['Resultado Operacional (período filtrado)'],
        ['Receitas Operacionais', fechamento.totalEntradas],
        ['Despesas Operacionais', fechamento.totalSaidas],
        ['Resultado', fechamento.resultado],
        [],
        ['Obra (acumulado desde o início)'],
        ['Aporte Societário (receita da obra)', totalAportesObra],
        ['Despesas de Obra', totalDespesasObra],
        ['Resultado da Obra', totalResultadoObra],
        [],
        ['Fundo de Caixa / Reservas (posição atual)'],
        ['Fundo de Caixa', fechamento.saldoFundoAtual],
        ['Reservas genéricas', fechamento.totalReservasGenericas],
        ['Total em Fundos/Reservas', totalFundosReservas],
        [],
        ['Disponível para Distribuição (posição atual, acumulada)'],
        ['Resultado Operacional acumulado', fechamento.resultadoAcumulado],
        ['(-) Fundo de Caixa/Reservas', fechamento.saldoFundoAtual + fechamento.totalReservasGenericas],
        ['(-) Já retirado pelos sócios', fechamento.totalRetiradasSocioAcumulado],
        ['= Disponível para Distribuição', fechamento.disponivelParaDistribuicao],
      ],
    }

    const receitasSheet: ExportSheet = {
      name: 'Receitas Operacionais',
      rows: [
        ['Data', 'Descrição', 'Categoria', 'Espaço', 'Cliente/Pagador', 'Forma de Pagamento', 'Valor', 'Status', 'Data Recebimento', 'Observações'],
        ...fechamento.entradasOperacionais.map(r => [
          r.data, r.descricao, r.categoriaNome, r.espaco ?? '', r.cliente ?? '', r.metodoPagamento ?? '', r.valor, r.status, r.dataRecebimento ?? '', r.observacoes ?? '',
        ]),
      ],
    }

    const despesasSheet: ExportSheet = {
      name: 'Despesas Operacionais',
      rows: [
        ['Data Vencimento', 'Descrição', 'Fornecedor', 'Categoria', 'Subcategoria', 'Espaço', 'Valor', 'Status', 'Data Pagamento', 'Observações'],
        ...fechamento.despesasOperacionais.map(c => [
          c.dataVencimento, c.descricao, c.fornecedor ?? '', CATEGORIA_CONTA_LABEL[c.categoria] ?? c.categoria,
          SUBCATEGORIA_LABEL[c.subcategoria] ?? c.subcategoria, c.espaco, c.valor, c.status, c.dataPagamento ?? '', c.observacoes ?? '',
        ]),
      ],
    }

    const aportesObraSheet: ExportSheet = {
      name: 'Aportes Societários (Obra)',
      rows: [
        ['Data', 'Sócio', 'Espaço', 'Descrição', 'Valor', 'Status', 'Observações'],
        ...aportesObraEscopo.map(r => [r.data, r.socioResponsavel ?? '', r.espaco ?? '', r.descricao, r.valor, r.status, r.observacoes ?? '']),
      ],
    }

    const despesasObraSheet: ExportSheet = {
      name: 'Despesas de Obra',
      rows: [
        ['Data Vencimento', 'Descrição', 'Fornecedor', 'Espaço', 'Valor', 'Status', 'Data Pagamento', 'Observações'],
        ...despesasObraEscopo.map(c => [c.dataVencimento, c.descricao, c.fornecedor ?? '', c.espaco, c.valor, c.status, c.dataPagamento ?? '', c.observacoes ?? '']),
      ],
    }

    const fundoCaixaSheet: ExportSheet = {
      name: 'Fundo de Caixa',
      rows: [
        ['Tipo', 'Data', 'Descrição', 'Responsável', 'Espaço', 'Valor', 'Status', 'Observações'],
        ...transferenciasFundoAllTime.map(c => ['Transferência para o Fundo', c.dataVencimento, c.descricao, c.fornecedor ?? '', c.espaco, c.valor, c.status, c.observacoes ?? '']),
        ...retornosFundoAllTime.map(r => ['Retorno do Fundo', r.data, r.descricao, '', r.espaco ?? '', r.valor, r.status, r.observacoes ?? '']),
      ],
    }

    const reservasSheet: ExportSheet = {
      name: 'Reservas Genéricas',
      rows: [
        ['Fundo', 'Espaço', 'Tipo', 'Data', 'Descrição', 'Responsável', 'Valor'],
        ...fundosEmEscopo.flatMap(f => movimentacoes.filter(m => m.fundoId === f.id).map(m => [
          f.nome, f.espaco ?? 'Empresa toda', m.tipo === 'entrada' ? 'Entrada' : 'Saída', m.data, m.descricao ?? '', m.responsavel ?? '', m.valor,
        ])),
      ],
    }

    const sociosResumoSheet: ExportSheet = {
      name: 'Sócios - Resumo',
      rows: [
        ['Sócio', 'Total Aportado', 'Total Retirado'],
        ...resumoPorSocio.porSocio.map(s => [s.nome, s.totalAportes, s.totalRetiradas]),
      ],
    }

    const aportesSociosSheet: ExportSheet = {
      name: 'Aportes de Sócios',
      rows: [
        ['Data', 'Sócio', 'Espaço', 'Descrição', 'Valor', 'Status', 'Observações'],
        ...aportesSocioEscopo.map(r => [r.data, r.socioResponsavel ?? '', r.espaco ?? '', r.descricao, r.valor, r.status, r.observacoes ?? '']),
      ],
    }

    const retiradasSociosSheet: ExportSheet = {
      name: 'Retiradas de Sócios',
      rows: [
        ['Data', 'Sócio', 'Espaço', 'Descrição', 'Valor', 'Status', 'Origem', 'Observações'],
        ...retiradasSocioEscopo.map(c => [c.dataPagamento ?? c.dataVencimento, c.fornecedor ?? '', c.espaco, c.descricao, c.valor, c.status, origemRetiradaLabel(c), c.observacoes ?? '']),
      ],
    }

    const repasseSheet: ExportSheet = {
      name: 'Disponível p Distribuição',
      rows: [
        ['Espaço', 'Sócio', 'Percentual (%)', 'Disponível do Espaço', 'Valor Devido', 'Já Repassado', 'Valor Pendente'],
        ...repasseSociosRows.map(r => [r.espaco, r.socio, r.percentual, r.lucro, r.valorDevido, r.jaRepassado, r.valorPendente]),
      ],
    }

    downloadWorkbook(
      [resumoSheet, receitasSheet, despesasSheet, aportesObraSheet, despesasObraSheet, fundoCaixaSheet, reservasSheet, sociosResumoSheet, aportesSociosSheet, retiradasSociosSheet, repasseSheet],
      `financeiro-${filters.dataInicio}-a-${filters.dataFim}.xlsx`,
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Cabeçalho impresso — escondido na tela, só aparece no PDF exportado */}
      <div className="hidden print:block mb-6 border-b pb-4">
        <p className="text-xs text-gray-500 mb-1">Espaços &amp; Locações</p>
        <h1 className="text-xl font-bold text-gray-900">Financeiro — {periodoLabel}</h1>
        <p className="text-sm text-gray-600 mt-1">{espacosLabel}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          Período (Resultado Operacional): {filters.dataInicio} → {filters.dataFim} &nbsp;·&nbsp; Gerado em{' '}
          {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
        </p>
      </div>

      <div className={printScope ? 'print:hidden space-y-5' : 'space-y-5'}>
        {/* Exportar Relatório — primeiro item da aba, exporta tudo que está
            disponível no Financeiro respeitando o filtro de espaço/período
            ativo (PDF via impressão do relatório completo abaixo; Excel com
            uma planilha por seção). */}
        <div className="flex items-center justify-end print-hidden">
          <ExportarRelatorioButton onExcel={handleExportExcelCompleto} onPdf={() => window.print()} label="Exportar Relatório" />
        </div>

        <FilterBar filters={filters} onChange={handleFiltersChange} />

        {/* Resumo Financeiro — Obra em cima, Operacional embaixo, cada linha
            seguindo Entrada / Saída / Resultado. Caixa Disponível e Disponível
            para Distribuição continuam explicados nas seções próprias abaixo.
            Os 4 cards com dado bruto (não derivado) têm Visualizar/Exportar —
            o valor exibido é sempre a soma exata da lista aberta em "Visualizar". */}
        <div className="rounded-2xl border border-app-border bg-app-surface p-5 space-y-4">
          <h3 className="text-sm font-semibold text-app-text">Resumo Financeiro</h3>
          <div>
            <p className="text-[11px] font-medium text-app-subtle uppercase tracking-wider mb-1.5">Obra</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <ResumoStatAcionavel
                label="Aporte Societário" valor={totalAportesObra} cor="text-violet-600"
                onVisualizar={() => setResumoObraDrillDown('aportes')}
                onExportExcel={() => handleExportListaExcel('Aporte Societário — Obra', aportesObraEscopo.map(rowFromReceita))}
                onExportPdf={() => handlePrintList('Aporte Societário — Obra', aportesObraEscopo.map(rowFromReceita))}
              />
              <ResumoStatAcionavel
                label="Despesas de Obra" valor={totalDespesasObra} cor="text-orange-500"
                onVisualizar={() => setResumoObraDrillDown('despesas')}
                onExportExcel={() => handleExportListaExcel('Despesas de Obra', despesasObraEscopo.map(rowFromConta))}
                onExportPdf={() => handlePrintList('Despesas de Obra', despesasObraEscopo.map(rowFromConta))}
              />
              <ResumoStat label="Resultado Obra" valor={totalResultadoObra} cor={totalResultadoObra >= 0 ? 'text-[#128C7E]' : 'text-red-600'} />
            </div>
          </div>
          <div>
            <p className="text-[11px] font-medium text-app-subtle uppercase tracking-wider mb-1.5">Operacional</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <ResumoStatAcionavel
                label="Receitas Operacionais" valor={fechamento.totalEntradas} cor="text-emerald-600"
                onVisualizar={() => setResultadoDrillDown('receitas')}
                onExportExcel={() => handleExportListaExcel('Receitas Operacionais', fechamento.entradasOperacionais.filter(r => r.status === 'pago').map(rowFromReceita), 'Cliente')}
                onExportPdf={() => handlePrintList('Receitas Operacionais', fechamento.entradasOperacionais.filter(r => r.status === 'pago').map(rowFromReceita), 'Cliente')}
              />
              <ResumoStatAcionavel
                label="Despesas Operacionais" valor={fechamento.totalSaidas} cor="text-red-500"
                onVisualizar={() => setResultadoDrillDown('despesas')}
                onExportExcel={() => handleExportListaExcel('Despesas Operacionais', fechamento.despesasOperacionais.filter(c => c.status === 'pago').map(rowFromConta), 'Fornecedor')}
                onExportPdf={() => handlePrintList('Despesas Operacionais', fechamento.despesasOperacionais.filter(c => c.status === 'pago').map(rowFromConta), 'Fornecedor')}
              />
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
          <p className="text-xs text-app-subtle mt-1">Acumulado desde o início — controle já existente.</p>
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

        {/* Resumo por sócio — nome, total de aportes, total de retiradas. Sem
            "saldo" de propósito: aporte e retirada não se compensam. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {resumoPorSocio.porSocio.map(s => (
            <SocioResumoCard
              key={s.nome}
              nome={s.nome}
              totalAportes={s.totalAportes}
              totalRetiradas={s.totalRetiradas}
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

        {/* Repasse aos Sócios (% sobre o Disponível para Distribuição
            acumulado de cada espaço) menos o que já foi efetivamente
            repassado (RepassesContext) — mostra quanto ainda falta entregar
            a cada sócio, não só a participação bruta. */}
        {repasseSociosRows.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-app-border2/60">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-app-border bg-app-surface2">
                  {['Espaço', 'Sócio', '%', 'Disponível do Espaço', 'Valor Devido', 'Já Repassado', 'Pendente', ...(podeLancar ? [''] : [])].map((h, i) => (
                    <th key={h || `acao-${i}`} className="px-2 py-2 text-left font-medium text-app-subtle uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border/50">
                {repasseSociosRows.map((r, i) => (
                  <tr key={`${r.espaco}-${r.socio}-${i}`}>
                    <td className="px-2 py-2 font-medium text-app-text whitespace-nowrap">{r.espaco}</td>
                    <td className="px-2 py-2 text-app-text2 whitespace-nowrap">{r.socio}</td>
                    <td className="px-2 py-2 text-app-text2 whitespace-nowrap">{r.percentual}%</td>
                    <td className="px-2 py-2 text-app-text2 whitespace-nowrap">{formatCurrency(r.lucro)}</td>
                    <td className="px-2 py-2 text-app-text2 whitespace-nowrap">{formatCurrency(r.valorDevido)}</td>
                    <td className="px-2 py-2 text-app-text2 whitespace-nowrap">{formatCurrency(r.jaRepassado)}</td>
                    <td className={`px-2 py-2 font-semibold whitespace-nowrap ${r.valorPendente > 0.01 ? 'text-amber-500' : 'text-[#128C7E]'}`}>{formatCurrency(r.valorPendente)}</td>
                    {podeLancar && (
                      <td className="px-2 py-2 print-hidden whitespace-nowrap">
                        <button
                          onClick={() => setRepasseAlvo({ espaco: r.espaco, socio: r.socio })}
                          className="rounded-md border border-app-border2 px-2 py-1 text-[11px] font-medium text-app-muted hover:border-[#25D366] hover:text-[#128C7E] transition-colors"
                        >
                          Registrar repasse
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

      {drillDown && (
        <LancamentoSocioListModal
          titulo={drillDown.titulo}
          rows={drillDownRows}
          fileModule={drillDown.tipo === 'aportes' ? 'receitas' : 'contas'}
          onClose={() => setDrillDown(null)}
          onEdit={drillDown.tipo === 'aportes' ? id => setEditandoAporteId(id) : id => setEditandoRetiradaId(id)}
          onPrint={() => handlePrintList(drillDown.titulo, drillDownRows)}
        />
      )}

      {resultadoDrillDown && (
        <LancamentoSocioListModal
          titulo={resultadoDrillDown === 'receitas' ? 'Receitas Operacionais' : 'Despesas Operacionais'}
          rows={resultadoDrillDownRows}
          fileModule={resultadoDrillDown === 'receitas' ? 'receitas' : 'contas'}
          colunaPessoa={resultadoDrillDown === 'receitas' ? 'Cliente' : 'Fornecedor'}
          onClose={() => setResultadoDrillDown(null)}
          onPrint={() => handlePrintList(resultadoDrillDown === 'receitas' ? 'Receitas Operacionais' : 'Despesas Operacionais', resultadoDrillDownRows, resultadoDrillDown === 'receitas' ? 'Cliente' : 'Fornecedor')}
        />
      )}

      {resumoObraDrillDown && (
        <LancamentoSocioListModal
          titulo={resumoObraDrillDown === 'aportes' ? 'Aporte Societário — Obra (todos os espaços)' : 'Despesas de Obra (todos os espaços)'}
          rows={resumoObraDrillDownRows}
          fileModule={resumoObraDrillDown === 'aportes' ? 'receitas' : 'contas'}
          colunaPessoa={resumoObraDrillDown === 'aportes' ? 'Sócio' : 'Fornecedor'}
          onClose={() => setResumoObraDrillDown(null)}
          onPrint={() => handlePrintList(resumoObraDrillDown === 'aportes' ? 'Aporte Societário — Obra' : 'Despesas de Obra', resumoObraDrillDownRows, resumoObraDrillDown === 'aportes' ? 'Sócio' : 'Fornecedor')}
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
          onPrint={() => handlePrintList(obraDrillDown.titulo, obraDrillDownRows, obraDrillDown.tipo === 'aportes' ? 'Sócio' : 'Fornecedor')}
        />
      )}

      {repasseAlvo && (
        <RegistrarRepasseModal
          espaco={repasseAlvo.espaco}
          socioNome={repasseAlvo.socio}
          onClose={() => setRepasseAlvo(null)}
          onConfirm={async (valor, data, observacoes) => {
            await addRepasse({ espaco: repasseAlvo.espaco, socioNome: repasseAlvo.socio, valor, data, observacoes })
            setRepasseAlvo(null)
            showToast('Repasse registrado.')
          }}
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

      </div>

      {/* Relatório completo — só aparece na impressão/PDF, nunca na tela.
          Cada tabela usa exatamente a mesma lista do "Visualizar" do card
          equivalente, garantindo que o PDF bate com o que está na tela.
          Só sai quando não há um "Exportar" de card específico em andamento
          (printScope null) — senão sairia duplicado junto da lista restrita. */}
      {!printScope && (
        <div className="hidden print:block space-y-4">
          <FullTable
            titulo="Receitas Operacionais" headers={['Data', 'Descrição', 'Categoria', 'Espaço', 'Cliente', 'Valor', 'Status', 'Observações']}
            rows={fechamento.entradasOperacionais.map(r => [r.data.split('-').reverse().join('/'), r.descricao, r.categoriaNome, r.espaco ?? '—', r.cliente ?? '—', formatCurrency(r.valor), r.status, r.observacoes ?? '—'])}
            totalLabel="Total" totalValor={formatCurrency(fechamento.totalEntradas)}
          />
          <FullTable
            titulo="Despesas Operacionais" headers={['Data Vencimento', 'Descrição', 'Fornecedor', 'Categoria', 'Espaço', 'Valor', 'Status', 'Observações']}
            rows={fechamento.despesasOperacionais.map(c => [c.dataVencimento.split('-').reverse().join('/'), c.descricao, c.fornecedor ?? '—', CATEGORIA_CONTA_LABEL[c.categoria] ?? c.categoria, c.espaco, formatCurrency(c.valor), c.status, c.observacoes ?? '—'])}
            totalLabel="Total" totalValor={formatCurrency(fechamento.totalSaidas)}
          />
          <FullTable
            titulo="Aporte Societário — Obra" headers={['Data', 'Sócio', 'Espaço', 'Descrição', 'Valor', 'Status']}
            rows={aportesObraEscopo.map(r => [r.data.split('-').reverse().join('/'), r.socioResponsavel ?? '—', r.espaco ?? '—', r.descricao, formatCurrency(r.valor), r.status])}
            totalLabel="Total acumulado" totalValor={formatCurrency(totalAportesObra)}
          />
          <FullTable
            titulo="Despesas de Obra" headers={['Data Vencimento', 'Descrição', 'Fornecedor', 'Espaço', 'Valor', 'Status']}
            rows={despesasObraEscopo.map(c => [c.dataVencimento.split('-').reverse().join('/'), c.descricao, c.fornecedor ?? '—', c.espaco, formatCurrency(c.valor), c.status])}
            totalLabel="Total acumulado" totalValor={formatCurrency(totalDespesasObra)}
          />
          <FullTable
            titulo="Fundo de Caixa" headers={['Tipo', 'Data', 'Descrição', 'Espaço', 'Valor', 'Status']}
            rows={[
              ...transferenciasFundoAllTime.map(c => ['Transferência', c.dataVencimento.split('-').reverse().join('/'), c.descricao, c.espaco, formatCurrency(c.valor), c.status]),
              ...retornosFundoAllTime.map(r => ['Retorno', r.data.split('-').reverse().join('/'), r.descricao, r.espaco ?? '—', formatCurrency(r.valor), r.status]),
            ]}
            totalLabel="Saldo atual" totalValor={formatCurrency(fechamento.saldoFundoAtual)}
          />
          {fundosEmEscopo.length > 0 && (
            <FullTable
              titulo="Reservas Genéricas" headers={['Fundo', 'Espaço', 'Tipo', 'Data', 'Descrição', 'Valor']}
              rows={fundosEmEscopo.flatMap(f => movimentacoes.filter(m => m.fundoId === f.id).map(m => [
                f.nome, f.espaco ?? 'Empresa toda', m.tipo === 'entrada' ? 'Entrada' : 'Saída', m.data.split('-').reverse().join('/'), m.descricao ?? '—', formatCurrency(m.valor),
              ]))}
              totalLabel="Saldo atual" totalValor={formatCurrency(fechamento.totalReservasGenericas)}
            />
          )}
          <FullTable
            titulo="Aportes de Sócios" headers={['Data', 'Sócio', 'Espaço', 'Descrição', 'Valor', 'Status']}
            rows={aportesSocioEscopo.map(r => [r.data.split('-').reverse().join('/'), r.socioResponsavel ?? '—', r.espaco ?? '—', r.descricao, formatCurrency(r.valor), r.status])}
            totalLabel="Total acumulado" totalValor={formatCurrency(resumoPorSocio.porSocio.reduce((s, p) => s + p.totalAportes, 0))}
          />
          <FullTable
            titulo="Retiradas de Sócios" headers={['Data', 'Sócio', 'Espaço', 'Descrição', 'Valor', 'Status', 'Origem']}
            rows={retiradasSocioEscopo.map(c => [c.dataPagamento ?? c.dataVencimento, c.fornecedor ?? '—', c.espaco, c.descricao, formatCurrency(c.valor), c.status, origemRetiradaLabel(c)])}
            totalLabel="Total acumulado" totalValor={formatCurrency(fechamento.totalRetiradasSocioAcumulado)}
          />
          <FullTable
            titulo="Disponível para Distribuição — por Sócio" headers={['Espaço', 'Sócio', '%', 'Disponível do Espaço', 'Valor Devido', 'Já Repassado', 'Pendente']}
            rows={repasseSociosRows.map(r => [r.espaco, r.socio, `${r.percentual}%`, formatCurrency(r.lucro), formatCurrency(r.valorDevido), formatCurrency(r.jaRepassado), formatCurrency(r.valorPendente)])}
            totalLabel="Disponível total" totalValor={formatCurrency(fechamento.disponivelParaDistribuicao)}
          />
        </div>
      )}

      {/* Impressão restrita a uma lista só (per-card "Exportar" ou "Imprimir"
          dentro de um modal de Visualizar). */}
      {printScope && (
        <div className="hidden print:block">
          <div className="mb-4 border-b pb-4">
            <p className="text-xs text-gray-500 mb-1">Espaços &amp; Locações</p>
            <h1 className="text-xl font-bold text-gray-900">{printScope.titulo}</h1>
            <p className="text-xs text-gray-400 mt-0.5">{espacosLabel} · Gerado em {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
          </div>
          <FullTable
            titulo={printScope.titulo}
            headers={['Data', printScope.colunaPessoa, 'Espaço', 'Valor', 'Descrição', 'Observações']}
            rows={printScope.rows.map(r => [r.data.split('-').reverse().join('/'), r.socio, r.espaco, formatCurrency(r.valor), r.descricao, r.observacoes ?? '—'])}
            totalLabel="Total" totalValor={formatCurrency(printScope.rows.reduce((s, r) => s + r.valor, 0))}
          />
        </div>
      )}

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

// Mesmo card do ResumoStat, mas com Visualizar/Exportar — usado só nos 4
// grupos do Resumo Financeiro que são soma direta de lançamentos brutos
// (Aporte Societário, Despesas de Obra, Receitas/Despesas Operacionais).
// O valor exibido é sempre a soma exata da lista aberta em "Visualizar" —
// nunca um número calculado à parte, pra nunca divergir (regra de conferência).
function ResumoStatAcionavel({ label, valor, cor, onVisualizar, onExportExcel, onExportPdf }: {
  label: string
  valor: number
  cor: string
  onVisualizar: () => void
  onExportExcel: () => void
  onExportPdf: () => void
}) {
  return (
    <div className="min-w-0 rounded-lg border border-app-border2/60 bg-app-bg p-3 space-y-2">
      <div>
        <p className="text-[11px] text-app-subtle">{label}</p>
        <p className={`text-sm font-bold break-words ${cor}`}>{formatCurrency(valor)}</p>
      </div>
      <div className="flex items-center gap-2 print-hidden">
        <button onClick={onVisualizar} className="text-[11px] font-medium text-app-muted hover:text-app-text underline decoration-dotted underline-offset-2">
          Visualizar
        </button>
        <ExportarRelatorioButton onExcel={onExportExcel} onPdf={onExportPdf} label="Exportar" />
      </div>
    </div>
  )
}

function SocioResumoCard({ nome, totalAportes, totalRetiradas, onVerAportes, onVerRetiradas }: {
  nome: string
  totalAportes: number
  totalRetiradas: number
  onVerAportes: () => void
  onVerRetiradas: () => void
}) {
  return (
    <div className="rounded-lg border border-app-border2/60 bg-app-bg p-4 space-y-3">
      <p className="text-sm font-semibold text-app-text">{nome}</p>
      {/* Aporte e retirada nunca se compensam — por isso não existe um
          card de "Saldo" aqui, de propósito. */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-app-subtle">Total de Aportes</p>
          <p className="font-semibold text-violet-600">{formatCurrency(totalAportes)}</p>
        </div>
        <div>
          <p className="text-app-subtle">Total de Retiradas</p>
          <p className="font-semibold text-fuchsia-600">{formatCurrency(totalRetiradas)}</p>
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

function RegistrarRepasseModal({ espaco, socioNome, onClose, onConfirm }: {
  espaco: string
  socioNome: string
  onClose: () => void
  onConfirm: (valor: number, data: string, observacoes?: string) => Promise<void>
}) {
  const [valor, setValor] = useState('')
  const [data, setData] = useState(() => new Date().toISOString().split('T')[0])
  const [observacoes, setObservacoes] = useState('')
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function handleConfirm() {
    setSubmitted(true)
    if (!valor || parseCurrencyBR(valor) <= 0 || !data) return
    setSaving(true)
    try {
      await onConfirm(parseCurrencyBR(valor), data, observacoes.trim() || undefined)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 print:hidden" onClick={onClose}>
      <div className="w-full max-w-md bg-app-surface rounded-2xl border border-app-border shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-app-border">
          <h2 className="text-sm font-semibold text-app-text">Registrar repasse — {socioNome}</h2>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-app-subtle hover:bg-app-surface2 transition-colors"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-app-subtle">{espaco}</p>
          <div>
            <label className="block text-xs text-app-muted mb-1">Valor (R$) *</label>
            <input type="text" inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00"
              className={`w-full rounded-lg border ${submitted && (!valor || parseCurrencyBR(valor) <= 0) ? 'border-red-500/50' : 'border-app-border2'} bg-app-surface2 px-3 py-1.5 text-sm text-app-text focus:outline-none`} />
          </div>
          <div>
            <label className="block text-xs text-app-muted mb-1">Data do repasse *</label>
            <input type="date" value={data} onChange={e => setData(e.target.value)}
              className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-3 py-1.5 text-sm text-app-text focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs text-app-muted mb-1">Observações</label>
            <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2}
              className="w-full resize-none rounded-lg border border-app-border2 bg-app-surface2 px-3 py-1.5 text-sm text-app-text focus:outline-none" />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-app-border">
          <button onClick={onClose} className="rounded-lg border border-app-border2 px-4 py-2 text-sm text-app-muted hover:bg-app-surface2 transition-colors">Cancelar</button>
          <button onClick={handleConfirm} disabled={saving}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            style={{ backgroundColor: '#25D366' }}>
            {saving ? 'Salvando…' : 'Confirmar repasse'}
          </button>
        </div>
      </div>
    </div>
  )
}
