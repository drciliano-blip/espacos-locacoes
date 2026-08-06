'use client'

import { useState, useMemo, useEffect } from 'react'
import FilterBar, { type RelatorioFilters, type Periodo } from './FilterBar'
import KPISummary from './KPISummary'
import RevenueLineChart from './RevenueLineChart'
import SpaceBarChart from './SpaceBarChart'
import CategoryPieChart from './CategoryPieChart'
import RevenueByCategoryChart from './RevenueByCategoryChart'
import OccupancyAreaChart from './OccupancyAreaChart'
import ProjectionChart from './ProjectionChart'
import SummaryTable from './SummaryTable'
import { aggregateMonthly, calcularProjecoes, getPeriodRange } from '@/lib/relatorios-utils'
import { formatCurrency } from '@/lib/utils'
import { useEventos } from '@/contexts/EventosContext'
import { useReceitas } from '@/contexts/ReceitasContext'
import { useContasPagar } from '@/contexts/ContasPagarContext'
import { useEspacos } from '@/contexts/EspacosContext'
import { useRepasses } from '@/contexts/RepassesContext'
import { DIVISAO_SOCIOS } from '@/lib/socios-config'
import { downloadWorkbook, type ExportSheet } from '@/lib/xlsx-export'
import { gerarMesesDoPeriodo, aggregateFluxoCaixa } from '@/lib/fluxo-caixa-utils'
import { SUBCATEGORIA_LABEL } from './LancamentosTables'
import DespesasSection from './DespesasSection'
import RelatorioMensalSection from './RelatorioMensalSection'
import FluxoCaixaEspaco from './FluxoCaixaEspaco'
import ExportarRelatorioButton from './ExportarRelatorioButton'

function getDefaultFilters(): RelatorioFilters {
  const { inicio, fim } = getPeriodRange('anual')
  return {
    periodo: 'anual',
    espacos: [],
    dataInicio: inicio,
    dataFim: fim,
  }
}

const PERIODO_LABELS: Record<string, string> = {
  semanal: 'Semanal',
  mensal: 'Mensal',
  trimestral: 'Trimestral',
  semestral: 'Semestral',
  anual: 'Anual',
}

export default function RelatoriosClient() {
  const { eventos } = useEventos()
  const { receitas } = useReceitas()
  const { contas: contasPagar } = useContasPagar()
  const { espacosConfig } = useEspacos()
  const { repasses } = useRepasses()
  const [filters, setFilters] = useState<RelatorioFilters>(getDefaultFilters)

  // As listas discriminadas (receita/despesa item a item) ficam recolhidas na tela
  // pra não poluir a visualização, mas um <details> fechado não aparece no PDF/impressão
  // — sem isso, o relatório exportado saía sem o detalhamento exigido pra prestação de contas.
  useEffect(() => {
    function expandAll() {
      document.querySelectorAll<HTMLDetailsElement>('details').forEach(d => {
        d.dataset.wasOpen = d.open ? '1' : '0'
        d.open = true
      })
    }
    function restoreAll() {
      document.querySelectorAll<HTMLDetailsElement>('details[data-was-open]').forEach(d => {
        d.open = d.dataset.wasOpen === '1'
        delete d.dataset.wasOpen
      })
    }
    window.addEventListener('beforeprint', expandAll)
    window.addEventListener('afterprint', restoreAll)
    return () => {
      window.removeEventListener('beforeprint', expandAll)
      window.removeEventListener('afterprint', restoreAll)
    }
  }, [])

  function handleFiltersChange(f: RelatorioFilters) {
    if (f.periodo !== filters.periodo) {
      const { inicio, fim } = getPeriodRange(f.periodo)
      setFilters({ ...f, dataInicio: inicio, dataFim: fim })
    } else {
      setFilters(f)
    }
  }

  const { aggregates, projecoes } = useMemo(() => {
    const espacoFilter = filters.espacos.length > 0 ? filters.espacos : undefined
    const aggs = aggregateMonthly(eventos, receitas, espacoFilter, filters.dataInicio, filters.dataFim)
    const proj = calcularProjecoes(aggs)
    return { aggregates: aggs, projecoes: proj }
  }, [eventos, receitas, filters])

  const espacosLabel = filters.espacos.length === 0
    ? 'Todos os espaços'
    : filters.espacos.join(', ')

  const periodoLabel = PERIODO_LABELS[filters.periodo] ?? filters.periodo

  const selectedSpaces = filters.espacos.length > 0 ? filters.espacos : undefined
  const espacosParaTabela = useMemo(
    () => selectedSpaces ? espacosConfig.filter(e => selectedSpaces.includes(e.nome)) : espacosConfig,
    [espacosConfig, selectedSpaces],
  )

  const eventosPorId = useMemo(() => new Map(eventos.map(e => [e.id, e])), [eventos])

  // Mesmo filtro de espaço/período usado em todo o resto da tela (RelatorioMensalSection,
  // DespesasSection) — fonte única tanto pra exportação quanto pras tabelas de detalhamento
  // exibidas na própria tela (garante que tela, PDF e Excel mostrem sempre os mesmos números).
  const entradas = useMemo(() => receitas.filter(r => {
    const matchEspaco = !selectedSpaces || (r.espaco && selectedSpaces.includes(r.espaco))
    const matchInicio = !filters.dataInicio || r.data >= filters.dataInicio
    const matchFim = !filters.dataFim || r.data <= filters.dataFim
    return matchEspaco && matchInicio && matchFim
  }), [receitas, selectedSpaces, filters.dataInicio, filters.dataFim])

  const saidas = useMemo(() => contasPagar.filter(c => {
    const matchEspaco = !selectedSpaces || selectedSpaces.includes(c.espaco)
    const matchInicio = !filters.dataInicio || c.dataVencimento >= filters.dataInicio
    const matchFim = !filters.dataFim || c.dataVencimento <= filters.dataFim
    return matchEspaco && matchInicio && matchFim
  }), [contasPagar, selectedSpaces, filters.dataInicio, filters.dataFim])

  const eventosPorEspacoRows = useMemo(() => {
    const nomes = Array.from(new Set(aggregates.flatMap(m => Object.keys(m.eventosPorEspaco))))
    return { nomes, linhas: aggregates.map(m => ({ label: m.label, valores: nomes.map(nome => m.eventosPorEspaco[nome] ?? 0) })) }
  }, [aggregates])

  const eventosPorCategoriaRows = useMemo(() => {
    const nomes = Array.from(new Set(aggregates.flatMap(m => Object.keys(m.eventosPorCategoria))))
    return { nomes, linhas: aggregates.map(m => ({ label: m.label, valores: nomes.map(cat => m.eventosPorCategoria[cat] ?? 0) })) }
  }, [aggregates])

  // Receita por categoria (mesmo cálculo do gráfico de pizza — considera todas as
  // receitas do período/espaço filtrado, independente do status)
  const receitaPorCategoriaRows = useMemo(() => {
    const catMap: Record<string, number> = {}
    for (const r of entradas) catMap[r.categoriaNome] = (catMap[r.categoriaNome] ?? 0) + r.valor
    const total = Object.values(catMap).reduce((s, v) => s + v, 0)
    return Object.entries(catMap)
      .sort((a, b) => b[1] - a[1])
      .map(([nome, valor]) => ({ nome, valor, pct: total > 0 ? Math.round((valor / total) * 100) : 0 }))
  }, [entradas])

  // Despesas por categoria/subcategoria (mesmos totais dos cards e do gráfico de
  // barras da seção "Despesas — Operacional, Obra e Financeiro")
  const CATEGORIAS_DESPESA = ['operacional', 'obra', 'financeiro'] as const
  const CATEGORIA_DESPESA_LABEL: Record<string, string> = { operacional: 'Operacional', obra: 'Obra', financeiro: 'Financeiro' }
  const despesasPorCategoriaRows = useMemo(() => {
    const totalGeral = saidas.reduce((s, c) => s + c.valor, 0)
    return CATEGORIAS_DESPESA.map(cat => {
      const rows = saidas.filter(c => c.categoria === cat)
      const total = rows.reduce((s, c) => s + c.valor, 0)
      const pagas = rows.filter(c => c.status === 'pago').reduce((s, c) => s + c.valor, 0)
      return { categoria: CATEGORIA_DESPESA_LABEL[cat], total, pagas, pct: totalGeral > 0 ? Math.round((total / totalGeral) * 100) : 0 }
    })
  }, [saidas])

  const despesasPorSubcategoriaRows = useMemo(() => {
    const map: Record<string, Record<string, number>> = {}
    for (const c of saidas) {
      if (!map[c.subcategoria]) map[c.subcategoria] = { operacional: 0, obra: 0, financeiro: 0 }
      map[c.subcategoria][c.categoria] += c.valor
    }
    return Object.entries(map).map(([sub, vals]) => ({
      nome: SUBCATEGORIA_LABEL[sub] ?? sub, operacional: vals.operacional, obra: vals.obra, financeiro: vals.financeiro,
    }))
  }, [saidas])

  // Fluxo de caixa e divisão de lucros mês a mês, por espaço — mesmos dados da seção
  // "Fluxo de Caixa por Espaço", só que para TODOS os espaços filtrados de uma vez (a
  // seção interativa só mostra um espaço por vez no seletor dela).
  const fluxoPorEspaco = useMemo(() => {
    const meses = gerarMesesDoPeriodo(filters.dataInicio, filters.dataFim)
    return espacosParaTabela.map(e => ({
      espaco: e,
      meses: aggregateFluxoCaixa(e.nome, meses, receitas, contasPagar, repasses),
    }))
  }, [espacosParaTabela, filters.dataInicio, filters.dataFim, receitas, contasPagar, repasses])

  function handleExportExcel() {
    const resumoMensal: ExportSheet = {
      name: 'Resumo Mensal',
      rows: [
        ['Mês', 'Receita', 'Eventos', 'Ocupação (%)', ...espacosParaTabela.map(e => e.nome)],
        ...aggregates.map(m => [
          m.label, m.receita, m.totalEventos, m.taxaOcupacaoMedia,
          ...espacosParaTabela.map(e => m.receitaPorEspaco[e.nome] ?? 0),
        ]),
      ],
    }

    // Mesmas colunas exibidas na tela (Relatório Mensal) — nenhum lançamento ou
    // campo cadastrado fica de fora da exportação.
    const receitasSheet: ExportSheet = {
      name: 'Receitas',
      rows: [
        ['Descrição', 'Categoria', 'Evento', 'Cliente/Pagador', 'Espaço', 'Data Vencimento', 'Data Recebimento', 'Valor', 'Forma Pagamento', 'Status', 'Parcela', 'Observações', 'Condições da Parceria'],
        ...entradas.map(r => {
          const evento = r.eventoId ? eventosPorId.get(r.eventoId) : undefined
          const condicoesParceria = evento?.tipoContrato === 'parceria' ? (evento.condicoesParceria ?? '') : ''
          return [
            r.descricao, r.categoriaNome, evento?.nomeEvento || evento?.tipo || '', r.cliente ?? '', r.espaco ?? '',
            r.data, r.dataRecebimento ?? '', r.valor, r.metodoPagamento ?? '', r.status, r.parcelaLabel ?? '',
            r.observacoes ?? '', condicoesParceria,
          ]
        }),
      ],
    }

    const despesasSheet: ExportSheet = {
      name: 'Despesas',
      rows: [
        ['Descrição', 'Categoria', 'Subcategoria', 'Fornecedor/Beneficiário', 'Espaço', 'Data Vencimento', 'Data Pagamento', 'Valor', 'Status', 'Observações'],
        ...saidas.map(c => [c.descricao, c.categoria, c.subcategoria, c.fornecedor ?? '', c.espaco, c.dataVencimento, c.dataPagamento ?? '', c.valor, c.status, c.observacoes ?? '']),
      ],
    }

    const totalReceitasPeriodo = entradas.filter(r => r.status === 'pago').reduce((s, r) => s + r.valor, 0)
    const totalDespesasPeriodo = saidas.filter(c => c.status === 'pago').reduce((s, c) => s + c.valor, 0)
    const totaisSheet: ExportSheet = {
      name: 'Totais do Período',
      rows: [
        ['Total de Receitas', totalReceitasPeriodo],
        ['Total de Despesas', totalDespesasPeriodo],
        ['Saldo Final do Período', totalReceitasPeriodo - totalDespesasPeriodo],
        ['Lançamentos de Receita', entradas.length],
        ['Lançamentos de Despesa', saidas.length],
      ],
    }

    const divisaoRows: (string | number)[][] = [['Espaço', 'Receita', 'Despesa', 'Lucro', 'Sócio', 'Percentual (%)', 'Valor do Sócio']]
    for (const e of espacosParaTabela) {
      const receitaTotal = entradas.filter(r => r.status === 'pago' && r.espaco === e.nome).reduce((s, r) => s + r.valor, 0)
      const despesaTotal = saidas.filter(c => c.status === 'pago' && c.espaco === e.nome).reduce((s, c) => s + c.valor, 0)
      const lucro = receitaTotal - despesaTotal
      const socios = DIVISAO_SOCIOS[e.nome] ?? []
      if (socios.length === 0) {
        divisaoRows.push([e.nome, receitaTotal, despesaTotal, lucro, '', '', ''])
      } else {
        socios.forEach((s, i) => {
          divisaoRows.push([
            i === 0 ? e.nome : '', i === 0 ? receitaTotal : '', i === 0 ? despesaTotal : '', i === 0 ? lucro : '',
            s.nome, s.percentual, lucro * (s.percentual / 100),
          ])
        })
      }
    }
    const divisaoSheet: ExportSheet = { name: 'Divisão de Lucro', rows: divisaoRows }

    // Resumo (mesmos KPIs do topo da tela — cálculo replicado de KPISummary)
    const totalReceitaKpi = aggregates.reduce((s, m) => s + m.receita, 0)
    const totalEventosKpi = aggregates.reduce((s, m) => s + m.totalEventos, 0)
    const avgOcupacao = aggregates.length > 0
      ? Math.round(aggregates.reduce((s, m) => s + m.taxaOcupacaoMedia, 0) / aggregates.length) : 0
    const receitaMedia = aggregates.length > 0 ? Math.round(totalReceitaKpi / aggregates.length) : 0
    const prevHalf = aggregates.slice(0, Math.floor(aggregates.length / 2))
    const currHalf = aggregates.slice(Math.floor(aggregates.length / 2))
    const prevAvg = prevHalf.length ? prevHalf.reduce((s, m) => s + m.receita, 0) / prevHalf.length : 0
    const currAvg = currHalf.length ? currHalf.reduce((s, m) => s + m.receita, 0) / currHalf.length : 0
    const growthPct = prevAvg > 0 ? Math.round(((currAvg - prevAvg) / prevAvg) * 100) : 0
    const resumoSheet: ExportSheet = {
      name: 'Resumo',
      rows: [
        ['Período', `${filters.dataInicio} a ${filters.dataFim}`],
        ['Espaços filtrados', espacosLabel],
        ['Receita Total', totalReceitaKpi],
        ['Receita Média Mensal', receitaMedia],
        ['Total de Eventos', totalEventosKpi],
        ['Crescimento (1ª vs. 2ª metade do período)', `${growthPct >= 0 ? '+' : ''}${growthPct}%`],
        ['Ocupação Média', `${avgOcupacao}%`],
      ],
    }

    const eventosPorEspacoSheet: ExportSheet = {
      name: 'Eventos por Espaço (mensal)',
      rows: [
        ['Mês', ...eventosPorEspacoRows.nomes],
        ...eventosPorEspacoRows.linhas.map(l => [l.label, ...l.valores]),
      ],
    }
    const eventosPorCategoriaSheet: ExportSheet = {
      name: 'Eventos por Categoria (mensal)',
      rows: [
        ['Mês', ...eventosPorCategoriaRows.nomes],
        ...eventosPorCategoriaRows.linhas.map(l => [l.label, ...l.valores]),
      ],
    }
    const receitaPorCategoriaSheet: ExportSheet = {
      name: 'Receita por Categoria',
      rows: [['Categoria', 'Valor', '% do Total'], ...receitaPorCategoriaRows.map(r => [r.nome, r.valor, r.pct])],
    }
    const projecaoSheet: ExportSheet = {
      name: 'Projeção',
      rows: [
        ['Mês', 'Receita Projetada (Realista)', 'Cenário Pessimista', 'Cenário Otimista'],
        ...projecoes.map(p => [p.label, p.realista, p.pessimista, p.otimista]),
      ],
    }
    const despesasPorCategoriaSheet: ExportSheet = {
      name: 'Despesas por Categoria',
      rows: [['Categoria', 'Total', 'Pagas', '% do Total'], ...despesasPorCategoriaRows.map(r => [r.categoria, r.total, r.pagas, r.pct])],
    }
    const despesasPorSubcategoriaSheet: ExportSheet = {
      name: 'Despesas por Subcategoria',
      rows: [['Subcategoria', 'Operacional', 'Obra', 'Financeiro'], ...despesasPorSubcategoriaRows.map(r => [r.nome, r.operacional, r.obra, r.financeiro])],
    }

    const fluxoRows: (string | number)[][] = [
      ['Espaço', 'Mês', 'Saldo Inicial de Caixa', 'Total Entradas', 'Total Saídas', 'Saldo do Mês', 'Partilha Repassada', 'Saldo Após Partilha'],
    ]
    const divisaoLucrosMensalRows: (string | number)[][] = [
      ['Espaço', 'Mês', 'Sócio', 'Percentual (%)', 'Valor Devido', 'Valor Repassado', 'Valor Pendente', 'Situação'],
    ]
    for (const { espaco, meses } of fluxoPorEspaco) {
      meses.forEach((m, i) => {
        fluxoRows.push([
          espaco.nome, m.label, i === 0 ? (espaco.saldoInicialCaixa ?? 0) : '',
          m.totalEntradas, m.totalSaidas, m.saldoDoMes, m.partilhaRepassada, m.saldoAposPartilha,
        ])
        m.divisaoLucros.forEach(s => {
          divisaoLucrosMensalRows.push([espaco.nome, m.label, s.nome, s.percentual, s.valorDevido, s.valorRepassado, s.valorPendente, s.situacao])
        })
      })
    }
    const fluxoSheet: ExportSheet = { name: 'Fluxo de Caixa (mensal)', rows: fluxoRows }
    const divisaoLucrosMensalSheet: ExportSheet = { name: 'Divisão de Lucros (mensal)', rows: divisaoLucrosMensalRows }

    downloadWorkbook(
      [
        resumoSheet, totaisSheet, divisaoSheet, resumoMensal,
        eventosPorEspacoSheet, eventosPorCategoriaSheet, receitaPorCategoriaSheet, projecaoSheet,
        receitasSheet, despesasSheet, despesasPorCategoriaSheet, despesasPorSubcategoriaSheet,
        fluxoSheet, divisaoLucrosMensalSheet,
      ],
      `relatorio-${filters.dataInicio}-a-${filters.dataFim}.xlsx`,
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Print header — hidden on screen, visible when printing */}
      <div className="hidden print:block mb-6 border-b pb-4">
        <p className="text-xs text-gray-500 mb-1">Espaços &amp; Locações</p>
        <h1 className="text-xl font-bold text-gray-900">Relatório {periodoLabel}</h1>
        <p className="text-sm text-gray-600 mt-1">{espacosLabel}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          Período: {filters.dataInicio} → {filters.dataFim} &nbsp;·&nbsp; Gerado em{' '}
          {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
        </p>
      </div>

      <div className="flex items-center justify-between print-hidden">
        <div />
        <ExportarRelatorioButton onExcel={handleExportExcel} />
      </div>

      <FilterBar filters={filters} onChange={handleFiltersChange} />

      <KPISummary data={aggregates} />

      <RelatorioMensalSection
        selectedSpaces={filters.espacos.length > 0 ? filters.espacos : undefined}
        dataInicio={filters.dataInicio}
        dataFim={filters.dataFim}
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <RevenueLineChart data={aggregates} />
        <SpaceBarChart data={aggregates} selectedSpaces={filters.espacos} />
      </div>
      <DetailTable
        titulo="Ver tabela — Eventos por Espaço (mensal)"
        headers={['Mês', ...eventosPorEspacoRows.nomes]}
        rows={eventosPorEspacoRows.linhas.map(l => [l.label, ...l.valores])}
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <CategoryPieChart data={aggregates} />
        <OccupancyAreaChart data={aggregates} />
      </div>
      <DetailTable
        titulo="Ver tabela — Eventos por Categoria (mensal)"
        headers={['Mês', ...eventosPorCategoriaRows.nomes]}
        rows={eventosPorCategoriaRows.linhas.map(l => [l.label, ...l.valores])}
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <RevenueByCategoryChart
          dataInicio={filters.dataInicio}
          dataFim={filters.dataFim}
          selectedSpaces={filters.espacos.length > 0 ? filters.espacos : undefined}
        />
      </div>
      <DetailTable
        titulo="Ver tabela — Receita por Categoria"
        headers={['Categoria', 'Valor', '% do Total']}
        rows={receitaPorCategoriaRows.map(r => [r.nome, formatCurrency(r.valor), `${r.pct}%`])}
      />

      <ProjectionChart historico={aggregates} projecoes={projecoes} />
      <DetailTable
        titulo="Ver tabela — Projeção detalhada"
        headers={['Mês', 'Receita Projetada (Realista)', 'Cenário Pessimista', 'Cenário Otimista']}
        rows={projecoes.map(p => [p.label, formatCurrency(p.realista), formatCurrency(p.pessimista), formatCurrency(p.otimista)])}
      />

      <SummaryTable data={aggregates} selectedSpaces={filters.espacos} />

      <DespesasSection
        selectedSpaces={filters.espacos.length > 0 ? filters.espacos : undefined}
        dataInicio={filters.dataInicio}
        dataFim={filters.dataFim}
      />
      <DetailTable
        titulo="Ver tabela — Despesas por Subcategoria"
        headers={['Subcategoria', 'Operacional', 'Obra', 'Financeiro']}
        rows={despesasPorSubcategoriaRows.map(r => [r.nome, formatCurrency(r.operacional), formatCurrency(r.obra), formatCurrency(r.financeiro)])}
      />

      <FluxoCaixaEspaco
        selectedSpaces={filters.espacos.length > 0 ? filters.espacos : undefined}
        dataInicio={filters.dataInicio}
        dataFim={filters.dataFim}
      />

      {/* A seção acima só mostra um espaço por vez (seletor interativo) — este bloco
          traz o fluxo de caixa e a divisão de lucros mês a mês de TODOS os espaços
          filtrados de uma vez, pra nenhuma informação ficar de fora do PDF/Excel. */}
      <div className="rounded-2xl border border-app-border bg-app-surface p-5 space-y-3">
        <h3 className="text-sm font-semibold text-app-text">Fluxo de Caixa — Todos os Espaços Filtrados (mensal)</h3>
        {fluxoPorEspaco.map(({ espaco, meses }) => (
          <details key={espaco.nome} className="group rounded-lg border border-app-border2/60 bg-app-bg p-4">
            <summary className="cursor-pointer text-xs font-medium text-app-text hover:text-[#128C7E] transition-colors list-none flex items-center gap-1.5">
              <span className="group-open:hidden">▶</span>
              <span className="hidden group-open:inline">▼</span>
              {espaco.nome}
              <span className="text-app-subtle font-normal">— saldo inicial {formatCurrency(espaco.saldoInicialCaixa ?? 0)}</span>
            </summary>
            <div className="mt-3 space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-app-border">
                      {['Mês', 'Total Entradas', 'Total Saídas', 'Saldo do Mês', 'Partilha Repassada', 'Saldo Após Partilha'].map(h => (
                        <th key={h} className="px-2 py-1.5 text-left font-medium text-app-subtle uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-app-border/50">
                    {meses.map(m => (
                      <tr key={m.yearMonth}>
                        <td className="px-2 py-1.5 font-medium text-app-text whitespace-nowrap">{m.label}</td>
                        <td className="px-2 py-1.5 text-app-text2">{formatCurrency(m.totalEntradas)}</td>
                        <td className="px-2 py-1.5 text-app-text2">{formatCurrency(m.totalSaidas)}</td>
                        <td className="px-2 py-1.5 text-app-text2">{formatCurrency(m.saldoDoMes)}</td>
                        <td className="px-2 py-1.5 text-app-text2">{formatCurrency(m.partilhaRepassada)}</td>
                        <td className="px-2 py-1.5 text-app-text2">{formatCurrency(m.saldoAposPartilha)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {meses.some(m => m.divisaoLucros.length > 0) && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-app-border">
                        {['Mês', 'Sócio', '%', 'Valor Devido', 'Valor Repassado', 'Valor Pendente', 'Situação'].map(h => (
                          <th key={h} className="px-2 py-1.5 text-left font-medium text-app-subtle uppercase tracking-wide whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-app-border/50">
                      {meses.flatMap(m => m.divisaoLucros.map(s => (
                        <tr key={`${m.yearMonth}-${s.nome}`}>
                          <td className="px-2 py-1.5 font-medium text-app-text whitespace-nowrap">{m.label}</td>
                          <td className="px-2 py-1.5 text-app-text2">{s.nome}</td>
                          <td className="px-2 py-1.5 text-app-text2">{s.percentual}%</td>
                          <td className="px-2 py-1.5 text-app-text2">{formatCurrency(s.valorDevido)}</td>
                          <td className="px-2 py-1.5 text-app-text2">{formatCurrency(s.valorRepassado)}</td>
                          <td className="px-2 py-1.5 text-app-text2">{formatCurrency(s.valorPendente)}</td>
                          <td className="px-2 py-1.5 text-app-text2 capitalize">{s.situacao}</td>
                        </tr>
                      )))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </details>
        ))}
        {fluxoPorEspaco.length === 0 && (
          <p className="text-sm text-app-subtle text-center py-4">Nenhum espaço para exibir.</p>
        )}
      </div>
    </div>
  )
}

interface DetailTableProps {
  titulo: string
  headers: string[]
  rows: (string | number)[][]
}

// Tabela de apoio pras seções que na tela só têm gráfico (pizza/barra) — sem isso,
// os valores exatos por mês/categoria só existiam no Excel, nunca no PDF impresso.
// Fica recolhida por padrão (não polui a tela) mas se expande sozinha na impressão,
// junto com os outros <details> da página.
function DetailTable({ titulo, headers, rows }: DetailTableProps) {
  if (rows.length === 0) return null
  return (
    <details className="group rounded-xl border border-app-border bg-app-surface p-4">
      <summary className="cursor-pointer text-xs font-medium text-[#128C7E] hover:text-[#25D366] transition-colors list-none flex items-center gap-1.5">
        <span className="group-open:hidden">▶</span>
        <span className="hidden group-open:inline">▼</span>
        {titulo}
      </summary>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-app-border">
              {headers.map(h => (
                <th key={h} className="px-2 py-1.5 text-left font-medium text-app-subtle uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-app-border/50">
            {rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j} className="px-2 py-1.5 text-app-text2 whitespace-nowrap">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
