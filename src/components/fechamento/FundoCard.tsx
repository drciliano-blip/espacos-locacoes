'use client'

import { useState } from 'react'
import { Vault, Plus, Minus, History, Trash2 } from 'lucide-react'
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
  const { addMovimentacao, deleteFundo } = useFundos()
  const [movimentando, setMovimentando] = useState<TipoMovimentacaoFundo | null>(null)
  const [verHistorico, setVerHistorico] = useState(false)
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [erroExcluir, setErroExcluir] = useState<string | null>(null)

  const totalEntradas = movimentacoes.filter(m => m.tipo === 'entrada').reduce((s, m) => s + m.valor, 0)
  const totalSaidas = movimentacoes.filter(m => m.tipo === 'saida').reduce((s, m) => s + m.valor, 0)
  const saldo = totalEntradas - totalSaidas
  const podeExcluir = saldo === 0

  async function handleExcluir() {
    setExcluindo(true)
    setErroExcluir(null)
    try {
      await deleteFundo(fundo.id)
      onMovimentado(`Fundo "${fundo.nome}" excluído.`)
    } catch (err) {
      setErroExcluir(err instanceof Error ? err.message : 'Falha ao excluir o fundo.')
    } finally {
      setExcluindo(false)
    }
  }

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

      {erroExcluir && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">{erroExcluir}</p>
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
        {podeMovimentar && (
          <button onClick={() => setConfirmandoExclusao(true)} disabled={!podeExcluir}
            title={podeExcluir ? undefined : 'Só é possível excluir um fundo com saldo zerado.'}
            className="flex items-center gap-1.5 rounded-lg border border-app-border2 px-3 py-1.5 text-xs text-app-muted hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-app-muted">
            <Trash2 className="h-3.5 w-3.5" />
            Excluir
          </button>
        )}
      </div>

      {confirmandoExclusao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setConfirmandoExclusao(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-app-border bg-app-surface p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-app-text mb-2">Excluir fundo?</h3>
            <p className="text-sm text-app-muted mb-5">
              "{fundo.nome}" — saldo R$ 0,00. Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmandoExclusao(false)} disabled={excluindo}
                className="rounded-lg border border-app-border2 px-4 py-2 text-sm text-app-muted hover:bg-app-surface2 transition-colors disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={async () => { await handleExcluir(); setConfirmandoExclusao(false) }} disabled={excluindo}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 transition-colors disabled:opacity-50">
                {excluindo ? 'Excluindo…' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

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
