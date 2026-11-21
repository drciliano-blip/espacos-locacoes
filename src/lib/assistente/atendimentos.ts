// Atendimentos do Assistente de IA (migration 0052): um chat por cliente ou
// orçamento, com a conversa e o estado do orçamento para a equipe retomar.
// Acesso pelo banco: admin e operacional leem e editam; só admin exclui.

import { createClient } from '@/lib/supabase/client'
import type { DadosEvento, LinhaOrcamento } from './orcamento'

export type AutorMensagem = 'cliente' | 'assistente' | 'equipe' | 'sistema'

export interface Mensagem {
  id: string
  autor: AutorMensagem
  texto: string
  em: string // ISO
  por?: string // nome de quem colou/gerou/aprovou
  enviada?: boolean // resposta da IA marcada como enviada ao cliente
  canal?: 'whatsapp' // chegou ou saiu pelo WhatsApp (Blip)
  idExterno?: string // id da mensagem no WhatsApp (evita duplicar)
  // Chat com o assistente: 'equipe' = quem atende falando com a IA; 'assistente'
  // sem tipo = resposta da IA para a equipe. Cartões dentro do chat:
  tipo?: 'rascunho_cliente' | 'pre_evento' | 'pdfs' | 'confirmar_evento' | 'acao_sistema'
  acao?: Record<string, unknown> // dados do cartão (ex.: pré-evento proposto)
  feita?: boolean // cartão de ação já executado
}

export type StatusAtendimento = 'aberto' | 'enviado' | 'fechado' | 'perdido'
export const STATUS_ATENDIMENTO: Record<StatusAtendimento, { label: string; cls: string }> = {
  aberto: { label: 'Aberto', cls: 'bg-sky-500/10 text-sky-700' },
  enviado: { label: 'Orçamento enviado', cls: 'bg-amber-500/10 text-amber-700' },
  fechado: { label: 'Fechado', cls: 'bg-emerald-500/10 text-emerald-700' },
  perdido: { label: 'Perdido', cls: 'bg-red-500/10 text-red-600' },
}

// Tudo o que a tela precisa para remontar o orçamento.
export interface EstadoAtendimento {
  versao: number
  dados: DadosEvento
  pedidos: string[]
  falta: string[]
  slug: string
  montagem: boolean
  contratacao: 'locacao' | 'parceria'
  fastixOpcional: boolean
  staffComplementar: number
  valorManual: number | null
  buffetId: string
  buffetOpcao: string
  buffetValor: number | null
  extras: LinhaOrcamento[]
  opcionais: LinhaOrcamento[]
  condicoesServicos: string
  upsell: { servico: string; motivo: string }[]
  alertas: string[]
  preEventoId?: string // evento (em negociação) criado na Agenda a partir deste atendimento
  whatsapp?: string // número do cliente no WhatsApp (só dígitos, com 55)
  ia?: unknown[] // histórico da conversa com a IA no formato da API (só acrescenta)
  iaAte?: string // horário da última mensagem já mostrada à IA
}

export interface AtendimentoResumo {
  id: string
  numero: string
  titulo: string
  status: StatusAtendimento
  espacoSlug?: string
  dataEvento?: string
  totalLocacao?: number
  totalServicos?: number
  updatedAt: string
  updatedByNome?: string
  createdByNome?: string
}

export interface Atendimento extends AtendimentoResumo {
  estado: Partial<EstadoAtendimento>
  mensagens: Mensagem[]
}

const RESUMO = 'id, numero, titulo, status, espaco_slug, data_evento, total_locacao, total_servicos, updated_at, updated_by_nome, created_by_nome'

type Row = Record<string, unknown>
const num = (v: unknown) => (v === null || v === undefined ? undefined : Number(v))
const str = (v: unknown) => (v === null || v === undefined || v === '' ? undefined : String(v))

function resumoFromRow(r: Row): AtendimentoResumo {
  return {
    id: String(r.id), numero: String(r.numero), titulo: String(r.titulo), status: r.status as StatusAtendimento,
    espacoSlug: str(r.espaco_slug), dataEvento: str(r.data_evento),
    totalLocacao: num(r.total_locacao), totalServicos: num(r.total_servicos),
    updatedAt: String(r.updated_at), updatedByNome: str(r.updated_by_nome), createdByNome: str(r.created_by_nome),
  }
}

// A tabela é criada pela migration 0052; sem ela a aba avisa em vez de quebrar.
export function tabelaAusente(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null
  return !!e && (e.code === '42P01' || e.code === 'PGRST205' || /assistente_atendimentos/.test(e.message ?? ''))
}

export async function listarAtendimentos(limite = 100): Promise<AtendimentoResumo[]> {
  const { data, error } = await createClient().from('assistente_atendimentos').select(RESUMO)
    .order('updated_at', { ascending: false }).limit(limite)
  if (error) throw error
  return (data ?? []).map(resumoFromRow)
}

export async function carregarAtendimento(id: string): Promise<Atendimento> {
  const { data, error } = await createClient().from('assistente_atendimentos').select('*').eq('id', id).single()
  if (error) throw error
  return { ...resumoFromRow(data), estado: (data.estado ?? {}) as Partial<EstadoAtendimento>, mensagens: (data.mensagens ?? []) as Mensagem[] }
}

export async function criarAtendimento(numero: string, autor?: string): Promise<Atendimento> {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  const { data, error } = await sb.from('assistente_atendimentos')
    .insert({ numero, created_by: user?.id ?? null, created_by_nome: autor ?? null, updated_by_nome: autor ?? null })
    .select('*').single()
  if (error) throw error
  return { ...resumoFromRow(data), estado: {}, mensagens: [] }
}

export interface PatchAtendimento {
  titulo?: string
  status?: StatusAtendimento
  espacoSlug?: string | null
  dataEvento?: string | null
  totalLocacao?: number | null
  totalServicos?: number | null
  estado?: Partial<EstadoAtendimento>
  mensagens?: Mensagem[]
}

export async function salvarAtendimento(id: string, p: PatchAtendimento, autor?: string): Promise<string> {
  const row: Row = { updated_at: new Date().toISOString(), updated_by_nome: autor ?? null }
  if (p.titulo !== undefined) row.titulo = p.titulo.trim() || 'Novo atendimento'
  if (p.status !== undefined) row.status = p.status
  if (p.espacoSlug !== undefined) row.espaco_slug = p.espacoSlug || null
  if (p.dataEvento !== undefined) row.data_evento = p.dataEvento || null
  if (p.totalLocacao !== undefined) row.total_locacao = p.totalLocacao
  if (p.totalServicos !== undefined) row.total_servicos = p.totalServicos
  if (p.estado !== undefined) row.estado = p.estado
  const sb = createClient()
  // Mensagens podem chegar pelo WhatsApp enquanto a tela está aberta: grava
  // juntando com o que já está no banco, para não apagar o que chegou.
  if (p.mensagens !== undefined) {
    const { data: atual } = await sb.from('assistente_atendimentos').select('mensagens').eq('id', id).single()
    row.mensagens = juntarMensagens((atual?.mensagens ?? []) as Mensagem[], p.mensagens)
  }
  const { error } = await sb.from('assistente_atendimentos').update(row).eq('id', id)
  if (error) throw error
  return row.updated_at as string
}

export async function excluirAtendimento(id: string): Promise<void> {
  const { error } = await createClient().from('assistente_atendimentos').delete().eq('id', id)
  if (error) throw error
}

// Une duas listas de mensagens pelo id (a segunda vence nos repetidos), em ordem de horário.
export function juntarMensagens(base: Mensagem[], novas: Mensagem[]): Mensagem[] {
  const porId = new Map<string, Mensagem>()
  for (const m of base) porId.set(m.id, m)
  for (const m of novas) porId.set(m.id, m)
  return [...porId.values()].sort((a, b) => a.em.localeCompare(b.em))
}

export function novaMensagem(autor: AutorMensagem, texto: string, por?: string): Mensagem {
  return { id: crypto.randomUUID(), autor, texto, em: new Date().toISOString(), por }
}
