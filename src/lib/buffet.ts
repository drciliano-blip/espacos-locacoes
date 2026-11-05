// Buffet EL — módulo separado dos espaços. Lê e grava SÓ as tabelas buffet_*
// (migration 0050); nunca receitas/contas_pagar/espacos, para a receita do
// buffet não cair nos números de nenhum espaço.

import { createClient } from '@/lib/supabase/client'

export type GrupoOpcao = 'tipo_evento' | 'comida' | 'bebida' | 'extra'
export const GRUPO_LABEL: Record<GrupoOpcao, string> = {
  tipo_evento: 'Tipos de evento', comida: 'Comidas', bebida: 'Bebidas', extra: 'Extras e serviços',
}

export interface BuffetOpcao {
  id: string
  grupo: GrupoOpcao
  nome: string
  descricao?: string
  ativo: boolean
  ordem: number
}

export interface BuffetFaixa {
  id: string
  tabelaId: string
  ateConvidados: number
  opcao: string
  valor: number
}

export interface BuffetTabela {
  id: string
  nome: string
  descricao?: string
  inclusos?: string
  observacao?: string
  ativo: boolean
  ordem: number
  faixas: BuffetFaixa[]
}

export type StatusOrcamento = 'rascunho' | 'enviado' | 'aprovado' | 'perdido'
export const STATUS_LABEL: Record<StatusOrcamento, string> = {
  rascunho: 'Rascunho', enviado: 'Enviado', aprovado: 'Aprovado', perdido: 'Perdido',
}
export const STATUS_CLASS: Record<StatusOrcamento, string> = {
  rascunho: 'bg-app-surface2 text-app-muted border-app-border2',
  enviado: 'bg-sky-500/10 text-sky-600 border-sky-500/20',
  aprovado: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  perdido: 'bg-red-500/10 text-red-500 border-red-500/20',
}

export interface BuffetOrcamento {
  id: string
  numero: number
  status: StatusOrcamento
  clienteNome: string
  clienteTelefone?: string
  clienteEmail?: string
  clienteDocumento?: string
  tipoEvento?: string
  dataEvento?: string
  horarioInicio?: string
  duracaoHoras?: number
  local?: string
  convidados?: number
  comidas: string[]
  bebidas: string[]
  extras: string[]
  tabelaId?: string
  opcaoPreco?: string
  valorTabela?: number
  valorFinal?: number
  condicoesPagamento?: string
  validade?: string
  restricoes?: string
  observacoes?: string
  motivoPerda?: string
  enviadoEm?: string
  createdByNome?: string
  createdAt: string
  updatedAt: string
}

export type OrcamentoInput = Omit<BuffetOrcamento, 'id' | 'numero' | 'createdAt' | 'updatedAt' | 'enviadoEm' | 'createdByNome'>

/* eslint-disable @typescript-eslint/no-explicit-any */
const num = (v: any): number | undefined => (v === null || v === undefined ? undefined : Number(v))
const str = (v: any): string | undefined => (v === null || v === undefined || v === '' ? undefined : String(v))

function opcaoFromRow(r: any): BuffetOpcao {
  return { id: r.id, grupo: r.grupo, nome: r.nome, descricao: str(r.descricao), ativo: r.ativo, ordem: r.ordem }
}
function faixaFromRow(r: any): BuffetFaixa {
  return { id: r.id, tabelaId: r.tabela_id, ateConvidados: r.ate_convidados, opcao: r.opcao, valor: Number(r.valor) }
}
function orcamentoFromRow(r: any): BuffetOrcamento {
  return {
    id: r.id, numero: r.numero, status: r.status, clienteNome: r.cliente_nome,
    clienteTelefone: str(r.cliente_telefone), clienteEmail: str(r.cliente_email), clienteDocumento: str(r.cliente_documento),
    tipoEvento: str(r.tipo_evento), dataEvento: str(r.data_evento), horarioInicio: str(r.horario_inicio),
    duracaoHoras: num(r.duracao_horas), local: str(r.local), convidados: num(r.convidados),
    comidas: r.comidas ?? [], bebidas: r.bebidas ?? [], extras: r.extras ?? [],
    tabelaId: str(r.tabela_id), opcaoPreco: str(r.opcao_preco), valorTabela: num(r.valor_tabela), valorFinal: num(r.valor_final),
    condicoesPagamento: str(r.condicoes_pagamento), validade: str(r.validade), restricoes: str(r.restricoes),
    observacoes: str(r.observacoes), motivoPerda: str(r.motivo_perda), enviadoEm: str(r.enviado_em),
    createdByNome: str(r.created_by_nome), createdAt: r.created_at, updatedAt: r.updated_at,
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function orcamentoToRow(o: Partial<OrcamentoInput>) {
  const row: Record<string, unknown> = {}
  const map: [keyof OrcamentoInput, string][] = [
    ['status', 'status'], ['clienteNome', 'cliente_nome'], ['clienteTelefone', 'cliente_telefone'], ['clienteEmail', 'cliente_email'],
    ['clienteDocumento', 'cliente_documento'], ['tipoEvento', 'tipo_evento'], ['dataEvento', 'data_evento'], ['horarioInicio', 'horario_inicio'],
    ['duracaoHoras', 'duracao_horas'], ['local', 'local'], ['convidados', 'convidados'], ['comidas', 'comidas'], ['bebidas', 'bebidas'],
    ['extras', 'extras'], ['tabelaId', 'tabela_id'], ['opcaoPreco', 'opcao_preco'], ['valorTabela', 'valor_tabela'], ['valorFinal', 'valor_final'],
    ['condicoesPagamento', 'condicoes_pagamento'], ['validade', 'validade'], ['restricoes', 'restricoes'], ['observacoes', 'observacoes'],
    ['motivoPerda', 'motivo_perda'],
  ]
  for (const [k, col] of map) if (k in o) row[col] = o[k] ?? null
  return row
}

export async function carregarOpcoes(): Promise<BuffetOpcao[]> {
  const { data, error } = await createClient().from('buffet_opcoes').select('*').order('grupo').order('ordem').order('nome')
  if (error) throw error
  return (data ?? []).map(opcaoFromRow)
}

export async function salvarOpcao(o: Partial<BuffetOpcao> & { grupo: GrupoOpcao; nome: string }): Promise<void> {
  const row = { grupo: o.grupo, nome: o.nome.trim(), descricao: o.descricao?.trim() || null, ativo: o.ativo ?? true, ordem: o.ordem ?? 0 }
  const sb = createClient()
  const { error } = o.id ? await sb.from('buffet_opcoes').update(row).eq('id', o.id) : await sb.from('buffet_opcoes').insert(row)
  if (error) throw error
}

export async function carregarTabelas(): Promise<BuffetTabela[]> {
  const sb = createClient()
  const [{ data: tabs, error: e1 }, { data: faixas, error: e2 }] = await Promise.all([
    sb.from('buffet_tabelas_preco').select('*').order('ordem').order('nome'),
    sb.from('buffet_tabela_faixas').select('*').order('ate_convidados'),
  ])
  if (e1) throw e1
  if (e2) throw e2
  const fx = (faixas ?? []).map(faixaFromRow)
  return (tabs ?? []).map(t => ({
    id: t.id, nome: t.nome, descricao: str(t.descricao), inclusos: str(t.inclusos), observacao: str(t.observacao),
    ativo: t.ativo, ordem: t.ordem, faixas: fx.filter(f => f.tabelaId === t.id),
  }))
}

export async function salvarTabela(t: { id?: string; nome: string; descricao?: string; inclusos?: string; observacao?: string; ativo: boolean }): Promise<string> {
  const row = { nome: t.nome.trim(), descricao: t.descricao?.trim() || null, inclusos: t.inclusos?.trim() || null, observacao: t.observacao?.trim() || null, ativo: t.ativo }
  const sb = createClient()
  if (t.id) {
    const { error } = await sb.from('buffet_tabelas_preco').update(row).eq('id', t.id)
    if (error) throw error
    return t.id
  }
  const { data, error } = await sb.from('buffet_tabelas_preco').insert(row).select('id').single()
  if (error) throw error
  return data.id
}

export async function salvarFaixa(f: { id?: string; tabelaId: string; ateConvidados: number; opcao: string; valor: number }): Promise<void> {
  const row = { tabela_id: f.tabelaId, ate_convidados: f.ateConvidados, opcao: f.opcao.trim(), valor: f.valor }
  const sb = createClient()
  const { error } = f.id ? await sb.from('buffet_tabela_faixas').update(row).eq('id', f.id) : await sb.from('buffet_tabela_faixas').insert(row)
  if (error) throw error
}

// Faixa de preço é configuração (não é dado de cliente) — pode ser removida.
export async function excluirFaixa(id: string): Promise<void> {
  const { error } = await createClient().from('buffet_tabela_faixas').delete().eq('id', id)
  if (error) throw error
}

export async function carregarOrcamentos(): Promise<BuffetOrcamento[]> {
  const { data, error } = await createClient().from('buffet_orcamentos').select('*').order('numero', { ascending: false })
  if (error) throw error
  return (data ?? []).map(orcamentoFromRow)
}

export async function criarOrcamento(o: OrcamentoInput, autorNome?: string): Promise<BuffetOrcamento> {
  const { data, error } = await createClient().from('buffet_orcamentos')
    .insert({ ...orcamentoToRow(o), created_by_nome: autorNome ?? null }).select('*').single()
  if (error) throw error
  return orcamentoFromRow(data)
}

export async function atualizarOrcamento(id: string, patch: Partial<OrcamentoInput> & { enviadoEm?: string }): Promise<BuffetOrcamento> {
  const row = { ...orcamentoToRow(patch), updated_at: new Date().toISOString(), ...(patch.enviadoEm ? { enviado_em: patch.enviadoEm } : {}) }
  const { data, error } = await createClient().from('buffet_orcamentos').update(row).eq('id', id).select('*').single()
  if (error) throw error
  return orcamentoFromRow(data)
}

// Preço sugerido: menor faixa da tabela que comporta os convidados, na opção
// escolhida (ex.: cerveja). É só sugestão — o operador ajusta o valor final.
export function sugerirFaixa(tabela: BuffetTabela | undefined, opcao: string | undefined, convidados: number | undefined): BuffetFaixa | undefined {
  if (!tabela || !opcao || !convidados) return undefined
  return tabela.faixas
    .filter(f => f.opcao === opcao && f.ateConvidados >= convidados)
    .sort((a, b) => a.ateConvidados - b.ateConvidados)[0]
}

export function opcoesDaTabela(tabela: BuffetTabela | undefined): string[] {
  return tabela ? [...new Set(tabela.faixas.map(f => f.opcao))] : []
}

export async function nomeDoUsuarioAtual(): Promise<string | undefined> {
  const sb = createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return undefined
  const { data } = await sb.from('profiles').select('nome').eq('id', user.id).single()
  return data?.nome ?? undefined
}
