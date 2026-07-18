// Armazenamento local (localStorage) dos funcionários cadastrados em Contratos/Documentos

import type { Funcionario } from '@/types'

const KEY = 'el-funcionarios'

export function getFuncionarios(): Funcionario[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Funcionario[]) : []
  } catch {
    return []
  }
}

export function saveFuncionario(funcionario: Funcionario): void {
  if (typeof window === 'undefined') return
  const all = [funcionario, ...getFuncionarios()]
  window.localStorage.setItem(KEY, JSON.stringify(all))
}

export function removeFuncionario(id: string): void {
  if (typeof window === 'undefined') return
  const all = getFuncionarios().filter(f => f.id !== id)
  window.localStorage.setItem(KEY, JSON.stringify(all))
}
