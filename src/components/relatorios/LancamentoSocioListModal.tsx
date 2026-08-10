'use client'

import { useEffect, useState } from 'react'
import { X, Paperclip, Pencil } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { getFiles, viewFile, type StoredFile } from '@/lib/file-storage'

export interface LancamentoSocioRow {
  id: string
  data: string
  socio: string
  espaco: string
  valor: number
  descricao: string
  observacoes?: string
  // Só preenchido pra retiradas — mostra se veio do "+ Retirada" (Financeiro
  // → Sócios) ou de uma conta lançada/paga em Contas a Pagar. Ajuda a
  // conferir de onde veio um valor quando o total do sócio parecer estranho.
  origem?: 'Retirada Manual' | 'Conta Paga' | 'Origem não identificada'
}

export function origemRetiradaLabel(c: { origemLancamento?: 'retirada_manual' | 'contas_a_pagar' }): 'Retirada Manual' | 'Conta Paga' | 'Origem não identificada' {
  if (c.origemLancamento === 'retirada_manual') return 'Retirada Manual'
  if (c.origemLancamento === 'contas_a_pagar') return 'Conta Paga'
  return 'Origem não identificada'
}

interface Props {
  titulo: string
  rows: LancamentoSocioRow[]
  fileModule: StoredFile['module']
  onClose: () => void
  // Só faz sentido pra aportes hoje (Receita já tem EditarEntradaModal
  // pronto) — quando ausente, a lista fica só de leitura, como retiradas.
  onEdit?: (id: string) => void
}

// Drill-down genérico dos cards de Aportes/Retiradas em Movimentações
// Societárias — mostra o lançamento completo, com link direto pro
// comprovante quando existir (mesmo padrão de leitura de arquivos usado no
// resto do sistema, module+entityId).
export default function LancamentoSocioListModal({ titulo, rows, fileModule, onClose, onEdit }: Props) {
  const [filesPorLancamento, setFilesPorLancamento] = useState<Map<string, StoredFile[]>>(new Map())

  useEffect(() => {
    let cancelado = false
    getFiles({ module: fileModule }).then(files => {
      if (cancelado) return
      const map = new Map<string, StoredFile[]>()
      for (const f of files) {
        const lista = map.get(f.entityId) ?? []
        lista.push(f)
        map.set(f.entityId, lista)
      }
      setFilesPorLancamento(map)
    })
    return () => { cancelado = true }
  }, [fileModule])

  const total = rows.reduce((s, r) => s + r.valor, 0)
  const mostrarOrigem = rows.some(r => r.origem)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-3xl bg-app-surface rounded-2xl border border-app-border shadow-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-app-border sticky top-0 bg-app-surface z-10 gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-app-text truncate">{titulo}</h2>
            <p className="text-xs text-app-subtle mt-0.5">{rows.length} lançamento{rows.length === 1 ? '' : 's'}, discriminados abaixo</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <p className="text-[10px] text-app-subtle uppercase tracking-wide">Total somado</p>
              <p className="text-base font-bold text-app-text">{formatCurrency(total)}</p>
            </div>
            <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-app-subtle hover:bg-app-surface2 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {rows.length === 0 ? (
            <p className="text-sm text-app-subtle text-center py-6">Nenhum lançamento no período.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-app-border2/60">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-app-border bg-app-surface2">
                    {['Data', 'Sócio', 'Espaço', 'Valor', 'Descrição', ...(mostrarOrigem ? ['Origem'] : []), 'Comprovante', ...(onEdit ? [''] : [])].map((h, i) => (
                      <th key={h || `acao-${i}`} className={`px-3 py-2.5 text-left font-medium text-app-subtle uppercase tracking-wide whitespace-nowrap ${h === 'Valor' ? 'text-right' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border/50">
                  {rows.map((r, i) => {
                    const arquivos = filesPorLancamento.get(r.id) ?? []
                    return (
                      <tr key={r.id} className={i % 2 === 1 ? 'bg-app-surface2/30' : undefined}>
                        <td className="px-3 py-2.5 text-app-text2 whitespace-nowrap">{r.data.split('-').reverse().join('/')}</td>
                        <td className="px-3 py-2.5 text-app-text font-medium whitespace-nowrap">{r.socio}</td>
                        <td className="px-3 py-2.5 text-app-text2 whitespace-nowrap">{r.espaco || '—'}</td>
                        <td className="px-3 py-2.5 font-semibold text-app-text whitespace-nowrap text-right">{formatCurrency(r.valor)}</td>
                        <td className="px-3 py-2.5 text-app-text2 max-w-[240px] truncate">{r.descricao}{r.observacoes ? ` — ${r.observacoes}` : ''}</td>
                        {mostrarOrigem && (
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                              r.origem === 'Retirada Manual' ? 'bg-fuchsia-500/10 text-fuchsia-600 border-fuchsia-500/20'
                                : r.origem === 'Conta Paga' ? 'bg-sky-500/10 text-sky-600 border-sky-500/20'
                                : 'bg-app-surface2 text-app-subtle border-app-border2'
                            }`}>
                              {r.origem ?? '—'}
                            </span>
                          </td>
                        )}
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {arquivos.length > 0 ? (
                            <button
                              onClick={() => viewFile(arquivos[0].id)}
                              className="flex items-center gap-1 text-[#128C7E] hover:underline"
                            >
                              <Paperclip className="h-3.5 w-3.5" />
                              Ver
                            </button>
                          ) : (
                            <span className="text-app-subtle">—</span>
                          )}
                        </td>
                        {onEdit && (
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <button
                              onClick={() => onEdit(r.id)}
                              className="flex items-center gap-1 text-app-muted hover:text-app-text transition-colors"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Editar
                            </button>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-app-border bg-app-surface2/60">
                    <td className="px-3 py-2.5 font-semibold text-app-text whitespace-nowrap" colSpan={3}>Total ({rows.length} lançamento{rows.length === 1 ? '' : 's'})</td>
                    <td className="px-3 py-2.5 font-bold text-app-text whitespace-nowrap text-right">{formatCurrency(total)}</td>
                    <td colSpan={2 + (mostrarOrigem ? 1 : 0) + (onEdit ? 1 : 0)} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
