'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { FileText, Paperclip, Eye, Trash2 } from 'lucide-react'
import { getFiles, saveFile, viewFile, deleteFile, type StoredFile } from '@/lib/file-storage'
import Toast from '@/components/shared/Toast'

interface Props {
  espacoId: string
  espacoNome: string
}

// Locação tem duas versões: sem staff (a padrão, categoria histórica
// 'minuta_locacao') e com staff do espaço. Ao gerar o contrato escolhe-se qual.
const TIPOS: { categoria: 'minuta_locacao' | 'minuta_locacao_staff' | 'minuta_parceria'; label: string }[] = [
  { categoria: 'minuta_locacao', label: 'Minuta de Locação — sem staff' },
  { categoria: 'minuta_locacao_staff', label: 'Minuta de Locação — com staff' },
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

  // Admin e operação podem apagar (RLS: qualquer perfil menos sócio). Confere
  // no banco depois, porque o delete bloqueado pelo RLS não devolve erro.
  async function handleRemover(arquivo: StoredFile, label: string) {
    if (!window.confirm(`Apagar a ${label} "${arquivo.name}"? Sem minuta anexada, os contratos de ${espacoNome} passam a usar o modelo genérico.`)) return
    try {
      await deleteFile(arquivo.id)
      const restantes = await getFiles({ module: 'espacos', entityId: espacoId })
      setArquivos(restantes)
      showToast(restantes.some(f => f.id === arquivo.id)
        ? 'Não foi possível apagar a minuta — seu perfil não tem permissão.'
        : 'Minuta apagada.')
    } catch (err) {
      showToast(err instanceof Error ? `Falha ao apagar: ${err.message}` : 'Falha ao apagar a minuta. Tente novamente.')
    }
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
        {TIPOS.map(({ categoria, label }) => (
          <MinutaRow
            key={categoria}
            categoria={categoria}
            label={label}
            atual={loading ? undefined : atualPara(categoria)}
            loading={loading}
            enviando={enviando === categoria}
            onUpload={file => handleUpload(categoria, file)}
            onRemover={arquivo => handleRemover(arquivo, label)}
          />
        ))}
      </div>
      <Toast message={toastMsg} />
    </div>
  )
}

interface MinutaRowProps {
  categoria: string
  label: string
  atual: StoredFile | undefined
  loading: boolean
  enviando: boolean
  onUpload: (file: File | null) => void
  onRemover: (arquivo: StoredFile) => void
}

// Botão + ref.click() num input escondido — mesmo padrão do FileAttachButton,
// que é comprovadamente confiável. O padrão anterior (label envolvendo o
// input) travava o diálogo de escolher arquivo em alguns Windows.
function MinutaRow({ categoria, label, atual, loading, enviando, onUpload, onRemover }: MinutaRowProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-app-border2/50 bg-app-surface2/40 px-3 py-2.5">
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
            <button onClick={() => onRemover(atual)} title="Apagar minuta" className="flex h-7 w-7 items-center justify-center rounded-md text-app-subtle hover:bg-red-500/10 hover:text-red-500 transition-colors">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          disabled={enviando}
          onChange={e => { onUpload(e.target.files?.[0] ?? null); if (inputRef.current) inputRef.current.value = '' }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={enviando}
          className="flex items-center gap-1.5 rounded-lg border border-app-border2 px-2.5 py-1.5 text-xs text-app-muted hover:bg-app-surface2 transition-colors disabled:opacity-60"
        >
          <Paperclip className="h-3.5 w-3.5" />
          {enviando ? 'Enviando…' : atual ? 'Substituir' : 'Anexar'}
        </button>
      </div>
    </div>
  )
}
