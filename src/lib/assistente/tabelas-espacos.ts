// Tabela de locação de cada espaço, usada pelo Assistente de IA para montar o
// Orçamento de Locação. Fonte: as artes de valores de cada espaço (Fabrique,
// Usine, House Pacaembu, Armazém Solon, CESA) enviadas em 21/11/2026.
// Complexo Jussara fica de fora: está em negociação de venda e cada proposta
// é analisada pessoalmente.
//
// Fica em código (e não no banco) nesta primeira etapa para a aba funcionar
// sem migration. Quando o portal do dono existir, isto vira cadastro.
//
// precos: índice = dia da semana do JS (0 = domingo ... 6 = sábado).

export interface BlocoLista {
  titulo: string
  itens: string[]
}

export interface TabelaEspaco {
  slug: string // igual a espacos.slug no banco (para checar a agenda)
  nome: string
  logo: string // em /public/logos, recortado da arte do espaço
  endereco: string
  capacidade: number
  precos: [number, number, number, number, number, number, number]
  vespera?: number
  feriado?: number
  acrescimoDezembroPct?: number
  horasInclusas: number
  montagemDiaAnterior?: number
  staffDaCasa: string[]
  estrutura: string[]
  rider: BlocoLista[]
  obrigatorios: string[] // vai no orçamento como observação obrigatória
  pagamento: RegraPagamento[]
  observacoes: string[]
  aPartirDe?: boolean // tabela "a partir de" (pode variar pelo formato do evento)
  semAgendaNoSistema?: boolean
  semTabela?: boolean // sem valores cadastrados: locação digitada à mão
}

export interface RegraPagamento { descricao: string; pct: number; diasAntes?: number }

// FASTIX: tiqueteira parceira enquanto a da E&L não fica pronta. Pelo contrato,
// é obrigatória nos eventos em parceria e opcional nas locações; quem vende
// ingresso por ela paga 25% na reserva e 75% até 8 dias antes.
export const PAGAMENTO_FASTIX: RegraPagamento[] = [
  { descricao: 'Na reserva da data (condição FASTIX)', pct: 25 },
  { descricao: 'Até 8 dias antes do evento (condição FASTIX)', pct: 75, diasAntes: 8 },
]

const PAGAMENTO_PADRAO: RegraPagamento[] = [
  { descricao: 'Na reserva da data', pct: 50 },
  { descricao: 'Até 8 dias antes do evento', pct: 50, diasAntes: 8 },
]

export const TABELAS_ESPACOS: TabelaEspaco[] = [
  {
    slug: 'fabrique',
    nome: 'Espaço Fabrique',
    logo: '/logos/espaco-fabrique.png',
    endereco: 'Rua Barra Funda, 1071 · Barra Funda · São Paulo/SP',
    capacidade: 800,
    precos: [10000, 7000, 7000, 7000, 8000, 12000, 15000],
    vespera: 12000,
    feriado: 10000,
    acrescimoDezembroPct: 10,
    horasInclusas: 8,
    staffDaCasa: [
      '02 seguranças patrimoniais',
      '01 gerente técnico de manutenção',
      '02 profissionais de limpeza',
      'Material e insumos de limpeza',
      '01 técnico de som',
      '01 técnico de iluminação',
    ],
    estrutura: [
      'Palco 8 m × 5 m × 1,50 m',
      '01 camarim amplo e equipado',
      'Ar-condicionado 420.000 BTUs',
      'Acessibilidade completa e toalete PNE',
      'Banheiros: 5 cabines fem. · 2 cabines masc. + mictório coletivo',
    ],
    rider: [
      { titulo: 'Som', itens: ['Line Array DAS Aero 28', '08 subwoofers 218', 'Console digital X32', 'Processamento DBX Venue 360'] },
      { titulo: 'DJ', itens: ['02 CDJ 2000 Nexus', '01 mixer DJM 900 Nexus'] },
      { titulo: 'Backline', itens: ['Amplificador Fender Hot Rod Deluxe', 'Amplificador Hartke HA3500', 'Corpo de bateria Pearl'] },
      { titulo: 'Microfones e LED', itens: ['Shure SM58 e SM57', 'Kits PGX Shure', 'Painel de LED'] },
    ],
    obrigatorios: ['Staff complementar obrigatório, dimensionado pela capacidade do evento.'],
    pagamento: PAGAMENTO_PADRAO,
    observacoes: ['Valores para até 8 horas de evento.', 'Corporativo sob consulta.'],
  },
  {
    slug: 'usine',
    nome: 'Espaço Usine',
    logo: '/logos/espaco-usine.png',
    endereco: 'Rua Barra Funda, 973 · Barra Funda · São Paulo/SP',
    capacidade: 1500,
    precos: [15000, 10000, 10000, 10000, 12000, 16000, 22000],
    vespera: 16000,
    feriado: 15000,
    acrescimoDezembroPct: 10,
    horasInclusas: 8,
    staffDaCasa: [
      '04 seguranças patrimoniais',
      '01 gerente técnico de manutenção',
      '04 pessoas para limpeza de banheiro e salão',
      'Material e insumos de limpeza',
      '01 técnico de som',
      '01 técnico de luz',
    ],
    estrutura: [
      'Palco 5 m × 6 m × 1 m',
      '02 salas amplas para camarim',
      'Ar-condicionado 600.000 BTUs',
      'Acessibilidade completa e toalete PNE',
      'Banheiros: 18 cabines fem. · 6 cabines masc. + 9 mictórios',
    ],
    rider: [
      { titulo: 'PA (montado fixo)', itens: ['10 DAS Aero 38 (5 por lado)', '08 subs duplos de 18"', 'Processamento DBX 360', 'Mesa de gerenciamento Yamaha 01V', '02 caixas RCF de delay no mezanino'] },
      { titulo: 'DJ', itens: ['02 CDJ 2000 Nexus 2', '01 DJM 900 Nexus 2', '02 caixas SM222', '02 subs QSC KW181', 'Praticável 2 × 1 m'] },
      { titulo: 'Música ao vivo (solicitar 1 semana antes)', itens: ['Console 32 canais (LS9, X32 ou Midas32)', 'Multicabo 36 vias', 'Amplificadores de baixo e guitarra', 'Corpo de bateria', '06 mics de voz 58 e 06 de instrumento 57', 'Kit de bateria Shure PG, 06 direct box, 02 monitores ativos'] },
      { titulo: 'Iluminação e LED', itens: ['Palco: 10 moving beam 280 W, 08 par LED, 04 strobes, 06 cobys, 02 brutts', 'Mesa de luz MA Wing', 'Pista: 06 moving beam 280 W e 18 par LED', 'Painel de LED P3 4 m × 2,5 m com processadora'] },
    ],
    obrigatorios: [
      'Contratação obrigatória de gerador 180 kVA.',
      'Staff complementar obrigatório, dimensionado pela capacidade do evento.',
    ],
    pagamento: PAGAMENTO_PADRAO,
    observacoes: ['Valores para até 8 horas de evento.', 'Corporativo sob consulta.'],
  },
  {
    slug: 'house-pacaembu',
    nome: 'House Pacaembu',
    logo: '/logos/espaco-house-pacaembu.png',
    endereco: 'Rua Alagoas, 836 · Higienópolis · São Paulo/SP',
    capacidade: 250,
    precos: [6500, 4000, 4000, 4000, 4500, 6500, 8000],
    vespera: 8000,
    feriado: 6500,
    horasInclusas: 8,
    staffDaCasa: [
      '01 segurança patrimonial',
      '01 gerente',
      '01 limpeza durante e pós-evento',
      'Material e insumos de limpeza',
      'Técnico de som e luz',
    ],
    estrutura: [
      'Cabine para DJ móvel',
      'Ar-condicionado 72.000 BTUs',
      'Toalete PNE',
      '03 banheiros · 07 cabines · 04 mictórios',
    ],
    rider: [
      { titulo: 'Som', itens: ['Controladora Pioneer RR XDJ', '02 Electro-Voice ZLX 12"', '01 JBL Eon', '01 subwoofer NXA 18" 2600 W', '01 retorno NXA 8" 200 W'] },
      { titulo: 'Iluminação', itens: ['04 movings', '06 par LED', '01 máquina de fumaça', 'LED linear digital (55 m)'] },
    ],
    obrigatorios: ['Staff complementar poderá ser necessário, conforme capacidade e características do evento.'],
    pagamento: PAGAMENTO_PADRAO,
    observacoes: ['Valores para até 8 horas de evento.'],
  },
  {
    slug: 'espaco-solon',
    nome: 'Armazém Solon',
    logo: '/logos/espaco-solon.png',
    endereco: 'Rua Solon, 1121 · Bom Retiro · São Paulo/SP',
    capacidade: 1500,
    precos: [25000, 20000, 20000, 20000, 20000, 30000, 40000],
    horasInclusas: 8,
    montagemDiaAnterior: 5000,
    staffDaCasa: ['Equipe de segurança da casa (06 seguranças para público de 1.500 pessoas)'],
    estrutura: [
      'Espaço industrial histórico com área aberta',
      'Anexo de banheiros 1: PCD unissex com chuveiro, 4 cabines fem., 2 boxes fem., 4 cabines masc., 2 boxes masc.',
      'Anexo de banheiros 2: 2 cabines fem., 2 cabines masc., 1 banheiro para posto médico',
      'Complemento: + 2 cabines sanitárias e mictório coletivo para até 10 pessoas',
    ],
    rider: [],
    obrigatorios: [
      'Grandes eventos: equipe mínima de segurança conforme exigência (para 1.500 pessoas, 20 no total: 6 da casa + 14 da equipe do cliente).',
      '06 bombeiros e 01 ambulância UTI básica.',
      'Som na área aberta permitido apenas até as 22h.',
    ],
    pagamento: [
      { descricao: 'Na reserva da data (PIX)', pct: 50 },
      { descricao: 'Até 8 dias antes do evento (PIX)', pct: 50, diasAntes: 8 },
    ],
    observacoes: ['Evento corporativo: valor sob consulta.'],
  },
  {
    slug: 'cesa',
    nome: 'CESA Eventos SP',
    logo: '/logos/espaco-cesa.png',
    endereco: 'Av. Adolfo Pinheiro, 384 · Santo Amaro · São Paulo/SP (galeria Borba Gato)',
    capacidade: 564,
    precos: [15000, 3500, 3500, 3500, 5500, 7500, 7500], // quarta: R$ 3.500 (confirmado em 21/11; a arte mostra 10.000)
    horasInclusas: 8,
    aPartirDe: true,
    semAgendaNoSistema: true,
    staffDaCasa: [],
    estrutura: [
      'Plenária com 564 poltronas',
      '11 espaços para cadeirantes',
      'Ambiente climatizado',
      'Em frente à estação de metrô Adolfo Pinheiro',
    ],
    rider: [],
    obrigatorios: [],
    pagamento: PAGAMENTO_PADRAO,
    observacoes: ['Valores a partir da tabela, podendo variar conforme tipo, formato e necessidades do evento.'],
  },
]

export function tabelaPorSlug(slug: string | null | undefined): TabelaEspaco | undefined {
  return TABELAS_ESPACOS.find(t => t.slug === slug)
}
