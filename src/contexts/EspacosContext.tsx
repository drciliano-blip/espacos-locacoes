'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { ESPACOS_CONFIG } from '@/lib/espacos-config'
import type { EspacoConfig } from '@/lib/espacos-config'
import { getEspacosCustom, saveEspacoCustom, slugify } from '@/lib/espacos-store'
import type { EspacoCustomData } from '@/types'

const PALETTE: Pick<EspacoConfig, 'cor' | 'colorClass' | 'bgClass' | 'borderClass' | 'dotClass' | 'gradientFrom'>[] = [
  { cor: 'violet', colorClass: 'text-violet-400', bgClass: 'bg-violet-500/10', borderClass: 'border-violet-500/20', dotClass: 'bg-violet-500', gradientFrom: 'from-violet-500/20' },
  { cor: 'indigo', colorClass: 'text-indigo-400', bgClass: 'bg-indigo-500/10', borderClass: 'border-indigo-500/20', dotClass: 'bg-indigo-500', gradientFrom: 'from-indigo-500/20' },
  { cor: 'sky', colorClass: 'text-sky-400', bgClass: 'bg-sky-500/10', borderClass: 'border-sky-500/20', dotClass: 'bg-sky-500', gradientFrom: 'from-sky-500/20' },
  { cor: 'emerald', colorClass: 'text-emerald-400', bgClass: 'bg-emerald-500/10', borderClass: 'border-emerald-500/20', dotClass: 'bg-emerald-500', gradientFrom: 'from-emerald-500/20' },
  { cor: 'orange', colorClass: 'text-orange-400', bgClass: 'bg-orange-500/10', borderClass: 'border-orange-500/20', dotClass: 'bg-orange-500', gradientFrom: 'from-orange-500/20' },
]

function customToConfig(c: EspacoCustomData, index: number): EspacoConfig {
  const palette = PALETTE[index % PALETTE.length]
  return {
    slug: c.slug,
    nome: c.nome,
    descricao: c.descricao,
    capacidade: c.capacidade,
    categorias: [],
    ...palette,
  }
}

interface NovoEspacoDraft {
  id: string
  nome: string
  endereco: string
  capacidade: number
  descricao: string
  status: 'ativo' | 'inativo'
  fotoFileId?: string
}

interface EspacosContextValue {
  espacosConfig: EspacoConfig[]
  espacosNomes: string[]
  customEspacos: EspacoCustomData[]
  addEspaco: (draft: NovoEspacoDraft) => EspacoCustomData
}

const EspacosContext = createContext<EspacosContextValue | null>(null)

export function EspacosProvider({ children }: { children: ReactNode }) {
  const [customEspacos, setCustomEspacos] = useState<EspacoCustomData[]>([])

  useEffect(() => {
    setCustomEspacos(getEspacosCustom())
  }, [])

  function addEspaco(draft: NovoEspacoDraft): EspacoCustomData {
    const novo: EspacoCustomData = {
      id: draft.id,
      slug: slugify(draft.nome) || `espaco-${draft.id}`,
      nome: draft.nome,
      endereco: draft.endereco,
      capacidade: draft.capacidade,
      descricao: draft.descricao,
      status: draft.status,
      fotoFileId: draft.fotoFileId,
      criadoEm: new Date().toISOString(),
    }
    saveEspacoCustom(novo)
    setCustomEspacos(prev => [novo, ...prev])
    return novo
  }

  const espacosConfig: EspacoConfig[] = [
    ...ESPACOS_CONFIG,
    ...customEspacos.filter(c => c.status === 'ativo').map((c, i) => customToConfig(c, i)),
  ]
  const espacosNomes = espacosConfig.map(e => e.nome)

  return (
    <EspacosContext.Provider value={{ espacosConfig, espacosNomes, customEspacos, addEspaco }}>
      {children}
    </EspacosContext.Provider>
  )
}

export function useEspacos(): EspacosContextValue {
  const ctx = useContext(EspacosContext)
  if (!ctx) throw new Error('useEspacos must be used inside EspacosProvider')
  return ctx
}
