'use client'

import type { MonthlyAggregate } from '@/lib/relatorios-utils'
import { formatCurrency } from '@/lib/utils'
import { useEspacos } from '@/contexts/EspacosContext'
import { downloadWorkbook, type ExportSheet } from '@/lib/xlsx-export'
import ExportarRelatorioButton from './ExportarRelatorioButton'

interface SummaryTableProps {
  data: MonthlyAggregate[]
  selectedSpaces: string[]
}

export default function SummaryTable({ data, selectedSpaces }: SummaryTableProps) {
  const { espacosConfig } = useEspacos()
  const spaces = selectedSpaces.length > 0
    ? espacosConfig.filter((e) => selectedSpaces.includes(e.nome))
    : espacosConfig

  const totals = {
    receita: data.reduce((s, m) => s + m.receita, 0),
    eventos: data.reduce((s, m) => s + m.totalEventos, 0),
    ocupacao: data.length > 0 ? Math.round(data.reduce((s, m) => s + m.taxaOcupacaoMedia, 0) / data.length) : 0,
  }

  function handleExportExcel() {
    const sheet: ExportSheet = {
      name: 'Tabela Resumo',
      rows: [
        ['Mês', 'Receita', 'Eventos', 'Ocupação (%)', ...spaces.map(e => e.nome)],
        ...data.map(m => [m.label, m.receita, m.totalEventos, m.taxaOcupacaoMedia, ...spaces.map(e => m.receitaPorEspaco[e.nome] ?? 0)]),
        ['TOTAL', totals.receita, totals.eventos, totals.ocupacao, ...spaces.map(e => data.reduce((s, m) => s + (m.receitaPorEspaco[e.nome] ?? 0), 0))],
      ],
    }
    downloadWorkbook([sheet], 'tabela-resumo-por-periodo.xlsx')
  }

  return (
    <div className="rounded-xl border border-app-border bg-app-surface">
      <div className="flex items-center justify-between px-5 py-4 border-b border-app-border">
        <h3 className="text-sm font-semibold text-app-text">Tabela Resumo por Período</h3>
        <ExportarRelatorioButton onExcel={handleExportExcel} />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-app-border">
              <th className="px-4 py-3 text-left text-xs font-medium text-app-subtle uppercase tracking-wider">Mês</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-app-subtle uppercase tracking-wider">Receita</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-app-subtle uppercase tracking-wider">Eventos</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-app-subtle uppercase tracking-wider">Ocupação</th>
              {spaces.map((e) => (
                <th key={e.nome} className="px-4 py-3 text-right text-xs font-medium text-app-subtle uppercase tracking-wider whitespace-nowrap">
                  {e.nome}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-app-border/50">
            {data.length === 0 ? (
              <tr>
                <td colSpan={4 + spaces.length} className="px-4 py-8 text-center text-sm text-app-subtle">
                  Nenhum dado para o período selecionado.
                </td>
              </tr>
            ) : (
              data.map((m) => (
                <tr key={m.yearMonth} className="hover:bg-app-surface2/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-app-text">{m.label}</td>
                  <td className="px-4 py-3 text-right text-violet-400 font-semibold">{formatCurrency(m.receita)}</td>
                  <td className="px-4 py-3 text-right text-app-text2">{m.totalEventos}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-sm font-medium ${
                      m.taxaOcupacaoMedia >= 80 ? 'text-emerald-400' :
                      m.taxaOcupacaoMedia >= 50 ? 'text-amber-400' : 'text-red-400'
                    }`}>
                      {m.taxaOcupacaoMedia}%
                    </span>
                  </td>
                  {spaces.map((e) => (
                    <td key={e.nome} className="px-4 py-3 text-right text-app-muted text-xs">
                      {formatCurrency(m.receitaPorEspaco[e.nome] ?? 0)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
          {data.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-app-border2">
                <td className="px-4 py-3 font-bold text-app-text">TOTAL</td>
                <td className="px-4 py-3 text-right font-bold text-violet-500 dark:text-violet-300">{formatCurrency(totals.receita)}</td>
                <td className="px-4 py-3 text-right font-bold text-app-text2">{totals.eventos}</td>
                <td className="px-4 py-3 text-right font-bold text-app-text2">{totals.ocupacao}%</td>
                {spaces.map((e) => (
                  <td key={e.nome} className="px-4 py-3 text-right font-semibold text-app-text2 text-xs">
                    {formatCurrency(data.reduce((s, m) => s + (m.receitaPorEspaco[e.nome] ?? 0), 0))}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
