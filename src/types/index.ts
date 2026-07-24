export type Espaco =
  | 'Usine'
  | 'Fabrique'
  | 'House Pacaembu'
  | 'Complexo Jussara'
  | 'Espaço Solon'

export type StatusPagamento = 'pago' | 'pendente' | 'atrasado'
export type StatusEvento = 'confirmado' | 'em_negociacao' | 'cancelado'
export type FormaPagamento = 'PIX' | 'Transferência' | 'Dinheiro' | 'Cartão de Crédito' | 'Cartão de Débito' | 'Cheque' | 'Parcelado'
export type Decoracao = 'própria' | 'terceirizada' | 'não aplicável'
export type StatusVistoria = 'pendente' | 'aprovada' | 'aprovada com ressalvas' | 'reprovada' | 'não realizada'

// Feature 3: Tipo de Evento
export type TipoEvento = 'Festivo' | 'Corporativo' | 'Audiovisual'

// Feature 2: Níveis de acesso
export type NivelAcesso = 'admin' | 'financeiro' | 'operacional' | 'visualizador'

// Feature 1: Contas a Pagar
export type CategoriaContaPagar = 'fixa' | 'variavel'
export type SubcategoriaContaFixa = 'aluguel' | 'energia' | 'internet' | 'funcionários' | 'outros'
export type SubcategoriaContaVariavel = 'manutenção' | 'fornecedores' | 'extras' | 'outros'
export type StatusContaPagar = 'pendente' | 'pago' | 'atrasado'

// Feature 6: Documentos por evento
export interface Documento {
  id: string
  nome: string
  tipo: 'contrato' | 'comprovante' | 'autorização' | 'observação' | 'outro'
  dataUpload: string
  tamanho?: string
}

export interface EnderecoCompleto {
  rua?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  estado?: string
  cep?: string
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
  valorSinal?: number
  dataVencimentoSaldo?: string
  responsavel?: string
  telefoneContato?: string
  decoracao?: Decoracao
  observacoesTecnicas?: string
  statusVistoria?: StatusVistoria
  documentos?: Documento[]  // Feature 6
  // Dados completos do cliente (mesmos solicitados na ficha, usados na elaboração do contrato)
  nomeEvento?: string
  horaInicioMontagem?: string
  cpf?: string
  rg?: string
  dataNascimento?: string
  email?: string
  endereco?: EnderecoCompleto
  pessoaJuridica?: boolean
  razaoSocial?: string
  nomeFantasia?: string
  cnpj?: string
  enderecoEmpresa?: EnderecoCompleto
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

export type TipoMinuta = 'locacao' | 'parceria'

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
  tipoMinuta?: TipoMinuta
  valorNegociado?: number
  observacaoNegociacao?: string
  observacaoParceria?: string
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

// Espaço cadastrado manualmente pelo usuário
export interface EspacoCustomData {
  id: string
  slug: string
  nome: string
  endereco: string
  capacidade: number
  descricao: string
  status: 'ativo' | 'inativo'
  fotoFileId?: string
  criadoEm: string
}

// Dados legais do espaço (CEDENTE/LOCADORA no texto do contrato gerado por IA)
export interface DadosLegaisEspaco {
  cnpj?: string
  responsavelNome?: string
  responsavelRg?: string
  responsavelCpf?: string
}

// Documentos de funcionários
export interface Funcionario {
  id: string
  nomeCompleto: string
  cargo: string
  espacoVinculado: string
  telefone: string
  criadoEm: string
}

// Ficha de cadastro do cliente (formulário público /ficha-cliente)
export interface FichaCliente {
  id: string
  criadoEm: string
  // Dados pessoais
  nomeCompleto: string
  cpf: string
  rg?: string
  dataNascimento?: string
  email: string
  telefoneCelular: string
  endereco: {
    rua?: string
    numero?: string
    complemento?: string
    bairro?: string
    cidade?: string
    estado?: string
    cep?: string
  }
  // Dados da empresa (opcional)
  pessoaJuridica: boolean
  razaoSocial?: string
  nomeFantasia?: string
  cnpj?: string
  enderecoEmpresa?: {
    rua?: string
    numero?: string
    complemento?: string
    bairro?: string
    cidade?: string
    estado?: string
    cep?: string
  }
  // Informações do evento
  nomeEvento: string
  espacoDesejado: string
  tipoEvento: string
  dataEvento: string
  horaInicioMontagem?: string
  horaInicioEvento?: string
  horaTerminoEvento?: string
  valorLocacao?: string
  formaPagamento?: string
  valorSinal?: string
  dataVencimentoSaldo?: string
  documentoFileId?: string
}
