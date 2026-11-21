'use client'

// Anexar a ficha do cliente (foto, print ou PDF) no chat do assistente.
// Usa a mesma leitura por IA do "Extrair dados" do cadastro de evento
// (/api/extract-ficha) e devolve os dados lidos para o assistente.

import { useRef, useState } from 'react'
import { Paperclip, Loader2 } from 'lucide-react'

export interface FichaLida {
  arquivo: string
  dados: Record<string, unknown>
}

// Foto grande do celular passa do limite de envio: reduz para JPEG ~1600 px.
async function reduzirImagem(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.size < 1_500_000) return file
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = erro; i.src = url })
    const escala = Math.min(1, 1600 / Math.max(img.width, img.height))
    const c = document.createElement('canvas')
    c.width = Math.round(img.width * escala); c.height = Math.round(img.height * escala)
    c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height)
    return await new Promise<Blob>((ok, erro) => c.toBlob(b => (b ? ok(b) : erro(new Error('falha'))), 'image/jpeg', 0.85))
  } finally {
    URL.revokeObjectURL(url)
  }
}

export default function BotaoAnexo({ onLido, onErro, disabled }: {
  onLido: (f: FichaLida) => void
  onErro: (msg: string) => void
  disabled?: boolean
}) {
  const input = useRef<HTMLInputElement>(null)
  const [lendo, setLendo] = useState(false)

  async function ler(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') { onErro('Envie foto, print ou PDF da ficha. Para áudio, ouça e use o microfone para ditar os dados.'); return }
    setLendo(true)
    try {
      const corpo = await reduzirImagem(file)
      if (corpo.size > 4_000_000) throw new Error('Arquivo grande demais (máx. 4 MB). Envie um print ou foto menor.')
      const fd = new FormData()
      fd.append('file', corpo instanceof File ? corpo : new File([corpo], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }))
      const res = await fetch('/api/extract-ficha', { method: 'POST', body: fd })
      const j = await res.json().catch(() => ({ error: 'Resposta inválida do servidor.' }))
      if (!res.ok) throw new Error(j.error ?? 'Não consegui ler o documento.')
      onLido({ arquivo: file.name, dados: j })
    } catch (e) {
      onErro(e instanceof Error ? e.message : 'Não consegui ler o documento.')
    } finally {
      setLendo(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <>
      <input ref={input} type="file" accept="image/*,application/pdf" className="hidden" onChange={e => ler(e.target.files?.[0])} />
      <button
        type="button"
        disabled={disabled || lendo}
        onClick={() => input.current?.click()}
        aria-label="Anexar ficha do cliente (foto ou PDF)"
        title="Anexar ficha (foto ou PDF)"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-app-border2 bg-app-surface text-app-text disabled:opacity-40"
      >
        {lendo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
      </button>
    </>
  )
}

// Texto que vai para o assistente com os dados lidos (o chat mostra só o nome do arquivo).
export function textoDaFicha(f: FichaLida, pedido: string): string {
  const limpos = Object.fromEntries(Object.entries(f.dados).filter(([, v]) => v !== null && v !== '' && !(typeof v === 'object' && v && Object.values(v).every(x => x === null))))
  return `${pedido || 'O cliente enviou a ficha. Cadastre o evento com esses dados.'}\n\n<ficha_anexada arquivo="${f.arquivo}">\n${JSON.stringify(limpos)}\n</ficha_anexada>\n(Datas da ficha estão em DD/MM/AAAA.)`
}
