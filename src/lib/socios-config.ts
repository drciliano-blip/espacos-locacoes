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
    { nome: 'GCR', percentual: 63 },
    { nome: 'FJ Cines Ltda', percentual: 27 },
    { nome: 'Trupe Labels', percentual: 10 },
  ],
  'Espaço Solon': [
    { nome: 'GCR', percentual: 80 },
    { nome: 'RUB', percentual: 20 },
  ],
  'House Pacaembu': [
    { nome: 'Cliente', percentual: 100 },
  ],
}

// Sócios que participam dos custos/aportes da obra de cada espaço — não é o
// mesmo grupo de DIVISAO_SOCIOS. Um sócio pode ter participação societária e
// no resultado operacional sem participar da obra (ex: Trupe Labels no
// Complexo Jussara, que tem 10% de participação societária/operacional mas
// 0% de responsabilidade na obra). Espaço sem entrada aqui não tem obra.
export const SOCIOS_OBRA: Record<string, string[]> = {
  'Complexo Jussara': ['GCR', 'FJ Cines Ltda'],
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
