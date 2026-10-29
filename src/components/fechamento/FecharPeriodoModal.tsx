'use client'

import { useState } from 'react'
import { X, Lock, AlertTriangle } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { RepasseSocioSnapshot } from '@/contexts/FechamentosContext'
import { ehMesCheio, ultimoDiaDoMesISO } from '@/lib/fechamento-lock'

interface Props {
  espaco: string
  dataInicio: string
  dataFim: string
  resultadoOperacional: number
  disponivelParaDistribuicao: number
  repasseSocios: RepasseSocioSnapshot[]
  problemas: { bloqueios: string[]; avisos: string[] }
  // O período é escolhido aqui (mês cheio ou datas livres) e devolvido pro
  // Financeiro, que recalcula os valores do fechamento na hora.
  onChangePeriodo: (dataInicio: string, dataFim: string) => void
  onClose: () => void
  onConfirm: () => Promise<void>
}

export default function FecharPeriodoModal({
  espaco, dataInicio, dataFim, resultadoOperacional, disponivelParaDistribuicao, repasseSocios, problemas, onChangePeriodo, onClose, onConfirm,
}: Props) {
  const [modo, setModo] = useState<'mes' | 'periodo'>(() => ehMesCheio(dataInicio, dataFim) ? 'mes' : 'periodo')
  const bloqueado = problemas.bloqueios.length > 0
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function handleConfirm() {
    setSaving(true)
    setErro(null)
    try {
      await onConfirm()
    } catch (err) {
      // Erros do Supabase (ex: falha de insert) não são instâncias de Error —
      // são objetos simples com `.message` — sem isso a mensagem real do
      // banco nunca chegava na tela, só o texto genérico de fallback.
      const mensagem = err instanceof Error ? err.message
        : (err && typeof err === 'object' && 'message' in err) ? String((err as { message: unknown }).message)
        : 'Erro ao fechar o período.'
      setErro(mensagem)
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
          <div className="space-y-2">
            <div className="flex rounded-lg border border-app-border2 p-0.5 text-xs">
              {([['mes', 'Mês'], ['periodo', 'Período personalizado']] as const).map(([valor, label]) => (
                <button key={valor} type="button" onClick={() => setModo(valor)}
                  className={`flex-1 rounded-md px-3 py-1.5 font-medium transition-colors ${modo === valor ? 'bg-app-surface2 text-app-text' : 'text-app-subtle hover:text-app-text'}`}>
                  {label}
                </button>
              ))}
            </div>
            {modo === 'mes' ? (
              <div>
                <label className="text-xs text-app-subtle mb-0.5 block">Mês a fechar</label>
                <input type="month" value={dataInicio.slice(0, 7)}
                  onChange={e => { if (e.target.value) onChangePeriodo(`${e.target.value}-01`, ultimoDiaDoMesISO(`${e.target.value}-01`)) }}
                  className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-app-subtle mb-0.5 block">Data inicial</label>
                  <input type="date" value={dataInicio} max={dataFim || undefined}
                    onChange={e => onChangePeriodo(e.target.value, dataFim)}
                    className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-app-subtle mb-0.5 block">Data final</label>
                  <input type="date" value={dataFim} min={dataInicio || undefined}
                    onChange={e => onChangePeriodo(dataInicio, e.target.value)}
                    className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none" />
                </div>
              </div>
            )}
            <p className="text-sm font-semibold text-app-text">Período: {formatDate(dataInicio)} a {formatDate(dataFim)}</p>
          </div>

          {problemas.bloqueios.map(m => (
            <div key={m} className="flex gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5">
              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-500">{m}</p>
            </div>
          ))}
          {problemas.avisos.map(m => (
            <div key={m} className="flex gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-600">{m}</p>
            </div>
          ))}

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
          <button onClick={handleConfirm} disabled={saving || bloqueado}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            style={{ backgroundColor: '#25D366' }}>
            {saving ? 'Fechando…' : 'Confirmar Fechamento'}
          </button>
        </div>
      </div>
    </div>
  )
}
