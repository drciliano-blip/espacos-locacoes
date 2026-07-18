'use client'

import { useState, useEffect } from 'react'
import { X, Search, Download, Eye, Trash2, FileText, File, Image as Img, FolderOpen } from 'lucide-react'
import { getFiles, deleteFile, downloadFile, viewFile, formatFileSize, type StoredFile } from '@/lib/file-storage'
import { ESPACOS } from '@/lib/mock-data'

const MODULE_LABELS: Record<StoredFile['module'], string> = {
  contas:       'Contas a Pagar',
  contratos:    'Contratos',
  agenda:       'Agenda',
  pagamentos:   'Pagamentos',
  espacos:      'Espaços',
  funcionarios: 'Funcionários',
  fichas:       'Fichas de Cliente',
}

function iconFor(mime: string) {
  if (mime.includes('pdf')) return FileText
  if (mime.startsWith('image/')) return Img
  return File
}

interface Props {
  onClose: () => void
  defaultModule?: StoredFile['module']
  defaultEspaco?: string
}

export default function FileSearchModal({ onClose, defaultModule, defaultEspaco }: Props) {
  const [all,    setAll]    = useState<StoredFile[]>([])
  const [busy,   setBusy]   = useState(true)
  const [query,  setQuery]  = useState('')
  const [mod,    setMod]    = useState<StoredFile['module'] | 'todos'>(defaultModule ?? 'todos')
  const [espaco, setEspaco] = useState(defaultEspaco ?? '')

  useEffect(() => {
    getFiles().then(f => { setAll(f); setBusy(false) })
  }, [])

  const filtered = all.filter(f => {
    const q   = query.toLowerCase()
    const hit = !q || f.name.toLowerCase().includes(q) || f.entityName.toLowerCase().includes(q)
    return hit && (mod    === 'todos' || f.module === mod) &&
                  (espaco === ''      || f.espaco === espaco)
  })

  async function remove(id: string) {
    await deleteFile(id)
    setAll(prev => prev.filter(f => f.id !== id))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-app-surface rounded-2xl border border-app-border shadow-2xl flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-app-border">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-[#25D366]" />
            <h2 className="text-sm font-semibold text-app-text">Ver documentos</h2>
          </div>
          <button onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-app-subtle hover:bg-app-surface2 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* filtros */}
        <div className="flex flex-wrap gap-2 px-5 py-3 border-b border-app-border bg-app-surface2/30">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-app-subtle" />
            <input
              value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Nome do arquivo ou cliente…"
              className="w-full rounded-lg border border-app-border2 bg-app-surface pl-8 pr-3 py-1.5 text-sm text-app-text placeholder-app-subtle focus:outline-none"
              onFocus={e => { e.currentTarget.style.borderColor = '#25D366' }}
              onBlur={e => { e.currentTarget.style.borderColor = '' }}
            />
          </div>
          <select value={mod} onChange={e => setMod(e.target.value as StoredFile['module'] | 'todos')}
            className="cursor-pointer rounded-lg border border-app-border2 bg-app-surface px-2.5 py-1.5 text-sm text-app-text2 focus:outline-none">
            <option value="todos">Todos os módulos</option>
            {(Object.entries(MODULE_LABELS) as [StoredFile['module'], string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select value={espaco} onChange={e => setEspaco(e.target.value)}
            className="cursor-pointer rounded-lg border border-app-border2 bg-app-surface px-2.5 py-1.5 text-sm text-app-text2 focus:outline-none">
            <option value="">Todos os espaços</option>
            {ESPACOS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* lista */}
        <div className="flex-1 overflow-y-auto p-5">
          {busy ? (
            <p className="text-sm text-app-muted text-center py-10">Carregando…</p>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-14 text-center">
              <FolderOpen className="h-10 w-10 text-app-border2 mb-3" />
              <p className="text-sm text-app-muted">
                {all.length === 0
                  ? 'Nenhum documento anexado ainda. Use os botões "Anexar documento" nos módulos.'
                  : 'Nenhum resultado para os filtros selecionados.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(f => {
                const Icon = iconFor(f.mimeType)
                const date = new Date(f.uploadedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
                return (
                  <div key={f.id} className="flex items-center gap-3 rounded-lg border border-app-border2/60 bg-app-surface2/50 px-3.5 py-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#25D366]/10">
                      <Icon className="h-4 w-4 text-[#25D366]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-app-text truncate">{f.name}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5">
                        <span className="text-xs text-app-subtle">{f.entityName}</span>
                        {f.espaco   && <><span className="text-app-border2">·</span><span className="text-xs text-app-subtle">{f.espaco}</span></>}
                        <span className="text-app-border2">·</span>
                        <span className="text-xs text-app-subtle">{MODULE_LABELS[f.module]}</span>
                        <span className="text-app-border2">·</span>
                        <span className="text-xs text-app-subtle">{formatFileSize(f.size)}</span>
                        <span className="text-app-border2">·</span>
                        <span className="text-xs text-app-subtle">{date}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => viewFile(f.id)} title="Visualizar"
                        className="flex h-7 w-7 items-center justify-center rounded text-app-subtle hover:text-app-text hover:bg-app-surface2 transition-colors">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => downloadFile(f.id)} title="Baixar"
                        className="flex h-7 w-7 items-center justify-center rounded text-app-subtle hover:text-[#25D366] hover:bg-[#25D366]/10 transition-colors">
                        <Download className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => remove(f.id)} title="Remover"
                        className="flex h-7 w-7 items-center justify-center rounded text-app-subtle hover:text-red-500 hover:bg-red-500/10 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-app-border text-xs text-app-subtle">
          {filtered.length} documento{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  )
}
