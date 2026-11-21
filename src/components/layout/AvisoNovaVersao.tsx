'use client'

// Quando sai uma versão nova do sistema, quem está com a tela aberta (ou com
// o app do celular em segundo plano) continua vendo a antiga até recarregar.
// Este aviso confere a versão publicada a cada 2 minutos e ao voltar para a
// aba, e oferece o botão "Atualizar".

import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'

const VERSAO_CARREGADA = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? null

export default function AvisoNovaVersao() {
  const [nova, setNova] = useState(false)

  useEffect(() => {
    if (!VERSAO_CARREGADA) return // fora da Vercel (testes locais): não confere
    let vivo = true
    const conferir = () => {
      if (document.hidden) return
      fetch('/api/versao', { cache: 'no-store' })
        .then(r => (r.ok ? r.json() : null))
        .then(j => { if (vivo && j?.versao && j.versao !== VERSAO_CARREGADA) setNova(true) })
        .catch(() => {})
    }
    conferir()
    const t = setInterval(conferir, 120000)
    document.addEventListener('visibilitychange', conferir)
    return () => { vivo = false; clearInterval(t); document.removeEventListener('visibilitychange', conferir) }
  }, [])

  if (!nova) return null
  return (
    <div className="print:hidden flex items-center justify-between gap-3 bg-[#072A43] px-4 py-2 text-sm text-white">
      <span>Há uma versão nova do sistema.</span>
      <button type="button" onClick={() => window.location.reload()} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1 text-xs font-semibold text-[#072A43]">
        <RefreshCw className="h-3.5 w-3.5" /> Atualizar
      </button>
    </div>
  )
}
