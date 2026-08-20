'use client'

interface FullTableProps {
  titulo: string
  headers: string[]
  rows: (string | number)[][]
  totalLabel: string
  totalValor: string
}

// Bloco sempre aberto — sem <details>/expandir — pra sair completo tanto na
// tela (quando usado dentro de um modal de "Visualizar") quanto no relatório
// impresso, sem nenhuma informação escondida atrás de outro clique.
export default function FullTable({ titulo, headers, rows, totalLabel, totalValor }: FullTableProps) {
  return (
    <div className="rounded-2xl border border-app-border bg-app-surface p-5 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-semibold text-app-text">{titulo} ({rows.length})</h3>
        <span className="text-sm font-semibold text-app-text">{totalLabel}: {totalValor}</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-app-subtle text-center py-4">Nenhum lançamento.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-app-border">
                {headers.map(h => (
                  <th key={h} className="px-2 py-2 text-left font-medium text-app-subtle uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border/50">
              {rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} className="px-2 py-2 text-app-text2 whitespace-nowrap">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
