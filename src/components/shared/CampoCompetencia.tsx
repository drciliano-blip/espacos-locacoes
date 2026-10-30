'use client'

import { CalendarClock } from 'lucide-react'
import { hojeISO } from '@/lib/utils'

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

// "2026-12-01" → "dez/2026"
export function mesCompetenciaLabel(iso: string): string {
  const [y, m] = iso.split('-')
  return `${MESES[Number(m) - 1]}/${y}`
}

interface Props {
  // '' = conta no mês do pagamento (padrão); senão 'YYYY-MM-01'
  value: string
  onChange: (value: string) => void
  // Data do evento, quando houver — vira o atalho "Mês do evento".
  dataEvento?: string
}

// Recebimento contabilizado em outro mês: o dinheiro entra hoje, mas o
// Financeiro, o fechamento e o repasse aos sócios contam no mês escolhido.
export default function CampoCompetencia({ value, onChange, dataEvento }: Props) {
  const ativo = !!value
  const mesEvento = dataEvento ? `${dataEvento.slice(0, 7)}-01` : undefined

  return (
    <div className="rounded-lg border border-app-border2 bg-app-surface2/50 px-3 py-2.5 space-y-2">
      <label className="flex items-center gap-2 text-sm text-app-text cursor-pointer">
        <input
          type="checkbox"
          checked={ativo}
          onChange={e => onChange(e.target.checked ? (mesEvento ?? `${hojeISO().slice(0, 7)}-01`) : '')}
          className="h-4 w-4 accent-[#25D366]"
        />
        <CalendarClock className="h-4 w-4 text-app-subtle" />
        <span className="font-medium">Contabilizar em outro mês</span>
      </label>
      {ativo ? (
        <div className="pl-6 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="month"
              value={value.slice(0, 7)}
              onChange={e => { if (e.target.value) onChange(`${e.target.value}-01`) }}
              className="rounded-lg border border-app-border2 bg-app-surface px-2.5 py-1.5 text-sm text-app-text focus:outline-none"
            />
            {mesEvento && mesEvento !== value && (
              <button type="button" onClick={() => onChange(mesEvento)}
                className="rounded-lg border border-app-border2 px-2.5 py-1.5 text-xs text-app-muted hover:bg-app-surface2 transition-colors">
                Mês do evento ({mesCompetenciaLabel(mesEvento)})
              </button>
            )}
          </div>
          <p className="text-xs text-app-muted">
            Conta no Financeiro e no fechamento de <span className="font-semibold text-app-text">{mesCompetenciaLabel(value)}</span>, não no mês em que o dinheiro entrou.
          </p>
        </div>
      ) : (
        <p className="pl-6 text-xs text-app-subtle">Desmarcado, o valor conta no mês da data de pagamento.</p>
      )}
    </div>
  )
}
