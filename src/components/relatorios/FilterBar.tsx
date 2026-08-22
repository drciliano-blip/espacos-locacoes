'use client'

export type Periodo = 'semanal' | 'mensal' | 'trimestral' | 'semestral' | 'anual'

// Espaço saiu daqui — a seleção agora é global (Dashboard/EspacoAtivoContext),
// esse filtro cuida só do período.
export interface RelatorioFilters {
  periodo: Periodo
  dataInicio: string
  dataFim: string
}

const PERIODOS: { value: Periodo; label: string }[] = [
  { value: 'semanal', label: 'Semanal' },
  { value: 'mensal', label: 'Mensal' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral', label: 'Semestral' },
  { value: 'anual', label: 'Anual' },
]

interface FilterBarProps {
  filters: RelatorioFilters
  onChange: (f: RelatorioFilters) => void
}

export default function FilterBar({ filters, onChange }: FilterBarProps) {
  function setPeriodo(periodo: Periodo) {
    onChange({ ...filters, periodo })
  }

  return (
    <div className="rounded-xl border border-app-border bg-app-surface p-4 space-y-4 print:hidden">
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Period selector */}
        <div>
          <p className="text-xs font-medium text-app-subtle uppercase tracking-wider mb-2">Período</p>
          <div className="flex gap-1.5 flex-wrap">
            {PERIODOS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setPeriodo(value)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                  filters.periodo === value
                    ? 'bg-violet-600 text-white'
                    : 'bg-app-surface2 text-app-muted hover:bg-app-surface3 hover:text-app-text'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Date range */}
        <div className="flex gap-3 flex-1 flex-wrap sm:justify-end items-end">
          <div>
            <p className="text-xs font-medium text-app-subtle uppercase tracking-wider mb-2">De</p>
            <input
              type="date"
              value={filters.dataInicio}
              onChange={(e) => onChange({ ...filters, dataInicio: e.target.value })}
              className="rounded-lg border border-app-border2 bg-app-surface2 px-3 py-1.5 text-sm text-app-text2 focus:border-violet-500 focus:outline-none"
            />
          </div>
          <div>
            <p className="text-xs font-medium text-app-subtle uppercase tracking-wider mb-2">Até</p>
            <input
              type="date"
              value={filters.dataFim}
              onChange={(e) => onChange({ ...filters, dataFim: e.target.value })}
              className="rounded-lg border border-app-border2 bg-app-surface2 px-3 py-1.5 text-sm text-app-text2 focus:border-violet-500 focus:outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
