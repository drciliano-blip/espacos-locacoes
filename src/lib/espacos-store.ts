// Armazenamento local (localStorage) dos espacos cadastrados manualmente pelo usuario

import type { EspacoCustomData } from '@/types'

const KEY = 'el-espacos-custom'

export function getEspacosCustom(): EspacoCustomData[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as EspacoCustomData[]) : []
  } catch {
    return []
  }
}

export function saveEspacoCustom(espaco: EspacoCustomData): void {
  if (typeof window === 'undefined') return
  const all = [espaco, ...getEspacosCustom()]
  window.localStorage.setItem(KEY, JSON.stringify(all))
}

export function slugify(nome: string): string {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}
