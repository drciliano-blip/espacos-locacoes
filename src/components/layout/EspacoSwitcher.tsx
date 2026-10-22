'use client'

import { useEffect, useRef, useState } from 'react'
import { Building2, Check, ChevronDown, LayoutGrid } from 'lucide-react'
import { useEspacos } from '@/contexts/EspacosContext'
import { useEspacoAtivo } from '@/contexts/EspacoAtivoContext'

// Seletor de espaço do topo — visível em todas as telas. Mostra com cor e nome
// em qual espaço a pessoa está trabalhando e permite trocar sem voltar ao
// Dashboard. Amarelo = "Todos os espaços" (só consulta, não dá pra lançar).
export default function EspacoSwitcher() {
  const { espacosConfig } = useEspacos()
  const { espacoUnico, espacosConsolidado, setEspacoUnico, setTodos } = useEspacoAtivo()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function fora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function esc(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc) }
  }, [open])

  const atual = espacoUnico ? espacosConfig.find(e => e.nome === espacoUnico) : undefined
  const rotulo = espacoUnico ?? (espacosConsolidado.length > 0 ? `${espacosConsolidado.length} espaços` : 'Todos os espaços')

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Trocar de espaço"
        className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-left transition-colors ${
          espacoUnico
            ? 'border-app-border2 bg-app-surface hover:bg-app-surface2'
            : 'border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/15'
        }`}
      >
        {atual
          ? <span className={`h-3 w-3 shrink-0 rounded-full ${atual.dotClass}`} />
          : <LayoutGrid className="h-4 w-4 shrink-0 text-amber-500" />}
        <span className="leading-tight">
          <span className="block text-[10px] font-medium uppercase tracking-wide text-app-subtle">
            {espacoUnico ? 'Espaço selecionado' : 'Visão geral'}
          </span>
          <span className="block text-sm font-semibold text-app-text max-w-[11rem] truncate">{rotulo}</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-app-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div role="listbox" className="absolute left-0 top-full z-50 mt-2 w-72 rounded-xl border border-app-border bg-app-surface p-2 shadow-2xl">
          <p className="px-2 pb-1.5 pt-1 text-[11px] font-medium uppercase tracking-wide text-app-subtle">Trabalhar em um espaço</p>
          {espacosConfig.map(e => {
            const ativo = espacoUnico === e.nome
            return (
              <button
                key={e.slug}
                role="option"
                aria-selected={ativo}
                onClick={() => { setEspacoUnico(e.nome); setOpen(false) }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                  ativo ? 'bg-[#25D366]/15 font-semibold text-app-text' : 'text-app-text2 hover:bg-app-surface2'
                }`}
              >
                <span className={`h-3 w-3 shrink-0 rounded-full ${e.dotClass}`} />
                <span className="flex-1 truncate">{e.nome}</span>
                {ativo && <Check className="h-4 w-4 text-[#128C7E]" />}
              </button>
            )
          })}

          <div className="my-1.5 border-t border-app-border" />
          <button
            role="option"
            aria-selected={!espacoUnico}
            onClick={() => { setTodos(); setOpen(false) }}
            className={`flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
              !espacoUnico ? 'bg-amber-500/10 font-semibold text-app-text' : 'text-app-text2 hover:bg-app-surface2'
            }`}
          >
            <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <span className="flex-1">
              Todos os espaços
              <span className="block text-xs font-normal text-app-subtle">Só para consultar e comparar — não dá para lançar</span>
            </span>
            {!espacoUnico && <Check className="mt-0.5 h-4 w-4 text-amber-500" />}
          </button>
        </div>
      )}
    </div>
  )
}
