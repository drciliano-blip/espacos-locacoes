import type { Evento, Pagamento, Contrato, ContaPagar, Usuario } from '@/types'

export const ESPACOS = [
  'Usine',
  'Fabrique',
  'House Pacaembu',
  'Complexo Jussara',
  'Espaço Solon',
] as const

export const ESPACO_CAPACIDADE: Record<string, number> = {
  'Usine': 400,
  'Fabrique': 250,
  'House Pacaembu': 150,
  'Complexo Jussara': 600,
  'Espaço Solon': 80,
}

export const eventos: Evento[] = [
  {
    id: '1', cliente: 'Família Silva', espaco: 'Usine', data: '2026-05-24',
    horaInicio: '14:00', horaFim: '22:00', tipo: 'Casamento', tipoEvento: 'Festivo',
    status: 'confirmado', valor: 18000, observacoes: 'Decoração floral branca. Estacionamento reservado.',
    numeroPessoas: 320, capacidadeUtilizada: 400, faturamentoBruto: 18000, faturamentoLiquido: 15300,
    formaPagamento: 'Transferência', dataVencimentoSaldo: '2026-05-20', responsavel: 'Mariana Costa',
    telefoneContato: '(11) 99876-5432', decoracao: 'terceirizada',
    observacoesTecnicas: 'Gerador de reserva solicitado. Iluminação cênica inclusa.', statusVistoria: 'pendente',
    documentos: [
      { id: 'd1', nome: 'Contrato Família Silva', tipo: 'contrato', dataUpload: '2026-04-15', tamanho: '245 KB' },
      { id: 'd2', nome: 'Comprovante Entrada', tipo: 'comprovante', dataUpload: '2026-05-10', tamanho: '87 KB' },
    ],
  },
  {
    id: '2', cliente: 'TechCorp Ltda', espaco: 'Fabrique', data: '2026-05-27',
    horaInicio: '09:00', horaFim: '18:00', tipo: 'Congresso', tipoEvento: 'Corporativo',
    status: 'confirmado', valor: 12500, observacoes: 'Precisam de 8 mesas redondas e projetor duplo.',
    numeroPessoas: 200, capacidadeUtilizada: 250, faturamentoBruto: 12500, faturamentoLiquido: 10625,
    formaPagamento: 'PIX', dataVencimentoSaldo: '2026-05-25', responsavel: 'Rafael Lima',
    telefoneContato: '(11) 3456-7890', decoracao: 'não aplicável',
    observacoesTecnicas: 'Wi-Fi corporativo 1Gbps requerido. Coffee break incluso.', statusVistoria: 'aprovada',
    documentos: [
      { id: 'd3', nome: 'Contrato TechCorp', tipo: 'contrato', dataUpload: '2026-04-20', tamanho: '312 KB' },
      { id: 'd4', nome: 'Autorização Evento', tipo: 'autorização', dataUpload: '2026-04-22', tamanho: '56 KB' },
      { id: 'd5', nome: 'Comprovante PIX Integral', tipo: 'comprovante', dataUpload: '2026-05-15', tamanho: '34 KB' },
    ],
  },
  {
    id: '3', cliente: 'Ana Rodrigues', espaco: 'House Pacaembu', data: '2026-05-31',
    horaInicio: '16:00', horaFim: '23:00', tipo: 'Aniversário', tipoEvento: 'Festivo',
    status: 'tentativo', valor: 8200, observacoes: 'Aguardando confirmação do cardápio.',
    numeroPessoas: 100, capacidadeUtilizada: 150, faturamentoBruto: 8200, faturamentoLiquido: 6970,
    formaPagamento: 'Cartão de Crédito', dataVencimentoSaldo: '2026-05-28', responsavel: 'Juliana Pereira',
    telefoneContato: '(11) 97654-3210', decoracao: 'terceirizada',
    observacoesTecnicas: 'Área exclusiva para crianças necessária.', statusVistoria: 'não realizada',
    documentos: [],
  },
  {
    id: '4', cliente: 'Associação XPTO', espaco: 'Complexo Jussara', data: '2026-06-03',
    horaInicio: '19:00', horaFim: '00:00', tipo: 'Formatura', tipoEvento: 'Corporativo',
    status: 'confirmado', valor: 22000, numeroPessoas: 480, capacidadeUtilizada: 600,
    faturamentoBruto: 22000, faturamentoLiquido: 18700, formaPagamento: 'Transferência',
    dataVencimentoSaldo: '2026-05-30', responsavel: 'Rafael Lima', telefoneContato: '(11) 98765-1234',
    decoracao: 'terceirizada', observacoesTecnicas: 'Palco 6x4m. Iluminação cênica inclusa.', statusVistoria: 'pendente',
    documentos: [
      { id: 'd6', nome: 'Contrato Formatura XPTO', tipo: 'contrato', dataUpload: '2026-05-08', tamanho: '289 KB' },
    ],
  },
  {
    id: '5', cliente: 'Carlos Mendes', espaco: 'Espaço Solon', data: '2026-06-07',
    horaInicio: '11:00', horaFim: '17:00', tipo: 'Workshop', tipoEvento: 'Corporativo',
    status: 'confirmado', valor: 4500, numeroPessoas: 40, capacidadeUtilizada: 80,
    faturamentoBruto: 4500, faturamentoLiquido: 3825, formaPagamento: 'PIX',
    dataVencimentoSaldo: '2026-06-05', responsavel: 'Juliana Pereira', telefoneContato: '(11) 91234-5678',
    decoracao: 'não aplicável', observacoesTecnicas: 'Flip chart, ar condicionado e projetor.', statusVistoria: 'não realizada',
    documentos: [
      { id: 'd7', nome: 'Contrato Workshop', tipo: 'contrato', dataUpload: '2026-05-12', tamanho: '198 KB' },
    ],
  },
  {
    id: '6', cliente: 'Família Oliveira', espaco: 'Usine', data: '2026-06-14',
    horaInicio: '15:00', horaFim: '23:00', tipo: 'Casamento', tipoEvento: 'Festivo',
    status: 'confirmado', valor: 21000, observacoes: 'Noivos precisam de sala de apoio separada.',
    numeroPessoas: 380, capacidadeUtilizada: 400, faturamentoBruto: 21000, faturamentoLiquido: 17850,
    formaPagamento: 'Cheque', dataVencimentoSaldo: '2026-06-10', responsavel: 'Mariana Costa',
    telefoneContato: '(11) 99111-2233', decoracao: 'terceirizada',
    observacoesTecnicas: 'Sala VIP separada para noivos. Entrada exclusiva para fornecedores.', statusVistoria: 'pendente',
    documentos: [
      { id: 'd8', nome: 'Contrato Família Oliveira', tipo: 'contrato', dataUpload: '2026-03-22', tamanho: '251 KB' },
      { id: 'd9', nome: 'Comprovante Cheque Entrada', tipo: 'comprovante', dataUpload: '2026-05-05', tamanho: '43 KB' },
      { id: 'd10', nome: 'Autorização Fornecedores', tipo: 'autorização', dataUpload: '2026-05-20', tamanho: '67 KB' },
    ],
  },
  {
    id: '7', cliente: 'Instituto Educação', espaco: 'Fabrique', data: '2026-06-10',
    horaInicio: '08:00', horaFim: '17:00', tipo: 'Seminário', tipoEvento: 'Corporativo',
    status: 'confirmado', valor: 9800, numeroPessoas: 180, capacidadeUtilizada: 250,
    faturamentoBruto: 9800, faturamentoLiquido: 8330, formaPagamento: 'Transferência',
    dataVencimentoSaldo: '2026-06-05', responsavel: 'Rafael Lima', telefoneContato: '(11) 3222-4444',
    decoracao: 'própria', observacoesTecnicas: 'Sistema de som completo requerido.', statusVistoria: 'aprovada',
    documentos: [
      { id: 'd11', nome: 'Contrato Instituto Educação', tipo: 'contrato', dataUpload: '2026-05-01', tamanho: '223 KB' },
      { id: 'd12', nome: 'Comprovante PIX Integral', tipo: 'comprovante', dataUpload: '2026-05-20', tamanho: '29 KB' },
    ],
  },
  {
    id: '8', cliente: 'Beatriz Santos', espaco: 'House Pacaembu', data: '2026-06-21',
    horaInicio: '18:00', horaFim: '00:00', tipo: 'Festa 15 anos', tipoEvento: 'Festivo',
    status: 'tentativo', valor: 11500, observacoes: 'Verificar disponibilidade de palco.',
    numeroPessoas: 120, capacidadeUtilizada: 150, faturamentoBruto: 11500, faturamentoLiquido: 9775,
    formaPagamento: 'PIX', dataVencimentoSaldo: '2026-06-18', responsavel: 'Juliana Pereira',
    telefoneContato: '(11) 97788-9900', decoracao: 'terceirizada',
    observacoesTecnicas: 'Palco para show. Cabine fotográfica solicitada.', statusVistoria: 'não realizada',
    documentos: [],
  },
  {
    id: '9', cliente: 'Empresa Beta S.A.', espaco: 'Complexo Jussara', data: '2026-06-18',
    horaInicio: '09:00', horaFim: '18:00', tipo: 'Convenção', tipoEvento: 'Corporativo',
    status: 'confirmado', valor: 28000, numeroPessoas: 300, capacidadeUtilizada: 600,
    faturamentoBruto: 28000, faturamentoLiquido: 23800, formaPagamento: 'Transferência',
    dataVencimentoSaldo: '2026-06-14', responsavel: 'Rafael Lima', telefoneContato: '(11) 3100-5500',
    decoracao: 'não aplicável', observacoesTecnicas: 'Tradução simultânea. Sala VIP para diretoria. 3 salas paralelas.', statusVistoria: 'pendente',
    documentos: [
      { id: 'd13', nome: 'Contrato Empresa Beta', tipo: 'contrato', dataUpload: '2026-05-18', tamanho: '378 KB' },
      { id: 'd14', nome: 'Autorização Tradução Simultânea', tipo: 'autorização', dataUpload: '2026-05-20', tamanho: '91 KB' },
    ],
  },
  {
    id: '10', cliente: 'Pedro Alves', espaco: 'Espaço Solon', data: '2026-05-25',
    horaInicio: '14:00', horaFim: '20:00', tipo: 'Aniversário', tipoEvento: 'Festivo',
    status: 'confirmado', valor: 6500, numeroPessoas: 60, capacidadeUtilizada: 80,
    faturamentoBruto: 6500, faturamentoLiquido: 5525, formaPagamento: 'Dinheiro',
    dataVencimentoSaldo: '2026-05-23', responsavel: 'Juliana Pereira', telefoneContato: '(11) 96543-2100',
    decoracao: 'própria', observacoesTecnicas: 'DJ externo autorizado. Acesso às 12h para montagem.', statusVistoria: 'aprovada com ressalvas',
    documentos: [
      { id: 'd15', nome: 'Contrato Pedro Alves', tipo: 'contrato', dataUpload: '2026-05-03', tamanho: '187 KB' },
    ],
  },
  {
    id: '11', cliente: 'Grupo Musical Jazz', espaco: 'Usine', data: '2026-06-28',
    horaInicio: '20:00', horaFim: '02:00', tipo: 'Show', tipoEvento: 'Audiovisual',
    status: 'confirmado', valor: 15000, numeroPessoas: 350, capacidadeUtilizada: 400,
    faturamentoBruto: 15000, faturamentoLiquido: 12750, formaPagamento: 'Transferência',
    dataVencimentoSaldo: '2026-06-25', responsavel: 'Mariana Costa', telefoneContato: '(11) 99555-7777',
    decoracao: 'própria', observacoesTecnicas: 'Palco profissional 8x6m. Sistema de som de 60kW.', statusVistoria: 'não realizada',
    documentos: [
      { id: 'd16', nome: 'Contrato Show Jazz', tipo: 'contrato', dataUpload: '2026-05-15', tamanho: '267 KB' },
      { id: 'd17', nome: 'Rider Técnico', tipo: 'outro', dataUpload: '2026-05-16', tamanho: '512 KB' },
    ],
  },
  {
    id: '12', cliente: 'Colégio Norte', espaco: 'Complexo Jussara', data: '2026-05-29',
    horaInicio: '19:30', horaFim: '23:30', tipo: 'Formatura', tipoEvento: 'Corporativo',
    status: 'confirmado', valor: 19500, numeroPessoas: 500, capacidadeUtilizada: 600,
    faturamentoBruto: 19500, faturamentoLiquido: 16575, formaPagamento: 'Cheque',
    dataVencimentoSaldo: '2026-05-15', responsavel: 'Rafael Lima', telefoneContato: '(11) 3777-8888',
    decoracao: 'terceirizada', observacoesTecnicas: 'Mesa de honra para 20 pessoas. Telão duplo.', statusVistoria: 'pendente',
    documentos: [
      { id: 'd18', nome: 'Contrato Colégio Norte', tipo: 'contrato', dataUpload: '2026-03-10', tamanho: '298 KB' },
      { id: 'd19', nome: 'Comprovante Entrada', tipo: 'comprovante', dataUpload: '2026-04-28', tamanho: '51 KB' },
    ],
  },
]

export const pagamentos: Pagamento[] = [
  { id: 'p1', eventoId: '1', cliente: 'Família Silva', espaco: 'Usine', dataEvento: '2026-05-24', dataPagamento: '2026-05-10', valor: 9000, status: 'pago', metodoPagamento: 'Transferência', descricao: 'Entrada 50% - Casamento' },
  { id: 'p2', eventoId: '1', cliente: 'Família Silva', espaco: 'Usine', dataEvento: '2026-05-24', valor: 9000, status: 'pendente', descricao: 'Saldo 50% - Casamento' },
  { id: 'p3', eventoId: '2', cliente: 'TechCorp Ltda', espaco: 'Fabrique', dataEvento: '2026-05-27', dataPagamento: '2026-05-15', valor: 12500, status: 'pago', metodoPagamento: 'PIX', descricao: 'Pagamento integral - Congresso' },
  { id: 'p4', eventoId: '4', cliente: 'Associação XPTO', espaco: 'Complexo Jussara', dataEvento: '2026-06-03', valor: 11000, status: 'pendente', descricao: 'Entrada 50% - Formatura' },
  { id: 'p5', eventoId: '5', cliente: 'Carlos Mendes', espaco: 'Espaço Solon', dataEvento: '2026-06-07', valor: 4500, status: 'pendente', descricao: 'Pagamento integral - Workshop' },
  { id: 'p6', eventoId: '6', cliente: 'Família Oliveira', espaco: 'Usine', dataEvento: '2026-06-14', dataPagamento: '2026-05-05', valor: 10500, status: 'pago', metodoPagamento: 'Cheque', descricao: 'Entrada 50% - Casamento' },
  { id: 'p7', eventoId: '6', cliente: 'Família Oliveira', espaco: 'Usine', dataEvento: '2026-06-14', valor: 10500, status: 'pendente', descricao: 'Saldo 50% - Casamento' },
  { id: 'p8', eventoId: '10', cliente: 'Pedro Alves', espaco: 'Espaço Solon', dataEvento: '2026-05-25', valor: 6500, status: 'atrasado', descricao: 'Pagamento integral - Aniversário' },
  { id: 'p9', eventoId: '12', cliente: 'Colégio Norte', espaco: 'Complexo Jussara', dataEvento: '2026-05-29', dataPagamento: '2026-04-28', valor: 9750, status: 'pago', metodoPagamento: 'Transferência', descricao: 'Entrada 50% - Formatura' },
  { id: 'p10', eventoId: '12', cliente: 'Colégio Norte', espaco: 'Complexo Jussara', dataEvento: '2026-05-29', valor: 9750, status: 'atrasado', descricao: 'Saldo 50% - Formatura' },
  { id: 'p11', eventoId: '7', cliente: 'Instituto Educação', espaco: 'Fabrique', dataEvento: '2026-06-10', dataPagamento: '2026-05-20', valor: 9800, status: 'pago', metodoPagamento: 'PIX', descricao: 'Pagamento integral - Seminário' },
  { id: 'p12', eventoId: '9', cliente: 'Empresa Beta S.A.', espaco: 'Complexo Jussara', dataEvento: '2026-06-18', valor: 14000, status: 'pendente', descricao: 'Entrada 50% - Convenção' },
]

export const contratos: Contrato[] = [
  { id: 'c1', numeroContrato: 'EL-2026-001', cliente: 'Família Silva', cpfCnpj: '123.456.789-00', espaco: 'Usine', dataEvento: '2026-05-24', horaInicio: '14:00', horaFim: '22:00', valorTotal: 18000, valorEntrada: 9000, dataAssinatura: '2026-04-15', status: 'confirmado', tipo: 'Casamento', responsavel: 'Mariana Costa', observacoes: 'Decoração floral branca. Estacionamento reservado para 50 veículos. Acesso liberado a partir das 12h para montagem. Serviço de bar incluso no pacote.' },
  { id: 'c2', numeroContrato: 'EL-2026-002', cliente: 'TechCorp Ltda', cpfCnpj: '12.345.678/0001-90', espaco: 'Fabrique', dataEvento: '2026-05-27', horaInicio: '09:00', horaFim: '18:00', valorTotal: 12500, valorEntrada: 12500, dataAssinatura: '2026-04-20', status: 'confirmado', tipo: 'Congresso', responsavel: 'Rafael Lima', observacoes: '8 mesas redondas. Projetor duplo. Coffee break incluso. Wi-Fi corporativo solicitado.' },
  { id: 'c3', numeroContrato: 'EL-2026-003', cliente: 'Ana Rodrigues', cpfCnpj: '987.654.321-00', espaco: 'House Pacaembu', dataEvento: '2026-05-31', horaInicio: '16:00', horaFim: '23:00', valorTotal: 8200, valorEntrada: 0, dataAssinatura: '2026-05-01', status: 'tentativo', tipo: 'Aniversário', responsavel: 'Mariana Costa', observacoes: 'Aguardando confirmação do cardápio. Cliente solicitou área exclusiva para crianças.' },
  { id: 'c4', numeroContrato: 'EL-2026-004', cliente: 'Associação XPTO', cpfCnpj: '98.765.432/0001-10', espaco: 'Complexo Jussara', dataEvento: '2026-06-03', horaInicio: '19:00', horaFim: '00:00', valorTotal: 22000, valorEntrada: 0, dataAssinatura: '2026-05-08', status: 'confirmado', tipo: 'Formatura', responsavel: 'Rafael Lima', observacoes: 'Palco de 6x4m. Iluminação cênica inclusa. Buffet terceirizado aprovado pelo cliente.' },
  { id: 'c5', numeroContrato: 'EL-2026-005', cliente: 'Carlos Mendes', cpfCnpj: '456.789.123-00', espaco: 'Espaço Solon', dataEvento: '2026-06-07', horaInicio: '11:00', horaFim: '17:00', valorTotal: 4500, valorEntrada: 0, dataAssinatura: '2026-05-12', status: 'confirmado', tipo: 'Workshop', responsavel: 'Juliana Pereira', observacoes: 'Capacidade de 40 pessoas. Precisam de flip chart e ar condicionado.' },
  { id: 'c6', numeroContrato: 'EL-2026-006', cliente: 'Família Oliveira', cpfCnpj: '321.654.987-00', espaco: 'Usine', dataEvento: '2026-06-14', horaInicio: '15:00', horaFim: '23:00', valorTotal: 21000, valorEntrada: 10500, dataAssinatura: '2026-03-22', status: 'confirmado', tipo: 'Casamento', responsavel: 'Mariana Costa', observacoes: 'Sala de apoio para noivos. Entrada separada para fornecedores. Gerador de reserva solicitado.' },
  { id: 'c7', numeroContrato: 'EL-2026-007', cliente: 'Pedro Alves', cpfCnpj: '654.321.098-00', espaco: 'Espaço Solon', dataEvento: '2026-05-25', horaInicio: '14:00', horaFim: '20:00', valorTotal: 6500, valorEntrada: 0, dataAssinatura: '2026-05-03', status: 'confirmado', tipo: 'Aniversário', responsavel: 'Juliana Pereira', observacoes: 'Pagamento em atraso. Entrar em contato com cliente. DJ externo autorizado.' },
  { id: 'c8', numeroContrato: 'EL-2026-008', cliente: 'Colégio Norte', cpfCnpj: '11.222.333/0001-44', espaco: 'Complexo Jussara', dataEvento: '2026-05-29', horaInicio: '19:30', horaFim: '23:30', valorTotal: 19500, valorEntrada: 9750, dataAssinatura: '2026-03-10', status: 'confirmado', tipo: 'Formatura', responsavel: 'Rafael Lima', observacoes: 'Saldo em atraso. Segunda parcela vencida em 15/05. Aguardando retorno financeiro.' },
  { id: 'c9', numeroContrato: 'EL-2026-009', cliente: 'Empresa Beta S.A.', cpfCnpj: '55.666.777/0001-88', espaco: 'Complexo Jussara', dataEvento: '2026-06-18', horaInicio: '09:00', horaFim: '18:00', valorTotal: 28000, valorEntrada: 0, dataAssinatura: '2026-05-18', status: 'confirmado', tipo: 'Convenção', responsavel: 'Rafael Lima', observacoes: 'Evento para 300 pessoas. Tradução simultânea. Sala VIP separada para diretoria.' },
]

// Feature 1: Contas a Pagar
export const contasPagar: ContaPagar[] = [
  // Despesas Fixas — Usine
  { id: 'cp1', descricao: 'Aluguel Usine — Mai/2026', espaco: 'Usine', categoria: 'fixa', subcategoria: 'aluguel', valor: 8500, status: 'pago', dataVencimento: '2026-05-05', dataPagamento: '2026-05-04', fornecedor: 'Imobiliária Central' },
  { id: 'cp2', descricao: 'Energia Elétrica Usine — Mai/2026', espaco: 'Usine', categoria: 'fixa', subcategoria: 'energia', valor: 1240, status: 'pago', dataVencimento: '2026-05-15', dataPagamento: '2026-05-14', fornecedor: 'ENEL SP' },
  { id: 'cp3', descricao: 'Internet Usine — Mai/2026', espaco: 'Usine', categoria: 'fixa', subcategoria: 'internet', valor: 320, status: 'pago', dataVencimento: '2026-05-10', dataPagamento: '2026-05-10', fornecedor: 'Vivo Empresas' },
  { id: 'cp4', descricao: 'Aluguel Usine — Jun/2026', espaco: 'Usine', categoria: 'fixa', subcategoria: 'aluguel', valor: 8500, status: 'pendente', dataVencimento: '2026-06-05', fornecedor: 'Imobiliária Central' },
  { id: 'cp5', descricao: 'Energia Elétrica Usine — Jun/2026', espaco: 'Usine', categoria: 'fixa', subcategoria: 'energia', valor: 1180, status: 'pendente', dataVencimento: '2026-06-15', fornecedor: 'ENEL SP' },
  // Despesas Fixas — Fabrique
  { id: 'cp6', descricao: 'Aluguel Fabrique — Mai/2026', espaco: 'Fabrique', categoria: 'fixa', subcategoria: 'aluguel', valor: 6200, status: 'pago', dataVencimento: '2026-05-05', dataPagamento: '2026-05-03', fornecedor: 'Imobiliária Central' },
  { id: 'cp7', descricao: 'Energia Elétrica Fabrique — Mai/2026', espaco: 'Fabrique', categoria: 'fixa', subcategoria: 'energia', valor: 890, status: 'pago', dataVencimento: '2026-05-15', dataPagamento: '2026-05-15', fornecedor: 'ENEL SP' },
  { id: 'cp8', descricao: 'Internet Fabrique — Mai/2026', espaco: 'Fabrique', categoria: 'fixa', subcategoria: 'internet', valor: 280, status: 'pago', dataVencimento: '2026-05-10', dataPagamento: '2026-05-09', fornecedor: 'Claro Empresas' },
  { id: 'cp9', descricao: 'Aluguel Fabrique — Jun/2026', espaco: 'Fabrique', categoria: 'fixa', subcategoria: 'aluguel', valor: 6200, status: 'pendente', dataVencimento: '2026-06-05', fornecedor: 'Imobiliária Central' },
  // Despesas Fixas — House Pacaembu
  { id: 'cp10', descricao: 'Aluguel House Pacaembu — Mai/2026', espaco: 'House Pacaembu', categoria: 'fixa', subcategoria: 'aluguel', valor: 4800, status: 'pago', dataVencimento: '2026-05-05', dataPagamento: '2026-05-05', fornecedor: 'Imobiliária Central' },
  { id: 'cp11', descricao: 'Energia Elétrica House Pacaembu — Mai/2026', espaco: 'House Pacaembu', categoria: 'fixa', subcategoria: 'energia', valor: 620, status: 'atrasado', dataVencimento: '2026-05-10', fornecedor: 'ENEL SP' },
  // Despesas Fixas — Complexo Jussara
  { id: 'cp12', descricao: 'Aluguel Complexo Jussara — Mai/2026', espaco: 'Complexo Jussara', categoria: 'fixa', subcategoria: 'aluguel', valor: 12000, status: 'pago', dataVencimento: '2026-05-05', dataPagamento: '2026-05-02', fornecedor: 'Imobiliária JK Patrimonial' },
  { id: 'cp13', descricao: 'Energia Elétrica Complexo Jussara — Mai/2026', espaco: 'Complexo Jussara', categoria: 'fixa', subcategoria: 'energia', valor: 2100, status: 'pago', dataVencimento: '2026-05-15', dataPagamento: '2026-05-15', fornecedor: 'ENEL SP' },
  { id: 'cp14', descricao: 'Internet Complexo Jussara — Mai/2026', espaco: 'Complexo Jussara', categoria: 'fixa', subcategoria: 'internet', valor: 450, status: 'pago', dataVencimento: '2026-05-10', dataPagamento: '2026-05-10', fornecedor: 'Vivo Empresas' },
  { id: 'cp15', descricao: 'Aluguel Complexo Jussara — Jun/2026', espaco: 'Complexo Jussara', categoria: 'fixa', subcategoria: 'aluguel', valor: 12000, status: 'pendente', dataVencimento: '2026-06-05', fornecedor: 'Imobiliária JK Patrimonial' },
  // Despesas Fixas — Espaço Solon
  { id: 'cp16', descricao: 'Aluguel Espaço Solon — Mai/2026', espaco: 'Espaço Solon', categoria: 'fixa', subcategoria: 'aluguel', valor: 2800, status: 'pago', dataVencimento: '2026-05-05', dataPagamento: '2026-05-04', fornecedor: 'Imobiliária Central' },
  { id: 'cp17', descricao: 'Energia Elétrica Espaço Solon — Mai/2026', espaco: 'Espaço Solon', categoria: 'fixa', subcategoria: 'energia', valor: 380, status: 'pago', dataVencimento: '2026-05-15', dataPagamento: '2026-05-13', fornecedor: 'ENEL SP' },
  // Funcionários (Todos os espaços)
  { id: 'cp18', descricao: 'Folha de Pagamento — Mai/2026', espaco: 'Todos', categoria: 'fixa', subcategoria: 'funcionários', valor: 18500, status: 'pago', dataVencimento: '2026-05-30', dataPagamento: '2026-05-30', fornecedor: 'Equipe Interna' },
  { id: 'cp19', descricao: 'Folha de Pagamento — Jun/2026', espaco: 'Todos', categoria: 'fixa', subcategoria: 'funcionários', valor: 18500, status: 'pendente', dataVencimento: '2026-06-30', fornecedor: 'Equipe Interna' },
  // Despesas Variáveis — Manutenção
  { id: 'cp20', descricao: 'Manutenção Sistema de Ar — Usine', espaco: 'Usine', categoria: 'variavel', subcategoria: 'manutenção', valor: 1800, status: 'pago', dataVencimento: '2026-05-20', dataPagamento: '2026-05-18', fornecedor: 'Clima Tech Serviços' },
  { id: 'cp21', descricao: 'Reparo Elétrico — Fabrique', espaco: 'Fabrique', categoria: 'variavel', subcategoria: 'manutenção', valor: 650, status: 'pago', dataVencimento: '2026-05-12', dataPagamento: '2026-05-12', fornecedor: 'Eletro Silva' },
  { id: 'cp22', descricao: 'Pintura Externa — House Pacaembu', espaco: 'House Pacaembu', categoria: 'variavel', subcategoria: 'manutenção', valor: 3200, status: 'pendente', dataVencimento: '2026-06-10', fornecedor: 'Pinturas São Paulo' },
  { id: 'cp23', descricao: 'Manutenção Sonorização — Complexo Jussara', espaco: 'Complexo Jussara', categoria: 'variavel', subcategoria: 'manutenção', valor: 2400, status: 'atrasado', dataVencimento: '2026-05-08', fornecedor: 'SomPro Equipamentos' },
  // Despesas Variáveis — Fornecedores
  { id: 'cp24', descricao: 'Fornecedor Limpeza — Mai/2026', espaco: 'Todos', categoria: 'variavel', subcategoria: 'fornecedores', valor: 4200, status: 'pago', dataVencimento: '2026-05-31', dataPagamento: '2026-05-31', fornecedor: 'Clean Master Ltda' },
  { id: 'cp25', descricao: 'Fornecedor Segurança — Mai/2026', espaco: 'Todos', categoria: 'variavel', subcategoria: 'fornecedores', valor: 5600, status: 'pago', dataVencimento: '2026-05-31', dataPagamento: '2026-05-30', fornecedor: 'Segurança Total' },
  { id: 'cp26', descricao: 'Fornecedor Limpeza — Jun/2026', espaco: 'Todos', categoria: 'variavel', subcategoria: 'fornecedores', valor: 4200, status: 'pendente', dataVencimento: '2026-06-30', fornecedor: 'Clean Master Ltda' },
  // Despesas Variáveis — Extras
  { id: 'cp27', descricao: 'Material de Escritório — Mai/2026', espaco: 'Todos', categoria: 'variavel', subcategoria: 'extras', valor: 380, status: 'pago', dataVencimento: '2026-05-20', dataPagamento: '2026-05-19', fornecedor: 'Papelaria Office' },
  { id: 'cp28', descricao: 'Licença Software Gestão', espaco: 'Todos', categoria: 'variavel', subcategoria: 'extras', valor: 290, status: 'pendente', dataVencimento: '2026-06-01', fornecedor: 'SaaS Corp' },
]

// Feature 2: Usuários do sistema
export const usuarios: Usuario[] = [
  {
    id: 'u1', nome: 'Administrador', email: 'admin@espacoslocacoes.com.br', senha: 'admin123',
    role: 'admin', ativo: true, createdAt: '2025-01-01', ultimoAcesso: '2026-05-25',
  },
  {
    id: 'u2', nome: 'Mariana Costa', email: 'mariana@espacoslocacoes.com.br', senha: 'mariana123',
    role: 'operacional', ativo: true, createdAt: '2025-03-15', ultimoAcesso: '2026-05-24',
  },
  {
    id: 'u3', nome: 'Rafael Lima', email: 'rafael@espacoslocacoes.com.br', senha: 'rafael123',
    role: 'operacional', ativo: true, createdAt: '2025-03-15', ultimoAcesso: '2026-05-23',
  },
  {
    id: 'u4', nome: 'Juliana Pereira', email: 'juliana@espacoslocacoes.com.br', senha: 'juliana123',
    role: 'operacional', ativo: true, createdAt: '2025-06-01', ultimoAcesso: '2026-05-22',
  },
  {
    id: 'u5', nome: 'Carlos Financeiro', email: 'financeiro@espacoslocacoes.com.br', senha: 'fin123',
    role: 'financeiro', ativo: true, createdAt: '2025-08-10', ultimoAcesso: '2026-05-20',
  },
  {
    id: 'u6', nome: 'Visitante Demo', email: 'visitante@espacoslocacoes.com.br', senha: 'vis123',
    role: 'visualizador', ativo: true, createdAt: '2026-01-20', ultimoAcesso: '2026-03-10',
  },
]
