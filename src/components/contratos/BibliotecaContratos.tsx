'use client'

import { useState } from 'react'
import { Library, ChevronDown, ChevronUp, Tag } from 'lucide-react'
import { MODELOS_CONTRATO } from '@/lib/contract-templates'

export default function BibliotecaContratos() {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#25D366]/15">
          <Library className="h-4 w-4 text-[#25D366]" />
        </div>
        <div>
          <p className="text-sm font-semibold text-app-text">{MODELOS_CONTRATO.length} modelos cadastrados</p>
          <p className="text-xs text-app-muted">Usados automaticamente pelo gerador de contratos</p>
        </div>
      </div>

      <div className="space-y-2">
        {MODELOS_CONTRATO.map(modelo => (
          <div key={modelo.id} className="rounded-lg border border-app-border2/50 bg-app-surface2/40 overflow-hidden">
            <button
              onClick={() => setExpandedId(id => id === modelo.id ? null : modelo.id)}
              className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-app-surface2/30 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-app-text">{modelo.nome}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="flex items-center gap-1 text-xs text-app-subtle">
                    <Tag className="h-3 w-3" />
                    {modelo.espaco}
                  </span>
                  <span className="text-xs text-app-subtle">· {modelo.tipo}</span>
                  <span className="text-xs text-app-subtle">· {modelo.variaveis.length} campos variáveis</span>
                </div>
              </div>
              {expandedId === modelo.id ? <ChevronUp className="h-3.5 w-3.5 text-app-subtle shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-app-subtle shrink-0" />}
            </button>

            {expandedId === modelo.id && (
              <div className="px-4 pb-4 pt-1 border-t border-app-border/50">
                <pre className="whitespace-pre-wrap text-xs text-app-text2 bg-app-surface rounded-lg border border-app-border2/50 p-3 max-h-96 overflow-y-auto font-sans">
                  {modelo.texto}
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
