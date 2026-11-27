// Utilitários comuns às ferramentas do Assistente de IA (ferramentas.ts e
// ferramentas-extra.ts). Rodam no servidor, com a sessão de quem pergunta.

import type Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { NivelAcesso } from '@/types'
import type { AcaoProposta } from './ferramentas'

export type Tool = Anthropic.Beta.BetaTool
export type Entrada = Record<string, unknown>

export interface Ferramenta {
  definicao: Tool
  pode: (role: NivelAcesso) => boolean
  executar: (sb: SupabaseClient, e: Entrada, ctx: { role: NivelAcesso; acoes: AcaoProposta[] }) => Promise<unknown>
}

export const ISO = /^\d{4}-\d{2}-\d{2}$/
export const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
export const norm = (s?: string | null) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
export const hojeSP = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
export const dias = (a: string, b: string) => Math.abs((Date.parse(a) - Date.parse(b)) / 86400000)
export const br = (iso?: string | null) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '')
export const brl = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
export const arred = (n: number) => Math.round(n * 100) / 100
export const LIMITE = 200

export function somarDias(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

export function fimDoMes(mes: string): string {
  const fim = new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0)
  return `${mes}-${String(fim.getDate()).padStart(2, '0')}`
}

// Junta várias consultas simples (sem filtro "or"), sem repetir linhas.
export async function juntar<T extends { id: string }>(consultas: PromiseLike<{ data: T[] | null; error: unknown }>[]): Promise<T[]> {
  const rs = await Promise.all(consultas)
  const vistos = new Map<string, T>()
  for (const r of rs) {
    if (r.error) throw r.error
    for (const x of r.data ?? []) vistos.set(x.id, x)
  }
  return [...vistos.values()]
}

export function periodo(e: Entrada, padraoDias = 31): { de: string; ate: string } {
  const de = ISO.test(texto(e.de)) ? texto(e.de) : hojeSP()
  let ate = ISO.test(texto(e.ate)) ? texto(e.ate) : ''
  if (!ate) ate = somarDias(de, padraoDias)
  return { de, ate }
}

export async function espacos(sb: SupabaseClient) {
  const { data, error } = await sb.from('espacos').select('id, slug, nome')
  if (error) throw error
  return (data ?? []) as { id: string; slug: string; nome: string }[]
}

// "fabrique", "Fabrique", "espaço solon" → id
export async function filtroEspaco(sb: SupabaseClient, v: unknown) {
  const todos = await espacos(sb)
  const nomes = new Map(todos.map(e => [e.id, e.nome]))
  const q = norm(texto(v))
  if (!q) return { id: undefined as string | undefined, nomes, todos }
  const achado = todos.find(e => norm(e.slug) === q || norm(e.nome) === q) ?? todos.find(e => norm(e.nome).includes(q) || q.includes(norm(e.nome)))
  if (!achado) throw new Error(`Espaço "${texto(v)}" não encontrado. Espaços: ${todos.map(e => e.nome).join(', ')}.`)
  return { id: achado.id, nomes, todos }
}

// Busca paginada (o Supabase devolve no máximo 1.000 linhas por vez).
export async function todasAsLinhas<T>(montar: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>, maximo = 10000): Promise<T[]> {
  const out: T[] = []
  for (let de = 0; de < maximo; de += 1000) {
    const { data, error } = await montar(de, de + 999)
    if (error) throw error
    out.push(...(data ?? []))
    if ((data?.length ?? 0) < 1000) break
  }
  return out
}

// Semelhança simples entre dois textos (palavras em comum, sem acento), de 0 a 1.
export function parecido(a?: string | null, b?: string | null): number {
  const pa = new Set(norm(a).split(/[^a-z0-9]+/).filter(w => w.length >= 3))
  const pb = new Set(norm(b).split(/[^a-z0-9]+/).filter(w => w.length >= 3))
  if (!pa.size || !pb.size) return 0
  let comum = 0
  for (const w of pa) if (pb.has(w)) comum++
  return comum / Math.min(pa.size, pb.size)
}
