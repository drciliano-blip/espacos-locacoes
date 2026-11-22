'use client'

// Botão do Assistente de IA em todas as telas do sistema. Abre o chat de
// Consultas por cima da tela atual (sem sair dela) e conta ao assistente em
// que tela a pessoa está. Só aparece para quem tem acesso ao assistente.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sparkles, X, Maximize2 } from 'lucide-react'
import { useCurrentUser } from '@/contexts/UserContext'
import { canAccess } from '@/lib/auth'
import { nomeDoUsuarioAtual } from '@/lib/buffet'
import ConsultaChat from './ConsultaChat'
import { EVENTO_PEDIR } from '@/lib/assistente/pedir'

const TELAS: [string, string][] = [
  ['/dashboard', 'Dashboard'], ['/agenda', 'Agenda'], ['/eventos', 'Eventos e Contratos'],
  ['/fechamento/conciliacao', 'Financeiro → Conciliação Bancária'], ['/fechamento', 'Financeiro'],
  ['/contas-a-pagar', 'Contas a Pagar / Pagas'], ['/espacos', 'Espaços'], ['/pagamentos', 'Pagamentos'],
  ['/calculadora-staff', 'Calculadora de Staff'], ['/credenciamento', 'Credenciamento'], ['/buffet', 'Buffet EL'],
  ['/usuarios', 'Usuários'],
]

export default function AssistenteFlutuante() {
  const { role } = useCurrentUser()
  const pathname = usePathname() ?? ''
  const [aberto, setAberto] = useState(false)
  const [autor, setAutor] = useState<string | undefined>()
  const [pedido, setPedido] = useState<string | undefined>()

  // Recomendação do resumo ("Pedir ao assistente"): abre o chat e manda a frase.
  useEffect(() => {
    const ouvir = (e: Event) => { const t = (e as CustomEvent<string>).detail; if (t) { setAberto(true); setPedido(t) } }
    window.addEventListener(EVENTO_PEDIR, ouvir)
    return () => window.removeEventListener(EVENTO_PEDIR, ouvir)
  }, [])

  useEffect(() => {
    if (!aberto || autor) return
    let vivo = true
    nomeDoUsuarioAtual().then(n => { if (vivo) setAutor(n) }).catch(() => {})
    return () => { vivo = false }
  }, [aberto, autor])

  if (!canAccess(role, 'assistente') || pathname.startsWith('/assistente')) return null
  const tela = TELAS.find(([p]) => pathname.startsWith(p))?.[1] ?? pathname

  return (
    <div className="print:hidden">
      {aberto && (
        <div className="fixed inset-0 z-40 flex flex-col bg-app-surface md:inset-auto md:bottom-20 md:right-5 md:h-[72vh] md:w-[440px] md:overflow-hidden md:rounded-2xl md:border md:border-app-border md:shadow-2xl">
          <div className="flex items-center justify-between border-b border-app-border bg-[#072A43] px-4 py-3 text-white">
            <p className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-[#D9B867]" /> Assistente de IA</p>
            <div className="flex items-center gap-3">
              <Link href="/assistente" onClick={() => setAberto(false)} className="inline-flex items-center gap-1 text-xs text-white/80 hover:text-white"><Maximize2 className="h-3.5 w-3.5" /> Tela completa</Link>
              <button type="button" aria-label="Fechar assistente" onClick={() => setAberto(false)} className="text-white/80 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
          </div>
          <div className="min-h-0 flex-1">
            <ConsultaChat role={role} autor={autor} tela={tela} compacto pedido={pedido} onPedidoUsado={() => setPedido(undefined)} />
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setAberto(a => !a)}
        aria-label={aberto ? 'Fechar assistente' : 'Abrir assistente de IA'}
        className={`fixed bottom-5 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[#072A43] text-white shadow-lg ring-2 ring-[#D9B867]/60 transition hover:scale-105 ${aberto ? 'hidden md:flex' : ''}`}
      >
        {aberto ? <X className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
      </button>
    </div>
  )
}
