'use client'

import { useState } from 'react'
import { X, Lock, AlertTriangle } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { RepasseSocioSnapshot } from '@/contexts/FechamentosContext'

interface Props {
  espaco: string
  dataInicio: string
  dataFim: string
  resultadoOperacional: number
  disponivelParaDistribuicao: number
  repasseSocios: RepasseSocioSnapshot[]
  onClose: () => void
  onConfirm: () => Promise<void>
}

export default function FecharPeriodoModal({
  espaco, dataInicio, dataFim, resultadoOperacional, disponivelParaDistribuicao, repasseSocios, onClose, onConfirm,
}: Props) {
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function handleConfirm() {
    setSaving(true)
    setErro(null)
    try {
      await onConfirm()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao fechar o período.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 print:hidden" onClick={onClose}>
      <div className="w-full max-w-md bg-app-surface rounded-2xl border border-app-border shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-app-border">
          <h2 className="text-sm font-semibold text-app-text flex items-center gap-2">
            <Lock className="h-4 w-4 text-app-subtle" />
            Fechar Período — {espaco}
          </h2>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-app-subtle hover:bg-app-surface2 transition-colors"><X className="h-4 w-4" /></button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-app-subtle">{formatDate(dataInicio)} a {formatDate(dataFim)}</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-app-border2 bg-app-surface2/50 p-3">
              <p className="text-xs text-app-subtle">Resultado Operacional</p>
              <p className="text-sm font-semibold text-app-text mt-0.5">{formatCurrency(resultadoOperacional)}</p>
            </div>
            <div className="rounded-lg border border-app-border2 bg-app-surface2/50 p-3">
              <p className="text-xs text-app-subtle">Disponível p/ Distribuição</p>
              <p className="text-sm font-semibold text-app-text mt-0.5">{formatCurrency(disponivelParaDistribuicao)}</p>
            </div>
          </div>

          {repasseSocios.length > 0 && (
            <div className="rounded-lg border border-app-border2 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-app-surface2/50">
                  <tr>
                    <th className="text-left px-3 py-1.5 font-medium text-app-subtle">Sócio</th>
                    <th className="text-right px-3 py-1.5 font-medium text-app-subtle">Pendente</th>
                  </tr>
                </thead>
                <tbody>
                  {repasseSocios.map(r => (
                    <tr key={r.socio} className="border-t border-app-border2/50">
                      <td className="px-3 py-1.5 text-app-text2">{r.socio}</td>
                      <td className="px-3 py-1.5 text-right text-app-text2">{formatCurrency(r.valorPendente)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-600">
              Depois de fechado, lançamentos de receita e despesa deste espaço datados dentro desse período não podem mais ser editados ou excluídos. Pode ser desfeito em &quot;Histórico de Fechamentos&quot;.
            </p>
          </div>

          {erro && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5">
              <p className="text-xs text-red-500">{erro}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-app-border">
          <button onClick={onClose} className="rounded-lg border border-app-border2 px-4 py-2 text-sm text-app-muted hover:bg-app-surface2 transition-colors">Cancelar</button>
          <button onClick={handleConfirm} disabled={saving}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            style={{ backgroundColor: '#25D366' }}>
            {saving ? 'Fechando…' : 'Confirmar Fechamento'}
          </button>
        </div>
      </div>
    </div>
  )
}
