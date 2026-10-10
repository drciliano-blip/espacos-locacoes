import type { DocumentoCredenciamento, EmpresaTerceirizada, EscalaEvento, Terceirizado, TipoContratacao } from '@/types'

export const GREEN = '#25D366'
export const DARK_GREEN = '#128C7E'

export const INPUT_CLASS = 'w-full rounded-lg border border-app-border2 bg-app-surface2 px-3 py-1.5 text-sm text-app-text focus:outline-none focus:border-[#25D366]'

export const SELECT_EMPRESA = '*, documentos:empresa_documentos(*)'
export const SELECT_TERCEIRIZADO = '*, empresa:empresas_terceirizadas(nome), documentos:terceirizado_documentos(*)'

export interface EmpresaRow {
  id: string
  nome: string
  cnpj: string | null
  contato_nome: string | null
  telefone: string | null
  email: string | null
  observacoes: string | null
  documentos: DocumentoRow[] | null
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
  empresa_id: string | null
  empresa: { nome: string } | null
  status: 'ativo' | 'inativo'
  observacoes: string | null
  documentos: DocumentoRow[] | null
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
    documentos: (row.documentos ?? []).map(documentoFromRow),
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
    empresaId: row.empresa_id ?? undefined,
    empresaNome: row.empresa?.nome ?? '',
    status: row.status,
    observacoes: row.observacoes ?? '',
    documentos: (row.documentos ?? []).map(documentoFromRow),
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
