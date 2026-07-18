// Armazenamento local (localStorage) das fichas de cadastro de cliente recebidas via /ficha-cliente

import type { FichaCliente } from '@/types'

const KEY = 'el-fichas'

export function getFichas(): FichaCliente[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as FichaCliente[]) : []
  } catch {
    return []
  }
}

export function saveFicha(ficha: FichaCliente): void {
  if (typeof window === 'undefined') return
  const all = [ficha, ...getFichas()]
  window.localStorage.setItem(KEY, JSON.stringify(all))
}
