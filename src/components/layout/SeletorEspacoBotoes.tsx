'use client'

import { Check } from 'lucide-react'
import { useEspacos } from '@/contexts/EspacosContext'
import { useEspacoAtivo } from '@/contexts/EspacoAtivoContext'

// Botões de espaço iguais aos do Dashboard (sem o Comparativo), pra telas de
// consulta como a Agenda. Mexe na mesma seleção global do seletor do topo.
export default function SeletorEspacoBotoes() {
  const { espacosConfig } = useEspacos()
  const { espacoUnico, setEspacoUnico, setTodos } = useEspacoAtivo()

  const classe = (ativo: boolean) => `flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all ${
    ativo
      ? 'border-[#25D366] bg-[#25D366]/15 text-app-text shadow-sm ring-1 ring-[#25D366]'
      : 'border-app-border bg-app-surface text-app-muted hover:border-app-border2 hover:text-app-text'
  }`

  return (
    <div className="space-y-2 print:hidden">
      <p className="text-sm font-semibold text-app-text">Em qual espaço você quer trabalhar?</p>
      <div className="flex flex-wrap items-stretch gap-2">
        <button onClick={setTodos} className={classe(!espacoUnico)}>
          Todos os espaços
        </button>
        {espacosConfig.map(({ nome, dotClass }) => {
          const ativo = espacoUnico === nome
          return (
            <button key={nome} onClick={() => setEspacoUnico(nome)} className={classe(ativo)}>
              <span className={`h-3 w-3 shrink-0 rounded-full ${dotClass}`} />
              {nome}
              {ativo && <Check className="h-4 w-4 text-[#128C7E]" />}
            </button>
          )
        })}
      </div>
      <p className="text-xs text-app-subtle">
        {espacoUnico
          ? `Tudo o que você lançar agora vai para ${espacoUnico}. Dá para trocar a qualquer momento no topo da tela.`
          : 'Você está vendo todos os espaços. Para lançar eventos, escolha um espaço — a escolha vale para o sistema inteiro.'}
      </p>
    </div>
  )
}
