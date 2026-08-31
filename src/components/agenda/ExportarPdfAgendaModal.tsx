'use client'

import { useState } from 'react'
import { X, FileText } from 'lucide-react'

const GREEN = '#25D366'
const DARK_GREEN = '#128C7E'

export interface CamposPdfAgenda {
  data: boolean
  nome: boolean
  status: boolean
  valor: boolean
  contato: boolean
}

export const CAMPOS_PDF_PADRAO: CamposPdfAgenda = { data: true, nome: true, status: true, valor: true, contato: true }

const OPCOES: { key: keyof CamposPdfAgenda; label: string; aviso?: string }[] = [
  { key: 'data', label: 'Data' },
  { key: 'nome', label: 'Nome do Evento' },
  { key: 'status', label: 'Status' },
  { key: 'valor', label: 'Valor Negociado', aviso: 'Desmarque para compartilhar o PDF sem divulgar valores.' },
  { key: 'contato', label: 'Contato Responsável' },
]

interface Props {
  camposIniciais: CamposPdfAgenda
  onClose: () => void
  onConfirm: (campos: CamposPdfAgenda) => void
}

export default function ExportarPdfAgendaModal({ camposIniciais, onClose, onConfirm }: Props) {
  const [campos, setCampos] = useState<CamposPdfAgenda>(camposIniciais)
  const nenhumSelecionado = !Object.values(campos).some(Boolean)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-sm bg-app-surface rounded-2xl border border-app-border shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-app-border">
          <h2 className="text-sm font-semibold text-app-text flex items-center gap-2">
            <FileText className="h-4 w-4 text-red-400" />
            Exportar PDF — Escolha as informações
          </h2>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-app-subtle hover:bg-app-surface2 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-3">
          <p className="text-xs text-app-subtle">
            Só as informações marcadas abaixo vão aparecer no PDF exportado — útil, por exemplo, pra compartilhar a agenda sem revelar valores.
          </p>
          {OPCOES.map(opt => (
            <label key={opt.key} className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={campos[opt.key]}
                onChange={e => setCampos(c => ({ ...c, [opt.key]: e.target.checked }))}
                className="mt-0.5 h-4 w-4 rounded border-app-border2 accent-[#25D366]"
              />
              <span>
                <span className="text-sm text-app-text block">{opt.label}</span>
                {opt.aviso && <span className="text-xs text-app-subtle">{opt.aviso}</span>}
              </span>
            </label>
          ))}
          {nenhumSelecionado && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2.5">
              <p className="text-xs text-red-400">Selecione ao menos uma informação para exportar.</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-app-border">
          <button onClick={onClose} className="rounded-lg border border-app-border2 px-4 py-2 text-sm text-app-muted hover:bg-app-surface2 transition-colors">
            Cancelar
          </button>
          <button
            onClick={() => onConfirm(campos)}
            disabled={nenhumSelecionado}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            style={{ backgroundColor: GREEN }}
            onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = DARK_GREEN }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = GREEN }}
          >
            <FileText className="h-3.5 w-3.5" />
            Gerar PDF
          </button>
        </div>
      </div>
    </div>
  )
}
