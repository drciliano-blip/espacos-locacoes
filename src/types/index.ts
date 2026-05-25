export type Espaco =
  | 'Usine'
  | 'Fabrique'
  | 'House Pacaembu'
  | 'Complexo Jussara'
  | 'Espaço Solon'

export type StatusPagamento = 'pago' | 'pendente' | 'atrasado'
export type StatusEvento = 'confirmado' | 'tentativo' | 'cancelado'
export type FormaPagamento = 'PIX' | 'Transferência' | 'Dinheiro' | 'Cartão de Crédito' | 'Cartão de Débito' | 'Cheque'
export type Decoracao = 'própria' | 'terceirizada' | 'não aplicável'
export type StatusVistoria = 'pendente' | 'aprovada' | 'aprovada com ressalvas' | 'reprovada' | 'não realizada'

export interface Evento {
  id: string
  cliente: string
  espaco: Espaco
  data: string
  horaInicio: string
  horaFim: string
  tipo: string
  status: StatusEvento
  valor: number
  observacoes?: string
  // Campos extras
  numeroPessoas?: number
  capacidadeUtilizada?: number
  faturamentoBruto?: number
  faturamentoLiquido?: number
  formaPagamento?: FormaPagamento
  dataVencimentoSaldo?: string
  responsavel?: string
  telefoneContato?: string
  decoracao?: Decoracao
  observacoesTecnicas?: string
  statusVistoria?: StatusVistoria
}

export interface Pagamento {
  id: string
  eventoId: string
  cliente: string
  espaco: Espaco
  dataEvento: string
  dataPagamento?: string
  valor: number
  status: StatusPagamento
  metodoPagamento?: string
  descricao: string
}

export interface Contrato {
  id: string
  numeroContrato: string
  cliente: string
  cpfCnpj: string
  espaco: Espaco
  dataEvento: string
  horaInicio: string
  horaFim: string
  valorTotal: number
  valorEntrada: number
  dataAssinatura: string
  status: StatusEvento
  observacoes: string
  responsavel: string
  tipo: string
}
