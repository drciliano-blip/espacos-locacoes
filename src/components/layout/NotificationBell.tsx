'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Bell, AlertCircle, Receipt, DollarSign } from 'lucide-react'
import { useContasPagar } from '@/contexts/ContasPagarContext'
import { useReceitas } from '@/contexts/ReceitasContext'
import { formatCurrency, formatDate } from '@/lib/utils'

export default function NotificationBell() {
  const { contas } = useContasPagar()
  const { receitas } = useReceitas()
  const [open, setOpen] = useState(false)

  const contasAtrasadas = useMemo(() => contas.filter(c => c.status === 'atrasado'), [contas])
  const receitasAtrasadas = useMemo(() => receitas.filter(r => r.status === 'atrasado'), [receitas])
  const total = contasAtrasadas.length + receitasAtrasadas.length

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg text-app-muted hover:bg-app-surface2 hover:text-app-text transition-colors"
      >
        <Bell className="h-4 w-4" />
        {total > 0 && (
          <span className="absolute top-1 right-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white">
            {total > 9 ? '9+' : total}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 w-80 max-h-96 overflow-y-auto rounded-xl border border-app-border bg-app-surface shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-app-border bg-app-surface px-4 py-3">
              <p className="text-sm font-semibold text-app-text">Pagamentos em atraso</p>
              <span className="text-xs text-app-subtle">{total}</span>
            </div>

            {total === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-app-subtle">Nenhum pagamento em atraso 🎉</p>
            ) : (
              <div className="divide-y divide-app-border/50">
                {contasAtrasadas.map(c => (
                  <Link
                    key={c.id}
                    href="/contas-a-pagar"
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-2.5 px-4 py-3 hover:bg-app-surface2/50 transition-colors"
                  >
                    <Receipt className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-app-text truncate">{c.descricao}</p>
                      <p className="text-xs text-app-subtle mt-0.5">
                        {c.espaco} · Venceu {c.dataVencimento.split('-').reverse().join('/')}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-red-500 shrink-0">{formatCurrency(c.valor)}</span>
                  </Link>
                ))}
                {receitasAtrasadas.map(r => (
                  <Link
                    key={r.id}
                    href="/eventos"
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-2.5 px-4 py-3 hover:bg-app-surface2/50 transition-colors"
                  >
                    {r.parcelaNumero != null ? (
                      <DollarSign className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-app-text truncate">{r.descricao}</p>
                      <p className="text-xs text-app-subtle mt-0.5">
                        {r.cliente ?? r.espaco ?? r.categoriaNome} · Venceu {formatDate(r.data)}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-red-500 shrink-0">{formatCurrency(r.valor)}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
