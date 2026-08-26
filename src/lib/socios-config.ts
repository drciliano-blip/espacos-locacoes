export interface SocioSplit {
  nome: string
  percentual: number
}

// Divisão do lucro líquido (entradas pagas - saídas pagas) de cada espaço entre os sócios.
export const DIVISAO_SOCIOS: Record<string, SocioSplit[]> = {
  'Fabrique': [
    { nome: 'Camilo', percentual: 100 },
  ],
  'Usine': [
    { nome: 'Camilo', percentual: 50 },
    { nome: 'Zig', percentual: 15 },
    { nome: 'Gruppo', percentual: 15 },
    { nome: 'Marcelo MZ', percentual: 20 },
  ],
  'Complexo Jussara': [
    { nome: 'Camilo', percentual: 31.5 },
    { nome: 'Alex', percentual: 31.5 },
    { nome: 'Giscard', percentual: 27 },
    { nome: 'Trupe Labels', percentual: 10 },
  ],
  'Espaço Solon': [
    { nome: 'Camilo', percentual: 40 },
    { nome: 'Alex', percentual: 40 },
    { nome: 'RUB', percentual: 20 },
  ],
  'House Pacaembu': [
    { nome: 'Cliente', percentual: 100 },
  ],
}

// Nomes alternativos que já aparecem em lançamentos antigos de Contas Pagar
// (nome completo/formal em vez do apelido usado no dropdown, por exemplo) —
// usado só na hora de somar/agrupar por sócio, nunca oferecido como opção
// nova nos formulários (esses continuam mostrando só o nome canônico).
export const ALIASES_SOCIOS: Record<string, string> = {
  'ALEXANDRE CAMILLO TESSITORE': 'Alex',
}

// Resolve um nome de sócio (como veio salvo no fornecedor/socioResponsável)
// pro nome canônico usado em DIVISAO_SOCIOS — bate maiúsc./minúsc. e espaços
// nas pontas, mas não tenta adivinhar nada além dos aliases cadastrados.
export function nomeCanonicoSocio(nome: string): string {
  const chave = nome.trim().toUpperCase()
  for (const [alias, canonico] of Object.entries(ALIASES_SOCIOS)) {
    if (alias.toUpperCase() === chave) return canonico
  }
  return nome
}

// Sócios que participam dos custos/aportes da obra de cada espaço — não é o
// mesmo grupo de DIVISAO_SOCIOS. Um sócio pode ter participação societária e
// no resultado operacional sem participar da obra (ex: Trupe Labels no
// Complexo Jussara, que tem 10% de participação societária/operacional mas
// 0% de responsabilidade na obra). Espaço sem entrada aqui não tem obra.
export const SOCIOS_OBRA: Record<string, string[]> = {
  'Complexo Jussara': ['Camilo', 'Alex', 'Giscard'],
}

// Agrupamentos de exibição — soma sócios individuais num "consolidado" só pra
// mostrar na tela (ex: GCR = Camilo + Alex). Nunca reagrupa lançamento
// nenhum: aporte/retirada continuam vinculados exatamente a quem
// aportou/retirou, isso aqui é só um total calculado a mais.
export const GRUPOS_SOCIOS: Record<string, Record<string, string[]>> = {
  'Complexo Jussara': {
    'GCR': ['Camilo', 'Alex'],
  },
}

// Investimentos societários pontuais (ex: compra de participação) — só um
// registro informativo pro Quadro Societário. Nunca é receita, nunca entra no
// Fechamento da Obra nem no Resultado Operacional.
export interface InvestimentoSocietario {
  socio: string
  valor: number
  descricao: string
}
export const INVESTIMENTOS_SOCIETARIOS: Record<string, InvestimentoSocietario[]> = {
  'Complexo Jussara': [
    { socio: 'Trupe Labels', valor: 300000, descricao: 'Aquisição de 10% de participação societária' },
  ],
}
