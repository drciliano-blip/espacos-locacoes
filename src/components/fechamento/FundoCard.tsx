'use client'

import { useState } from 'react'
import { Vault, Plus, Minus, History } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { useFundos, type Fundo, type MovimentacaoFundo, type TipoMovimentacaoFundo } from '@/contexts/FundosContext'
import MovimentacaoFundoModal from './MovimentacaoFundoModal'

interface Props {
  fundo: Fundo
  movimentacoes: MovimentacaoFundo[] // já filtradas pra esse fundo
  podeMovimentar: boolean
  onMovimentado: (msg: string) => void
}

export default function FundoCard({ fundo, movimentacoes, podeMovimentar, onMovimentado }: Props) {
  const { addMovimentacao } = useFundos()
  const [movimentando, setMovimentando] = useState<TipoMovimentacaoFundo | null>(null)
  const [verHistorico, setVerHistorico] = useState(false)

  const totalEntradas = movimentacoes.filter(m => m.tipo === 'entrada').reduce((s, m) => s + m.valor, 0)
  const totalSaidas = movimentacoes.filter(m => m.tipo === 'saida').reduce((s, m) => s + m.valor, 0)
  const saldo = totalEntradas - totalSaidas
  const progresso = fundo.meta && fundo.meta > 0 ? Math.min(100, Math.max(0, (saldo / fundo.meta) * 100)) : null

  return (
    <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-app-text flex items-center gap-1.5">
            <Vault className="h-4 w-4 text-amber-500" />
            {fundo.nome}
          </p>
          {fundo.descricao && <p className="text-xs text-app-subtle mt-0.5">{fundo.descricao}</p>}
          <p className="text-xs text-app-subtle mt-0.5">{fundo.espaco ?? 'Empresa toda'}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-app-subtle">Saldo atual</p>
          <p className="text-lg font-bold text-amber-600">{formatCurrency(saldo)}</p>
        </div>
      </div>

      {progresso !== null && (
        <div>
          <div className="h-1.5 rounded-full bg-app-surface2 overflow-hidden">
            <div className="h-full bg-amber-500" style={{ width: `${progresso}%` }} />
          </div>
          <p className="text-[11px] text-app-subtle mt-1">{progresso.toFixed(0)}% da meta de {formatCurrency(fundo.meta as number)}</p>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {podeMovimentar && (
          <>
            <button onClick={() => setMovimentando('entrada')}
              className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-600 hover:bg-emerald-500/20 transition-colors">
              <Plus className="h-3.5 w-3.5" />
              Adicionar
            </button>
            <button onClick={() => setMovimentando('saida')}
              className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/20 transition-colors">
              <Minus className="h-3.5 w-3.5" />
              Retirar
            </button>
          </>
        )}
        <button onClick={() => setVerHistorico(v => !v)}
          className="flex items-center gap-1.5 rounded-lg border border-app-border2 px-3 py-1.5 text-xs text-app-muted hover:bg-app-surface2 transition-colors">
          <History className="h-3.5 w-3.5" />
          {verHistorico ? 'Ocultar histórico' : `Histórico (${movimentacoes.length})`}
        </button>
      </div>

      {verHistorico && (
        <div className="overflow-x-auto">
          {movimentacoes.length === 0 ? (
            <p className="text-xs text-app-subtle py-2">Nenhuma movimentação ainda.</p>
          ) : (
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-app-border">
                  {['Data', 'Tipo', 'Valor', 'Responsável', 'Descrição'].map(h => (
                    <th key={h} className="px-2 py-1.5 text-left font-medium text-app-subtle uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border/50">
                {movimentacoes.map(m => (
                  <tr key={m.id}>
                    <td className="px-2 py-1.5 text-app-text2 whitespace-nowrap">{m.data.split('-').reverse().join('/')}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      <span className={m.tipo === 'entrada' ? 'text-emerald-600' : 'text-red-500'}>
                        {m.tipo === 'entrada' ? '+ Entrada' : '− Saída'}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 font-semibold text-app-text whitespace-nowrap">{formatCurrency(m.valor)}</td>
                    <td className="px-2 py-1.5 text-app-text2 whitespace-nowrap">{m.responsavel ?? '—'}</td>
                    <td className="px-2 py-1.5 text-app-text2 max-w-[220px] truncate">{m.descricao ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {movimentando && (
        <MovimentacaoFundoModal
          fundo={fundo}
          tipo={movimentando}
          onClose={() => setMovimentando(null)}
          onSave={addMovimentacao}
          onSaved={() => onMovimentado(movimentando === 'entrada' ? 'Entrada registrada no fundo.' : 'Retirada registrada do fundo.')}
        />
      )}
    </div>
  )
}
