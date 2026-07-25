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
import { useEventos } from '@/contexts/EventosContext'
import { useReceitas } from '@/contexts/ReceitasContext'
import { useContasPagar } from '@/contexts/ContasPagarContext'
import { useEspacos } from '@/contexts/EspacosContext'
import { DIVISAO_SOCIOS } from '@/lib/socios-config'
import { downloadWorkbook, type ExportSheet } from '@/lib/xlsx-export'
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

  function handleExportExcel() {
    const selectedSpaces = filters.espacos.length > 0 ? filters.espacos : undefined
    const espacosParaTabela = selectedSpaces
      ? espacosConfig.filter(e => selectedSpaces.includes(e.nome))
      : espacosConfig

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

    const eventosPorId = new Map(eventos.map(e => [e.id, e]))
    const entradas = receitas.filter(r => {
      const matchEspaco = !selectedSpaces || (r.espaco && selectedSpaces.includes(r.espaco))
      const matchInicio = !filters.dataInicio || r.data >= filters.dataInicio
      const matchFim = !filters.dataFim || r.data <= filters.dataFim
      return matchEspaco && matchInicio && matchFim
    })
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

    const saidas = contasPagar.filter(c => {
      const matchEspaco = !selectedSpaces || selectedSpaces.includes(c.espaco)
      const matchInicio = !filters.dataInicio || c.dataVencimento >= filters.dataInicio
      const matchFim = !filters.dataFim || c.dataVencimento <= filters.dataFim
      return matchEspaco && matchInicio && matchFim
    })
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

    downloadWorkbook(
      [totaisSheet, resumoMensal, receitasSheet, despesasSheet, divisaoSheet],
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

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <CategoryPieChart data={aggregates} />
        <OccupancyAreaChart data={aggregates} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <RevenueByCategoryChart
          dataInicio={filters.dataInicio}
          dataFim={filters.dataFim}
          selectedSpaces={filters.espacos.length > 0 ? filters.espacos : undefined}
        />
      </div>

      <ProjectionChart historico={aggregates} projecoes={projecoes} />

      <SummaryTable data={aggregates} selectedSpaces={filters.espacos} />

      <DespesasSection
        selectedSpaces={filters.espacos.length > 0 ? filters.espacos : undefined}
        dataInicio={filters.dataInicio}
        dataFim={filters.dataFim}
      />

      <FluxoCaixaEspaco />
    </div>
  )
}
