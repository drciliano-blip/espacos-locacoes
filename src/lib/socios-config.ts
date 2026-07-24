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
