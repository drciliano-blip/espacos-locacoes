'use client'

import { useState, useMemo } from 'react'
import { FileDown } from 'lucide-react'
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
import DespesasSection from './DespesasSection'

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
  const [filters, setFilters] = useState<RelatorioFilters>(getDefaultFilters)

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
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-lg border border-app-border2 bg-app-surface px-4 py-2 text-sm font-medium text-app-muted hover:bg-app-surface2 hover:text-app-text transition-colors"
        >
          <FileDown className="h-4 w-4" />
          Exportar PDF
        </button>
      </div>

      <FilterBar filters={filters} onChange={handleFiltersChange} />

      <KPISummary data={aggregates} />

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
    </div>
  )
}
