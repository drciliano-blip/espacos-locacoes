'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useEspacos } from '@/contexts/EspacosContext'

const STORAGE_KEY = 'espacoAtivo'

export const MSG_ESPACO_ESPECIFICO_NECESSARIO = 'Para realizar este lançamento, selecione primeiro um espaço específico no Dashboard.'

interface EspacoAtivoContextValue {
  // Não-nulo = modo operação, travado a ESTE espaço — usado pra filtrar
  // listas e travar o campo Espaço em formulários de novo lançamento.
  espacoUnico: string | null
  // Só relevante quando espacoUnico é null (modo "Todos/Comparativo") — o
  // subconjunto de espaços escolhido no Dashboard pra comparar/somar. Vazio
  // significa literalmente todos (sem restrição).
  espacosConsolidado: string[]
  // Derivado: pronto pra passar direto como `selectedSpaces` em qualquer
  // cálculo/filtro existente (undefined = sem filtro, mostra tudo).
  espacosEmEscopo: string[] | undefined
  setEspacoUnico: (nome: string) => void
  setTodos: () => void
  setEspacosConsolidado: (nomes: string[]) => void
  // true quando não há um espaço específico selecionado — usado pra
  // bloquear ações de "+ Nova X" que exigem um espaço só.
  precisaEspacoEspecifico: () => boolean
}

const EspacoAtivoContext = createContext<EspacoAtivoContextValue | null>(null)

interface Persistido {
  espacoUnico: string | null
  espacosConsolidado: string[]
}

// Mesmo padrão do ThemeProvider — hidrata do localStorage só depois que a
// lista real de espaços carregou (pra validar o valor salvo contra ela), e
// só persiste mudanças depois de hidratado, pra nunca sobrescrever o valor
// salvo com o estado inicial antes da hidratação rodar.
export function EspacoAtivoProvider({ children }: { children: ReactNode }) {
  const { espacosNomes, loading } = useEspacos()
  const [espacoUnico, setEspacoUnicoState] = useState<string | null>(null)
  const [espacosConsolidado, setEspacosConsolidadoState] = useState<string[]>([])
  const [hidratado, setHidratado] = useState(false)

  useEffect(() => {
    if (loading) return
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const salvo: Persistido = JSON.parse(raw)
        if (salvo.espacoUnico && !espacosNomes.includes(salvo.espacoUnico)) {
          // espaço salvo foi renomeado/desativado desde a última visita —
          // volta pro modo "Todos" em vez de travar num nome que não existe mais
          setEspacoUnicoState(null)
          setEspacosConsolidadoState([])
        } else {
          setEspacoUnicoState(salvo.espacoUnico ?? null)
          setEspacosConsolidadoState((salvo.espacosConsolidado ?? []).filter(nome => espacosNomes.includes(nome)))
        }
      }
    } catch {
      // localStorage corrompido ou indisponível — segue com o padrão (Todos)
    }
    setHidratado(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  useEffect(() => {
    if (!hidratado) return
    const dados: Persistido = { espacoUnico, espacosConsolidado }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dados))
  }, [espacoUnico, espacosConsolidado, hidratado])

  function setEspacoUnico(nome: string) {
    setEspacoUnicoState(nome)
    setEspacosConsolidadoState([])
  }
  function setTodos() {
    setEspacoUnicoState(null)
    setEspacosConsolidadoState([])
  }
  function setEspacosConsolidado(nomes: string[]) {
    setEspacoUnicoState(null)
    setEspacosConsolidadoState(nomes)
  }

  const espacosEmEscopo = espacoUnico ? [espacoUnico] : (espacosConsolidado.length ? espacosConsolidado : undefined)

  return (
    <EspacoAtivoContext.Provider value={{
      espacoUnico, espacosConsolidado, espacosEmEscopo,
      setEspacoUnico, setTodos, setEspacosConsolidado,
      precisaEspacoEspecifico: () => espacoUnico === null,
    }}>
      {children}
    </EspacoAtivoContext.Provider>
  )
}

export function useEspacoAtivo(): EspacoAtivoContextValue {
  const ctx = useContext(EspacoAtivoContext)
  if (!ctx) throw new Error('useEspacoAtivo must be used inside EspacoAtivoProvider')
  return ctx
}
