// Funções oferecidas no cadastro — as da Calculadora de Staff mais as que só
// existem no credenciamento (Chefe de Segurança, Produtor Responsável). Função
// fora da lista pode ser digitada à mão no formulário.
export const FUNCOES_CREDENCIAMENTO = [
  'Barman', 'Chefe de Bar', 'Atendente de Bar', 'Segurança', 'Chefe de Segurança', 'Bombeiro', 'Policial',
  'Técnico de Som', 'Técnico de Luz', 'Hostess', 'Recepção', 'Caixa', 'Limpeza', 'Chapelaria',
  'Produtor Responsável',
]

export interface DocumentoExigido {
  tipo: string
  // Documento com prazo: sem data de validade preenchida ele não conta como
  // regular, e depois da data passa a contar como vencido.
  temValidade: boolean
}

// Exigido de todo mundo, qualquer que seja a função.
export const DOCUMENTOS_BASE: DocumentoExigido[] = [
  { tipo: 'RG ou CNH', temValidade: false },
]

// Autorizações próprias de cada função. Função sem entrada aqui só precisa
// dos documentos base.
export const DOCUMENTOS_POR_FUNCAO: Record<string, DocumentoExigido[]> = {
  'Segurança': [
    { tipo: 'CNV — Carteira Nacional de Vigilante (Polícia Federal)', temValidade: true },
  ],
  'Chefe de Segurança': [
    { tipo: 'CNV — Carteira Nacional de Vigilante (Polícia Federal)', temValidade: true },
  ],
  'Bombeiro': [
    { tipo: 'Certificado de Bombeiro Civil', temValidade: true },
  ],
}

export function documentosExigidos(funcao: string): DocumentoExigido[] {
  return [...DOCUMENTOS_BASE, ...(DOCUMENTOS_POR_FUNCAO[funcao] ?? [])]
}

// Antecedência do aviso de "vence em breve".
export const DIAS_AVISO_VENCIMENTO = 30

export type SituacaoDocumento = 'valido' | 'vence_em_breve' | 'vencido' | 'sem_validade' | 'falta'

export interface DocumentoParaSituacao {
  tipo: string
  validade?: string
}

function diasAte(dataISO: string, hojeISO: string): number {
  return Math.round((Date.parse(dataISO) - Date.parse(hojeISO)) / 86_400_000)
}

// Situação de um documento exigido, olhando o que a pessoa já anexou. Com
// mais de um anexo do mesmo tipo (renovação), vale o de validade mais longa.
export function situacaoDoExigido(
  exigido: DocumentoExigido,
  anexados: DocumentoParaSituacao[],
  hojeISO: string,
): { situacao: SituacaoDocumento; validade?: string; dias?: number } {
  const doTipo = anexados.filter(d => d.tipo === exigido.tipo)
  if (doTipo.length === 0) return { situacao: 'falta' }
  if (!exigido.temValidade) return { situacao: 'valido' }

  const validade = doTipo.map(d => d.validade).filter((v): v is string => !!v).sort().at(-1)
  if (!validade) return { situacao: 'sem_validade' }

  const dias = diasAte(validade, hojeISO)
  if (dias < 0) return { situacao: 'vencido', validade, dias }
  if (dias <= DIAS_AVISO_VENCIMENTO) return { situacao: 'vence_em_breve', validade, dias }
  return { situacao: 'valido', validade, dias }
}

export type SituacaoCredenciamento = 'apto' | 'atencao' | 'pendente'

// Apto: tudo que a função exige está anexado e em dia. Atenção: em dia, mas
// algo vence em breve. Pendente: falta documento, falta a validade ou venceu.
export function situacaoCredenciamento(
  funcao: string,
  anexados: DocumentoParaSituacao[],
  hojeISO: string,
): SituacaoCredenciamento {
  const situacoes = documentosExigidos(funcao).map(e => situacaoDoExigido(e, anexados, hojeISO).situacao)
  if (situacoes.some(s => s === 'falta' || s === 'vencido' || s === 'sem_validade')) return 'pendente'
  if (situacoes.some(s => s === 'vence_em_breve')) return 'atencao'
  return 'apto'
}

// Situação de um documento avulso (fora da lista de exigidos, ou de empresa),
// olhando só a validade dele. Sem validade informada, não há o que vencer.
export function situacaoDaValidade(
  validade: string | undefined,
  hojeISO: string,
): { situacao: 'valido' | 'vence_em_breve' | 'vencido'; dias?: number } {
  if (!validade) return { situacao: 'valido' }
  const dias = diasAte(validade, hojeISO)
  if (dias < 0) return { situacao: 'vencido', dias }
  if (dias <= DIAS_AVISO_VENCIMENTO) return { situacao: 'vence_em_breve', dias }
  return { situacao: 'valido', dias }
}

// Empresa não tem lista de documentos exigidos — vale o que foi anexado:
// pendente se algum venceu, atenção se algum vence em breve. Renovação (dois
// anexos do mesmo tipo) conta pela validade mais longa, como na pessoa.
export function situacaoEmpresa(anexados: DocumentoParaSituacao[], hojeISO: string): SituacaoCredenciamento {
  const validadePorTipo = new Map<string, string | undefined>()
  for (const d of anexados) {
    const atual = validadePorTipo.get(d.tipo)
    const semPrazo = validadePorTipo.has(d.tipo) && atual === undefined
    if (!d.validade || semPrazo) validadePorTipo.set(d.tipo, undefined)
    else if (!atual || d.validade > atual) validadePorTipo.set(d.tipo, d.validade)
  }
  const situacoes = Array.from(validadePorTipo.values()).map(v => situacaoDaValidade(v, hojeISO).situacao)
  if (situacoes.includes('vencido')) return 'pendente'
  if (situacoes.includes('vence_em_breve')) return 'atencao'
  return 'apto'
}
