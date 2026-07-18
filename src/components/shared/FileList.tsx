'use client'

import { useState, useEffect, useCallback } from 'react'
import { Download, Eye, Trash2, FileText, File, Image as Img, FileSpreadsheet } from 'lucide-react'
import { getFiles, deleteFile, downloadFile, viewFile, formatFileSize, type StoredFile } from '@/lib/file-storage'
import FileAttachButton from './FileAttachButton'

function iconFor(mime: string) {
  if (mime.includes('pdf')) return FileText
  if (mime.startsWith('image/')) return Img
  if (mime.includes('sheet') || mime.includes('excel') || mime.includes('spreadsheet')) return FileSpreadsheet
  return File
}

interface Props {
  module: StoredFile['module']
  entityId: string
  entityName: string
  espaco?: string
  showAttach?: boolean
  compact?: boolean
}

export default function FileList({ module, entityId, entityName, espaco, showAttach = true, compact = false }: Props) {
  const [files,   setFiles]   = useState<StoredFile[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setFiles(await getFiles({ module, entityId }))
    setLoading(false)
  }, [module, entityId])

  useEffect(() => { load() }, [load])

  async function remove(id: string) {
    await deleteFile(id)
    setFiles(prev => prev.filter(f => f.id !== id))
  }

  if (loading) return <p className="text-xs text-app-muted py-2 text-center">Carregando…</p>

  return (
    <div className="space-y-2">
      {showAttach && (
        <FileAttachButton
          module={module} entityId={entityId} entityName={entityName} espaco={espaco}
          onUploaded={() => load()}
        />
      )}

      {files.length === 0 ? (
        <p className={`text-xs text-app-subtle italic ${compact ? 'py-1' : 'py-3 text-center'}`}>
          Nenhum documento anexado.
        </p>
      ) : files.map(f => {
        const Icon = iconFor(f.mimeType)
        const date = new Date(f.uploadedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
        return (
          <div key={f.id} className="flex items-center gap-2.5 rounded-lg border border-app-border2/60 bg-[#25D366]/5 px-3 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#25D366]/15">
              <Icon className="h-4 w-4 text-[#25D366]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-app-text truncate">{f.name}</p>
              {!compact && <p className="text-xs text-app-subtle">{formatFileSize(f.size)} · {date}</p>}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => viewFile(f.id)} title="Visualizar"
                className="flex h-6 w-6 items-center justify-center rounded text-app-subtle hover:text-app-text hover:bg-app-surface2 transition-colors">
                <Eye className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => downloadFile(f.id)} title="Baixar"
                className="flex h-6 w-6 items-center justify-center rounded text-app-subtle hover:text-[#25D366] hover:bg-[#25D366]/10 transition-colors">
                <Download className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => remove(f.id)} title="Remover"
                className="flex h-6 w-6 items-center justify-center rounded text-app-subtle hover:text-red-500 hover:bg-red-500/10 transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
