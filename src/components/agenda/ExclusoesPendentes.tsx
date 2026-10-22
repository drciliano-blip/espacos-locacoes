'use client'

import { useEffect, useState } from 'react'
import { Trash2, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import type { Evento } from '@/types'

// Só para admin: eventos que alguém tirou da Agenda ("Excluir da agenda") e
// aguardam a decisão — abrir o evento mostra "Aprovar e excluir" / "Recusar".
export default function ExclusoesPendentes({ eventos, onAbrir }: { eventos: Evento[]; onAbrir: (e: Evento) => void }) {
  const pendentes = eventos.filter(e => e.exclusaoSolicitadaEm)
    .sort((a, b) => (a.exclusaoSolicitadaEm ?? '').localeCompare(b.exclusaoSolicitadaEm ?? ''))
  const [aberto, setAberto] = useState(true)
  const [nomes, setNomes] = useState<Record<string, string>>({})
  const ids = [...new Set(pendentes.map(e => e.exclusaoSolicitadaPor).filter((x): x is string => !!x))].sort().join(',')

  useEffect(() => {
    if (!ids) return
    let ativo = true
    createClient().from('profiles').select('id, nome').in('id', ids.split(',')).then(({ data }) => {
      if (ativo && data) setNomes(Object.fromEntries(data.map(p => [p.id as string, p.nome as string])))
    })
    return () => { ativo = false }
  }, [ids])

  if (pendentes.length === 0) return null

  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/5 mb-4 print:hidden">
      <button onClick={() => setAberto(a => !a)} className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left">
        <span className="flex items-center gap-2 text-sm font-semibold text-red-500">
          <Trash2 className="h-4 w-4" />
          {pendentes.length} {pendentes.length === 1 ? 'exclusão aguardando' : 'exclusões aguardando'} sua aprovação
        </span>
        <ChevronDown className={`h-4 w-4 text-app-muted transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </button>
      {aberto && (
        <div className="divide-y divide-red-500/10 border-t border-red-500/20">
          {pendentes.map(e => (
            <div key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5">
              <div className="min-w-0 flex-1 basis-56">
                <p className="text-sm font-medium text-app-text truncate">{e.cliente} · {formatDate(e.data)} · {e.espaco}</p>
                <p className="text-xs text-app-subtle">
                  Pedido por <span className="font-medium text-app-text">{(e.exclusaoSolicitadaPor && nomes[e.exclusaoSolicitadaPor]) || '—'}</span>
                  {' '}em {new Date(e.exclusaoSolicitadaEm!).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                  {e.exclusaoMotivo ? ` · Motivo: ${e.exclusaoMotivo}` : ''}
                </p>
              </div>
              <button onClick={() => onAbrir(e)}
                className="rounded-lg border border-app-border2 bg-app-surface px-3 py-1.5 text-xs font-medium text-app-text hover:bg-app-surface2 transition-colors">
                Abrir e decidir
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
