'use client'

import { ESPACOS_CONFIG } from '@/lib/espacos-config'

export type Periodo = 'semanal' | 'mensal' | 'trimestral' | 'semestral' | 'anual'

export interface RelatorioFilters {
  periodo: Periodo
  espacos: string[]
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

  function toggleEspaco(nome: string) {
    const next = filters.espacos.includes(nome)
      ? filters.espacos.filter((e) => e !== nome)
      : [...filters.espacos, nome]
    onChange({ ...filters, espacos: next })
  }

  function setTodos() {
    onChange({ ...filters, espacos: [] })
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

      {/* Space selector */}
      <div>
        <p className="text-xs font-medium text-app-subtle uppercase tracking-wider mb-2">Espaços</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={setTodos}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all border ${
              filters.espacos.length === 0
                ? 'border-violet-500/40 bg-violet-500/10 text-violet-300'
                : 'border-app-border2 bg-app-surface2 text-app-muted hover:text-app-text'
            }`}
          >
            Todos
          </button>
          {ESPACOS_CONFIG.map((e) => {
            const active = filters.espacos.includes(e.nome)
            return (
              <button
                key={e.slug}
                onClick={() => toggleEspaco(e.nome)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all border ${
                  active
                    ? `${e.bgClass} ${e.borderClass} ${e.colorClass}`
                    : 'border-app-border2 bg-app-surface2 text-app-muted hover:text-app-text'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${e.dotClass}`} />
                {e.nome}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
