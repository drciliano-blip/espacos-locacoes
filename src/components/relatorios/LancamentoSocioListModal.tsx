'use client'

import { useEffect, useState } from 'react'
import { X, Paperclip } from 'lucide-react'
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
}

interface Props {
  titulo: string
  rows: LancamentoSocioRow[]
  fileModule: StoredFile['module']
  onClose: () => void
}

// Drill-down genérico dos cards de Aportes/Retiradas em Movimentações
// Societárias — mostra o lançamento completo, com link direto pro
// comprovante quando existir (mesmo padrão de leitura de arquivos usado no
// resto do sistema, module+entityId).
export default function LancamentoSocioListModal({ titulo, rows, fileModule, onClose }: Props) {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-3xl bg-app-surface rounded-2xl border border-app-border shadow-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-app-border sticky top-0 bg-app-surface z-10">
          <div>
            <h2 className="text-sm font-semibold text-app-text">{titulo}</h2>
            <p className="text-xs text-app-subtle mt-0.5">{rows.length} lançamento(s) — total {formatCurrency(total)}</p>
          </div>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-app-subtle hover:bg-app-surface2 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6">
          {rows.length === 0 ? (
            <p className="text-sm text-app-subtle text-center py-6">Nenhum lançamento no período.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-app-border">
                    {['Data', 'Sócio', 'Espaço', 'Valor', 'Descrição', 'Comprovante'].map(h => (
                      <th key={h} className="px-2 py-2 text-left font-medium text-app-subtle uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border/50">
                  {rows.map(r => {
                    const arquivos = filesPorLancamento.get(r.id) ?? []
                    return (
                      <tr key={r.id}>
                        <td className="px-2 py-2 text-app-text2 whitespace-nowrap">{r.data.split('-').reverse().join('/')}</td>
                        <td className="px-2 py-2 text-app-text font-medium whitespace-nowrap">{r.socio}</td>
                        <td className="px-2 py-2 text-app-text2 whitespace-nowrap">{r.espaco || '—'}</td>
                        <td className="px-2 py-2 font-semibold text-app-text whitespace-nowrap">{formatCurrency(r.valor)}</td>
                        <td className="px-2 py-2 text-app-text2 max-w-[240px] truncate">{r.descricao}{r.observacoes ? ` — ${r.observacoes}` : ''}</td>
                        <td className="px-2 py-2 whitespace-nowrap">
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
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
