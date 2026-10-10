import type {
  AnotacaoCredenciamento, Avaliacao, DocumentoCredenciamento, EmpresaTerceirizada, EscalaEvento,
  StatusCredenciamento, Terceirizado, TipoContratacao,
} from '@/types'
import { createClient } from '@/lib/supabase/client'

export const GREEN = '#25D366'
export const DARK_GREEN = '#128C7E'

export const INPUT_CLASS = 'w-full rounded-lg border border-app-border2 bg-app-surface2 px-3 py-1.5 text-sm text-app-text focus:outline-none focus:border-[#25D366]'

export const SELECT_EMPRESA = '*, documentos:empresa_documentos(*), anotacoes:credenciamento_anotacoes(*)'
export const SELECT_TERCEIRIZADO = '*, empresa:empresas_terceirizadas(nome, status), documentos:terceirizado_documentos(*), anotacoes:credenciamento_anotacoes(*)'

export interface EmpresaRow {
  id: string
  nome: string
  cnpj: string | null
  contato_nome: string | null
  telefone: string | null
  email: string | null
  observacoes: string | null
  status: StatusCredenciamento
  motivo_veto: string | null
  avaliacao: Avaliacao | null
  documentos: DocumentoRow[] | null
  anotacoes: AnotacaoRow[] | null
}

export interface AnotacaoRow {
  id: string
  texto: string
  autor_nome: string | null
  created_at: string
}

export interface DocumentoRow {
  id: string
  tipo: string
  numero: string | null
  validade: string | null
  file_id: string | null
  created_at: string
}

export interface TerceirizadoRow {
  id: string
  nome_completo: string
  cpf: string | null
  rg: string | null
  data_nascimento: string | null
  telefone: string | null
  email: string | null
  funcao: string
  tipo_contratacao: TipoContratacao
  cnpj: string | null
  razao_social: string | null
  empresa_id: string | null
  empresa: { nome: string; status: StatusCredenciamento } | null
  status: StatusCredenciamento
  motivo_veto: string | null
  avaliacao: Avaliacao | null
  observacoes: string | null
  documentos: DocumentoRow[] | null
  anotacoes: AnotacaoRow[] | null
}

// Mais recente primeiro — é um histórico.
export function anotacoesFromRows(rows: AnotacaoRow[] | null): AnotacaoCredenciamento[] {
  return (rows ?? [])
    .map(r => ({ id: r.id, texto: r.texto, autorNome: r.autor_nome ?? '', criadoEm: r.created_at }))
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
}

export function empresaFromRow(row: EmpresaRow): EmpresaTerceirizada {
  return {
    id: row.id,
    nome: row.nome,
    cnpj: row.cnpj ?? '',
    contatoNome: row.contato_nome ?? '',
    telefone: row.telefone ?? '',
    email: row.email ?? '',
    observacoes: row.observacoes ?? '',
    status: row.status,
    motivoVeto: row.motivo_veto ?? '',
    avaliacao: row.avaliacao ?? undefined,
    documentos: (row.documentos ?? []).map(documentoFromRow),
    anotacoes: anotacoesFromRows(row.anotacoes),
  }
}

export function documentoFromRow(row: DocumentoRow): DocumentoCredenciamento {
  return {
    id: row.id,
    tipo: row.tipo,
    numero: row.numero ?? '',
    validade: row.validade ?? undefined,
    fileId: row.file_id ?? undefined,
    criadoEm: row.created_at,
  }
}

export function terceirizadoFromRow(row: TerceirizadoRow): Terceirizado {
  return {
    id: row.id,
    nomeCompleto: row.nome_completo,
    cpf: row.cpf ?? '',
    rg: row.rg ?? '',
    dataNascimento: row.data_nascimento ?? undefined,
    telefone: row.telefone ?? '',
    email: row.email ?? '',
    funcao: row.funcao,
    tipoContratacao: row.tipo_contratacao,
    cnpj: row.cnpj ?? '',
    razaoSocial: row.razao_social ?? '',
    empresaId: row.empresa_id ?? undefined,
    empresaNome: row.empresa?.nome ?? '',
    status: row.status,
    motivoVeto: row.motivo_veto ?? '',
    avaliacao: row.avaliacao ?? undefined,
    observacoes: row.observacoes ?? '',
    documentos: (row.documentos ?? []).map(documentoFromRow),
    anotacoes: anotacoesFromRows(row.anotacoes),
  }
}

export interface EscalaRow {
  id: string
  evento_id: string
  terceirizado_id: string
  funcao: string
}

export function escalaFromRow(row: EscalaRow): EscalaEvento {
  return { id: row.id, eventoId: row.evento_id, terceirizadoId: row.terceirizado_id, funcao: row.funcao }
}

export const SITUACAO_LABEL = {
  apto:     { label: 'Apto',           className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  atencao:  { label: 'Vence em breve', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  pendente: { label: 'Pendente',       className: 'bg-red-500/10 text-red-400 border-red-500/20' },
} as const

export const VETADO_CLASS = 'bg-red-500/15 text-red-400 border-red-500/40'

export const AVALIACAO_LABEL: Record<Avaliacao, { label: string; className: string }> = {
  otimo:   { label: 'Ótimo',   className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  bom:     { label: 'Bom',     className: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
  regular: { label: 'Regular', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
}

export const CONTRATACAO_LABEL: Record<TipoContratacao, string> = {
  direto: 'Pessoa física',
  mei: 'Pessoa jurídica — MEI / CNPJ próprio',
  empresa: 'Pessoa jurídica — empresa terceirizada',
}

// Como a contratação aparece nas listas: o tipo e, quando é PJ, de quem é o CNPJ.
export function descricaoContratacao(p: Terceirizado): string {
  if (p.tipoContratacao === 'mei') return `PJ própria (MEI)${p.cnpj ? ` — CNPJ ${p.cnpj}` : ''}`
  if (p.tipoContratacao === 'empresa') return `PJ — ${p.empresaNome || 'empresa não informada'}`
  return CONTRATACAO_LABEL.direto
}

// Vetar ou retirar o veto entra sozinho no histórico de anotações — o motivo
// do veto fica num campo só, que a próxima edição sobrescreve. Devolve as
// anotações novas (vazio se a situação não mudou ou se a gravação falhar: o
// histórico é secundário, não deve desfazer o que já foi salvo).
export async function registrarMudancaDeVeto(
  dono: { coluna: 'terceirizado_id' | 'empresa_id'; id: string },
  antes: { status: StatusCredenciamento; motivoVeto: string } | null,
  depois: { status: StatusCredenciamento; motivoVeto: string },
): Promise<AnotacaoCredenciamento[]> {
  const eraVetado = antes?.status === 'vetado'
  const ficouVetado = depois.status === 'vetado'
  let texto = ''
  if (ficouVetado && (!eraVetado || antes?.motivoVeto !== depois.motivoVeto)) texto = `Vetado — ${depois.motivoVeto}`
  if (eraVetado && !ficouVetado) texto = 'Veto retirado.'
  if (!texto) return []

  const supabase = createClient()
  const { data, error } = await supabase
    .from('credenciamento_anotacoes')
    .insert({ [dono.coluna]: dono.id, texto })
    .select()
    .single()
  return error ? [] : anotacoesFromRows([data as AnotacaoRow])
}
