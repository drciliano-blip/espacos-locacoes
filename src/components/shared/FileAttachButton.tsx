'use client'

import { useRef, useState } from 'react'
import { Paperclip, MessageSquareText } from 'lucide-react'
import { saveFile, getFiles, type StoredFile } from '@/lib/file-storage'
import { gerarPdfFile } from '@/lib/pdf-from-text'
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
  // Mostra uma opção extra de colar texto direto (ex: contrato copiado do
  // WhatsApp) em vez de precisar salvar num arquivo antes de anexar — vira um
  // PDF automaticamente. Não faz nenhuma leitura por IA, é só texto → arquivo.
  permiteColarTexto?: boolean
}

export default function FileAttachButton({
  module, entityId, entityName, espaco, categoria, onUploaded,
  variant = 'button', label = 'Anexar documento', permiteColarTexto = false,
}: Props) {
  const inputRef  = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [colarTextoAberto, setColarTextoAberto] = useState(false)
  const [textoColado, setTextoColado] = useState('')
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  function showToast(msg: string) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3500)
  }

  async function avisarSucesso(enviados: number) {
    if (enviados === 0) return
    const total = (await getFiles({ module, entityId })).length
    showToast(
      enviados === 1
        ? `Documento anexado com sucesso — ${total} documento${total !== 1 ? 's' : ''} anexado${total !== 1 ? 's' : ''} no total.`
        : `${enviados} documentos anexados com sucesso — ${total} no total.`
    )
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
      await avisarSucesso(enviados)
    } catch (err) {
      showToast(err instanceof Error ? `Falha ao anexar: ${err.message}` : 'Falha ao anexar o documento. Tente novamente.')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleAnexarTexto() {
    if (!textoColado.trim()) return
    setBusy(true)
    try {
      const file = await gerarPdfFile(textoColado.trim(), `${categoria || 'documento'}-colado-${Date.now()}.pdf`)
      const stored = await saveFile(file, { module, entityId, entityName, espaco, categoria })
      onUploaded?.(stored)
      await avisarSucesso(1)
      setTextoColado('')
      setColarTextoAberto(false)
    } catch (err) {
      showToast(err instanceof Error ? `Falha ao anexar: ${err.message}` : 'Falha ao anexar o texto colado. Tente novamente.')
    } finally {
      setBusy(false)
    }
  }

  const trigger = variant === 'icon' ? (
    <button
      onClick={() => inputRef.current?.click()}
      disabled={busy}
      title={busy ? 'Enviando…' : label}
      className="flex h-7 w-7 items-center justify-center rounded-md text-app-subtle hover:text-[#25D366] hover:bg-[#25D366]/10 transition-colors disabled:opacity-40"
    >
      <Paperclip className="h-3.5 w-3.5" />
    </button>
  ) : (
    <button
      onClick={() => inputRef.current?.click()}
      disabled={busy}
      className="flex items-center gap-1.5 rounded-lg border border-[#25D366]/30 bg-[#25D366]/10 px-3 py-1.5 text-xs font-medium text-[#128C7E] hover:bg-[#25D366]/20 transition-colors disabled:opacity-40"
    >
      <Paperclip className="h-3.5 w-3.5" />
      {busy ? 'Enviando…' : label}
    </button>
  )

  return (
    <>
      <input ref={inputRef} type="file" multiple accept={ACCEPT} className="hidden" onChange={handleChange} />
      <span className="inline-flex items-center gap-1.5">
        {trigger}
        {permiteColarTexto && (
          <button
            onClick={() => setColarTextoAberto(v => !v)}
            disabled={busy}
            title="Colar texto (ex: WhatsApp)"
            className="flex h-7 w-7 items-center justify-center rounded-md text-app-subtle hover:text-[#25D366] hover:bg-[#25D366]/10 transition-colors disabled:opacity-40"
          >
            <MessageSquareText className="h-3.5 w-3.5" />
          </button>
        )}
      </span>
      {permiteColarTexto && colarTextoAberto && (
        <div className="w-full space-y-2 pt-2">
          <textarea
            value={textoColado}
            onChange={e => setTextoColado(e.target.value)}
            rows={5}
            placeholder="Cole aqui o texto recebido (ex: contrato copiado do WhatsApp)…"
            className="w-full rounded-lg border border-app-border2 bg-app-surface2 px-2.5 py-1.5 text-sm text-app-text focus:outline-none resize-none"
          />
          <button
            onClick={handleAnexarTexto}
            disabled={busy || !textoColado.trim()}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            style={{ backgroundColor: '#25D366' }}
          >
            <MessageSquareText className="h-3.5 w-3.5" />
            {busy ? 'Anexando…' : 'Anexar texto colado'}
          </button>
        </div>
      )}
      <Toast message={toastMsg} />
    </>
  )
}
