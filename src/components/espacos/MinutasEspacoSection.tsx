'use client'

import { useCallback, useEffect, useState } from 'react'
import { FileText, Paperclip, Eye, Trash2 } from 'lucide-react'
import { getFiles, saveFile, viewFile, deleteFile, type StoredFile } from '@/lib/file-storage'
import Toast from '@/components/shared/Toast'

const GREEN = '#25D366'

interface Props {
  espacoId: string
  espacoNome: string
}

const TIPOS: { categoria: 'minuta_locacao' | 'minuta_parceria'; label: string }[] = [
  { categoria: 'minuta_locacao', label: 'Minuta de Locação' },
  { categoria: 'minuta_parceria', label: 'Minuta de Parceria' },
]

export default function MinutasEspacoSection({ espacoId, espacoNome }: Props) {
  const [arquivos, setArquivos] = useState<StoredFile[]>([])
  const [loading, setLoading] = useState(true)
  const [enviando, setEnviando] = useState<string | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  function showToast(msg: string) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    setArquivos(await getFiles({ module: 'espacos', entityId: espacoId }))
    setLoading(false)
  }, [espacoId])

  useEffect(() => { load() }, [load])

  function atualPara(categoria: string): StoredFile | undefined {
    return arquivos
      .filter(f => f.categoria === categoria)
      .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))[0]
  }

  async function handleUpload(categoria: string, file: File | null) {
    if (!file) return
    if (file.type !== 'application/pdf') {
      showToast('A minuta precisa ser um arquivo PDF (a IA lê o PDF direto para gerar o contrato).')
      return
    }
    setEnviando(categoria)
    try {
      await saveFile(file, { module: 'espacos', entityId: espacoId, entityName: espacoNome, categoria })
      await load()
      showToast('Minuta anexada com sucesso.')
    } catch (err) {
      showToast(err instanceof Error ? `Falha ao anexar: ${err.message}` : 'Falha ao anexar a minuta. Tente novamente.')
    } finally {
      setEnviando(null)
    }
  }

  async function handleRemover(id: string) {
    await deleteFile(id)
    setArquivos(prev => prev.filter(f => f.id !== id))
  }

  return (
    <div className="rounded-xl border border-app-border bg-app-surface p-4 space-y-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-app-text">
        <FileText className="h-4 w-4 text-app-subtle" />
        Minutas de contrato (usadas pela IA para gerar o contrato final)
      </p>
      <p className="text-xs text-app-muted">
        Anexe em PDF a minuta real de {espacoNome}. Quando gerar um contrato desse espaço, a IA lê este documento e preenche os dados mantendo o texto jurídico original — sem minuta anexada, usa um modelo genérico.
      </p>

      <div className="space-y-2">
        {TIPOS.map(({ categoria, label }) => {
          const atual = loading ? undefined : atualPara(categoria)
          return (
            <div key={categoria} className="flex items-center justify-between gap-3 rounded-lg border border-app-border2/50 bg-app-surface2/40 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-app-text">{label}</p>
                <p className="text-xs text-app-subtle truncate mt-0.5">
                  {loading ? 'Carregando…' : atual ? atual.name : 'Nenhum arquivo anexado ainda.'}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {atual && (
                  <>
                    <button onClick={() => viewFile(atual.id)} title="Ver" className="flex h-7 w-7 items-center justify-center rounded-md text-app-subtle hover:bg-app-surface2 hover:text-app-text transition-colors">
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleRemover(atual.id)} title="Remover" className="flex h-7 w-7 items-center justify-center rounded-md text-app-subtle hover:bg-red-500/10 hover:text-red-500 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
                <label className="flex items-center gap-1.5 rounded-lg border border-app-border2 px-2.5 py-1.5 text-xs text-app-muted hover:bg-app-surface2 transition-colors cursor-pointer">
                  <Paperclip className="h-3.5 w-3.5" />
                  {enviando === categoria ? 'Enviando…' : atual ? 'Substituir' : 'Anexar'}
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    disabled={enviando === categoria}
                    onChange={e => handleUpload(categoria, e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
            </div>
          )
        })}
      </div>
      <Toast message={toastMsg} />
    </div>
  )
}
