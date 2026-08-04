// Biblioteca de Contratos — modelos por tipo de minuta (não mais travados por espaço)

export type TipoMinuta = 'locacao' | 'parceria'

export interface ModeloContrato {
  id: string
  nome: string
  tipoMinuta: TipoMinuta
  texto: string
  variaveis: string[]
}

const VARIAVEIS_COMUNS = [
  'CEDENTE_NOME', 'CEDENTE_CNPJ', 'CEDENTE_ENDERECO',
  'CEDENTE_RESPONSAVEL', 'CEDENTE_RESPONSAVEL_RG', 'CEDENTE_RESPONSAVEL_CPF',
  'CESSIONARIA_NOME', 'CESSIONARIA_CNPJ_CPF', 'CESSIONARIA_ENDERECO', 'CESSIONARIA_EMAIL',
  'DATA_EVENTO', 'HORA_INICIO_MONTAGEM', 'HORA_INICIO_EVENTO', 'HORA_TERMINO_EVENTO',
  'DATA_ASSINATURA',
]

export const MODELO_LOCACAO: ModeloContrato = {
  id: 'modelo-locacao',
  nome: 'Locação — valor fixo',
  tipoMinuta: 'locacao',
  variaveis: [
    ...VARIAVEIS_COMUNS,
    'VALOR_NEGOCIADO', 'VALOR_EXTENSO', 'FORMA_PAGAMENTO', 'DATA_PAGAMENTO',
    'OBSERVACAO_NEGOCIACAO',
  ],
  texto: `CONTRATO DE LOCAÇÃO DE ESPAÇO

LOCADORA: {{CEDENTE_NOME}}, CNPJ {{CEDENTE_CNPJ}}, com sede em {{CEDENTE_ENDERECO}}, neste ato representada por {{CEDENTE_RESPONSAVEL}}, RG {{CEDENTE_RESPONSAVEL_RG}}, CPF {{CEDENTE_RESPONSAVEL_CPF}}.

LOCATÁRIA: {{CESSIONARIA_NOME}}, inscrita no CPF/CNPJ sob o nº {{CESSIONARIA_CNPJ_CPF}}, com endereço em {{CESSIONARIA_ENDERECO}}, e-mail de contato {{CESSIONARIA_EMAIL}}.

As partes acima identificadas celebram o presente CONTRATO DE LOCAÇÃO, mediante as cláusulas a seguir:

CLÁUSULA 1ª — DO OBJETO
O presente contrato tem por objeto a locação do espaço para realização de evento na data de {{DATA_EVENTO}}, com montagem a partir de {{HORA_INICIO_MONTAGEM}}, início do evento às {{HORA_INICIO_EVENTO}} e término às {{HORA_TERMINO_EVENTO}}.

CLÁUSULA 2ª — DO VALOR E FORMA DE PAGAMENTO
O valor total negociado da locação é de {{VALOR_NEGOCIADO}} ({{VALOR_EXTENSO}}), a ser pago via {{FORMA_PAGAMENTO}}, com vencimento em {{DATA_PAGAMENTO}}.

CLÁUSULA 3ª — DAS CONDIÇÕES NEGOCIADAS
{{OBSERVACAO_NEGOCIACAO}}

CLÁUSULA 4ª — DAS OBRIGAÇÕES GERAIS
As partes obrigam-se a cumprir as normas de uso do espaço, segurança, e legislação aplicável a eventos.

E por estarem assim justas e contratadas, firmam o presente instrumento em {{DATA_ASSINATURA}}.`,
}

export const MODELO_PARCERIA: ModeloContrato = {
  id: 'modelo-parceria',
  nome: 'Parceria — porcentagem sobre faturamento',
  tipoMinuta: 'parceria',
  variaveis: [
    ...VARIAVEIS_COMUNS,
    'PERCENTUAL_CESSIONARIA', 'PERCENTUAL_CEDENTE', 'VALOR_MINIMO', 'VALOR_NEGOCIADO',
    'OBSERVACAO_NEGOCIACAO', 'OBSERVACAO_PARCERIA',
  ],
  texto: `CONTRATO DE PARCERIA PARA CESSÃO DE ESPAÇO

CEDENTE: {{CEDENTE_NOME}}, CNPJ {{CEDENTE_CNPJ}}, com sede em {{CEDENTE_ENDERECO}}, neste ato representada por {{CEDENTE_RESPONSAVEL}}, RG {{CEDENTE_RESPONSAVEL_RG}}, CPF {{CEDENTE_RESPONSAVEL_CPF}}.

CESSIONÁRIA: {{CESSIONARIA_NOME}}, inscrita no CPF/CNPJ sob o nº {{CESSIONARIA_CNPJ_CPF}}, com endereço em {{CESSIONARIA_ENDERECO}}, e-mail de contato {{CESSIONARIA_EMAIL}}.

As partes acima identificadas celebram o presente CONTRATO DE PARCERIA para cessão de uso do espaço, mediante as cláusulas a seguir:

CLÁUSULA 1ª — DO OBJETO
O presente contrato tem por objeto a cessão de uso do espaço para realização de evento na data de {{DATA_EVENTO}}, com montagem a partir de {{HORA_INICIO_MONTAGEM}}, início do evento às {{HORA_INICIO_EVENTO}} e término às {{HORA_TERMINO_EVENTO}}.

CLÁUSULA 2ª — DA REMUNERAÇÃO
A remuneração da presente parceria se dará em regime de porcentagem sobre o faturamento bruto do evento, cabendo {{PERCENTUAL_CESSIONARIA}}% à CESSIONÁRIA e {{PERCENTUAL_CEDENTE}}% à CEDENTE, respeitado o valor mínimo garantido de {{VALOR_MINIMO}}. Valor negociado de referência: {{VALOR_NEGOCIADO}}.

CLÁUSULA 3ª — DA PARCERIA
{{OBSERVACAO_PARCERIA}}

CLÁUSULA 4ª — DAS CONDIÇÕES NEGOCIADAS
{{OBSERVACAO_NEGOCIACAO}}

CLÁUSULA 5ª — DAS OBRIGAÇÕES GERAIS
As partes obrigam-se a cumprir as normas de uso do espaço, segurança, e legislação aplicável a eventos.

E por estarem assim justas e contratadas, firmam o presente instrumento em {{DATA_ASSINATURA}}.`,
}

export const MODELOS_CONTRATO: ModeloContrato[] = [MODELO_LOCACAO, MODELO_PARCERIA]

export function getModeloPorTipo(tipoMinuta: TipoMinuta): ModeloContrato {
  return MODELOS_CONTRATO.find(m => m.tipoMinuta === tipoMinuta) ?? MODELO_LOCACAO
}
