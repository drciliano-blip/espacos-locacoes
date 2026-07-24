'use client'

import { useRef, useState } from 'react'
import { Paperclip } from 'lucide-react'
import { saveFile, getFiles, type StoredFile } from '@/lib/file-storage'
import Toast from '@/components/shared/Toast'

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.xlsx,.xls,.doc,.docx,.txt'
const MAX_MB  = 20

interface Props {
  module: StoredFile['module']
  entityId: string
  entityName: string
  espaco?: string
  categoria?: string
  onUploaded?: (file: StoredFile) => void
  variant?: 'button' | 'icon'
  label?: string
}

export default function FileAttachButton({
  module, entityId, entityName, espaco, categoria, onUploaded,
  variant = 'button', label = 'Anexar documento',
}: Props) {
  const inputRef  = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  function showToast(msg: string) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3500)
  }

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setBusy(true)
    let enviados = 0
    try {
      for (const f of files) {
        if (f.size > MAX_MB * 1024 * 1024) {
          showToast(`"${f.name}" excede ${MAX_MB} MB — não foi enviado.`)
          continue
        }
        const stored = await saveFile(f, { module, entityId, entityName, espaco, categoria })
        onUploaded?.(stored)
        enviados++
      }
      if (enviados > 0) {
        const total = (await getFiles({ module, entityId })).length
        showToast(
          enviados === 1
            ? `Documento anexado com sucesso — ${total} documento${total !== 1 ? 's' : ''} anexado${total !== 1 ? 's' : ''} no total.`
            : `${enviados} documentos anexados com sucesso — ${total} no total.`
        )
      }
    } catch (err) {
      showToast(err instanceof Error ? `Falha ao anexar: ${err.message}` : 'Falha ao anexar o documento. Tente novamente.')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  if (variant === 'icon') {
    return (
      <>
        <input ref={inputRef} type="file" multiple accept={ACCEPT} className="hidden" onChange={handleChange} />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          title={busy ? 'Enviando…' : label}
          className="flex h-7 w-7 items-center justify-center rounded-md text-app-subtle hover:text-[#25D366] hover:bg-[#25D366]/10 transition-colors disabled:opacity-40"
        >
          <Paperclip className="h-3.5 w-3.5" />
        </button>
        <Toast message={toastMsg} />
      </>
    )
  }

  return (
    <>
      <input ref={inputRef} type="file" multiple accept={ACCEPT} className="hidden" onChange={handleChange} />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="flex items-center gap-1.5 rounded-lg border border-[#25D366]/30 bg-[#25D366]/10 px-3 py-1.5 text-xs font-medium text-[#128C7E] hover:bg-[#25D366]/20 transition-colors disabled:opacity-40"
      >
        <Paperclip className="h-3.5 w-3.5" />
        {busy ? 'Enviando…' : label}
      </button>
      <Toast message={toastMsg} />
    </>
  )
}
