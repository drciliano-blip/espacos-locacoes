'use client'

import { useEffect, useRef, useState } from 'react'
import { FileDown, ChevronDown, FileText, FileSpreadsheet } from 'lucide-react'

interface Props {
  onExcel: () => void
  onPdf?: () => void
  label?: string
}

export default function ExportarRelatorioButton({ onExcel, onPdf, label = 'Exportar Relatório' }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative print-hidden" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 rounded-lg border border-app-border2 bg-app-surface px-4 py-2 text-sm font-medium text-app-muted hover:bg-app-surface2 hover:text-app-text transition-colors"
      >
        <FileDown className="h-4 w-4" />
        {label}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-60 rounded-lg border border-app-border bg-app-surface shadow-xl overflow-hidden">
          <button
            onClick={() => { setOpen(false); (onPdf ?? (() => window.print()))() }}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-app-text hover:bg-app-surface2 transition-colors"
          >
            <FileText className="h-3.5 w-3.5 text-red-400" />
            Exportar em PDF
          </button>
          <button
            onClick={() => { setOpen(false); onExcel() }}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-app-text hover:bg-app-surface2 transition-colors border-t border-app-border/60"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" />
            Exportar em Excel (.XLSX)
          </button>
        </div>
      )}
    </div>
  )
}
