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

// Feature 3: Tipo de Evento
export type TipoEvento = 'Festivo' | 'Corporativo' | 'Audiovisual'

// Feature 2: Níveis de acesso
export type NivelAcesso = 'admin' | 'financeiro' | 'operacional' | 'visualizador'

// Feature 1: Contas a Pagar
export type CategoriaContaPagar = 'fixa' | 'variavel'
export type SubcategoriaContaFixa = 'aluguel' | 'energia' | 'internet' | 'funcionários'
export type SubcategoriaContaVariavel = 'manutenção' | 'fornecedores' | 'extras'
export type StatusContaPagar = 'pendente' | 'pago' | 'atrasado'

// Feature 6: Documentos por evento
export interface Documento {
  id: string
  nome: string
  tipo: 'contrato' | 'comprovante' | 'autorização' | 'observação' | 'outro'
  dataUpload: string
  tamanho?: string
}

export interface Evento {
  id: string
  cliente: string
  espaco: Espaco
  data: string
  horaInicio: string
  horaFim: string
  tipo: string
  tipoEvento?: TipoEvento  // Feature 3
  status: StatusEvento
  valor: number
  observacoes?: string
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
  documentos?: Documento[]  // Feature 6
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

// Feature 1: Conta a Pagar
export interface ContaPagar {
  id: string
  descricao: string
  espaco: Espaco | 'Todos'
  categoria: CategoriaContaPagar
  subcategoria: SubcategoriaContaFixa | SubcategoriaContaVariavel
  valor: number
  status: StatusContaPagar
  dataVencimento: string
  dataPagamento?: string
  fornecedor?: string
  observacoes?: string
}

// Feature 2: Usuário do sistema
export interface Usuario {
  id: string
  nome: string
  email: string
  senha: string
  role: NivelAcesso
  ativo: boolean
  createdAt: string
  ultimoAcesso?: string
}
