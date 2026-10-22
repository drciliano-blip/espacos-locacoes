'use client'

import { usePathname } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import { useEspacos } from '@/contexts/EspacosContext'
import { useEspacoAtivo } from '@/contexts/EspacoAtivoContext'

// Telas onde se lança coisa (evento, contrato, receita, conta, fechamento).
// Dashboard fica de fora: lá "Todos os espaços" é um modo de uso normal.
const TELAS_DE_LANCAMENTO = ['/agenda', '/eventos', '/pagamentos', '/contas-a-pagar', '/fechamento']

// Faixa de aviso logo abaixo do topo: avisa, antes de a pessoa tentar lançar,
// que precisa escolher um espaço — e já oferece os espaços para clicar.
export default function AvisoEspaco() {
  const pathname = usePathname()
  const { espacosConfig, loading } = useEspacos()
  const { espacoUnico, setEspacoUnico } = useEspacoAtivo()

  const telaDeLancamento = TELAS_DE_LANCAMENTO.some(t => pathname === t || pathname.startsWith(t + '/'))
  if (espacoUnico || !telaDeLancamento || loading || espacosConfig.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5 sm:px-6 print-hidden">
      <p className="flex items-center gap-2 text-sm text-app-text">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
        <span>
          <span className="font-semibold">Você está vendo todos os espaços.</span>{' '}
          Para lançar, escolha em qual espaço vai trabalhar:
        </span>
      </p>
      <div className="flex flex-wrap gap-1.5">
        {espacosConfig.map(e => (
          <button
            key={e.slug}
            onClick={() => setEspacoUnico(e.nome)}
            className="flex items-center gap-2 rounded-lg border border-app-border2 bg-app-surface px-3 py-1.5 text-xs font-semibold text-app-text hover:border-[#25D366]/50 hover:bg-[#25D366]/10 transition-colors"
          >
            <span className={`h-2.5 w-2.5 rounded-full ${e.dotClass}`} />
            {e.nome}
          </button>
        ))}
      </div>
    </div>
  )
}
