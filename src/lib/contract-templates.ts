// Biblioteca de Contratos — modelos pré-cadastrados

export interface ModeloContrato {
  id: string
  nome: string
  espaco: string
  tipo: string
  texto: string
  variaveis: string[]
}

export const MODELO_USINE: ModeloContrato = {
  id: 'modelo-usine',
  nome: 'Usine — Parceria/Porcentagem',
  espaco: 'Usine',
  tipo: 'Parceria',
  variaveis: [
    'CESSIONARIA_NOME', 'CESSIONARIA_CNPJ_CPF', 'CESSIONARIA_ENDERECO', 'CESSIONARIA_EMAIL',
    'DATA_EVENTO', 'HORA_INICIO_MONTAGEM', 'HORA_INICIO_EVENTO', 'HORA_TERMINO_EVENTO',
    'PERCENTUAL_CESSIONARIA', 'PERCENTUAL_CEDENTE', 'VALOR_MINIMO', 'DATA_ASSINATURA',
  ],
  texto: `CONTRATO DE PARCERIA PARA CESSÃO DE ESPAÇO — USINE

CEDENTE: Razão social vinculada ao espaço Usine, CNPJ 55.446.240/0001-06, com sede na Rua Barra Funda, 973, CEP 01152-000, Barra Funda, São Paulo/SP, neste ato representada por Camilo Razuk, RG 46.014.498 SSP/SP, CPF 383.576.188-98.

CESSIONÁRIA: {{CESSIONARIA_NOME}}, inscrita no CPF/CNPJ sob o nº {{CESSIONARIA_CNPJ_CPF}}, com endereço em {{CESSIONARIA_ENDERECO}}, e-mail de contato {{CESSIONARIA_EMAIL}}.

As partes acima identificadas celebram o presente CONTRATO DE PARCERIA para cessão de uso do espaço Usine, mediante as cláusulas a seguir:

CLÁUSULA 1ª — DO OBJETO
O presente contrato tem por objeto a cessão de uso do espaço Usine para realização de evento na data de {{DATA_EVENTO}}, com montagem a partir de {{HORA_INICIO_MONTAGEM}}, início do evento às {{HORA_INICIO_EVENTO}} e término às {{HORA_TERMINO_EVENTO}}.

CLÁUSULA 2ª — DA REMUNERAÇÃO
A remuneração da presente parceria se dará em regime de porcentagem sobre o faturamento bruto do evento, cabendo {{PERCENTUAL_CESSIONARIA}}% à CESSIONÁRIA e {{PERCENTUAL_CEDENTE}}% à CEDENTE, respeitado o valor mínimo garantido de {{VALOR_MINIMO}}.

CLÁUSULA 3ª — DAS OBRIGAÇÕES GERAIS
As partes obrigam-se a cumprir as normas de uso do espaço, segurança, e legislação aplicável a eventos.

E por estarem assim justas e contratadas, firmam o presente instrumento em {{DATA_ASSINATURA}}.`,
}

export const MODELO_FABRIQUE: ModeloContrato = {
  id: 'modelo-fabrique',
  nome: 'Fabrique — Aluguel fixo',
  espaco: 'Fabrique',
  tipo: 'Aluguel',
  variaveis: [
    'CESSIONARIA_NOME', 'CESSIONARIA_CNPJ_CPF', 'CESSIONARIA_ENDERECO', 'CESSIONARIA_EMAIL',
    'DATA_EVENTO', 'HORA_INICIO_MONTAGEM', 'HORA_INICIO_EVENTO', 'HORA_TERMINO_EVENTO',
    'VALOR_TOTAL', 'VALOR_EXTENSO', 'FORMA_PAGAMENTO', 'DATA_PAGAMENTO', 'DATA_ASSINATURA',
  ],
  texto: `CONTRATO DE LOCAÇÃO DE ESPAÇO — FABRIQUE

LOCADORA: Razão social vinculada ao espaço Fabrique, CNPJ 27.514.202/0001-08, com sede na Rua Barra Funda, 1.071, CEP 01152-000, Barra Funda, São Paulo/SP, neste ato representada por Camilo Razuk, RG 46.014.498 SSP/SP, CPF 383.576.188-98.

LOCATÁRIA: {{CESSIONARIA_NOME}}, inscrita no CPF/CNPJ sob o nº {{CESSIONARIA_CNPJ_CPF}}, com endereço em {{CESSIONARIA_ENDERECO}}, e-mail de contato {{CESSIONARIA_EMAIL}}.

As partes acima identificadas celebram o presente CONTRATO DE LOCAÇÃO do espaço Fabrique, mediante as cláusulas a seguir:

CLÁUSULA 1ª — DO OBJETO
O presente contrato tem por objeto a locação do espaço Fabrique para realização de evento na data de {{DATA_EVENTO}}, com montagem a partir de {{HORA_INICIO_MONTAGEM}}, início do evento às {{HORA_INICIO_EVENTO}} e término às {{HORA_TERMINO_EVENTO}}.

CLÁUSULA 2ª — DO VALOR E FORMA DE PAGAMENTO
O valor total da locação é de {{VALOR_TOTAL}} ({{VALOR_EXTENSO}}), a ser pago via {{FORMA_PAGAMENTO}}, com vencimento em {{DATA_PAGAMENTO}}.

CLÁUSULA 3ª — DAS OBRIGAÇÕES GERAIS
As partes obrigam-se a cumprir as normas de uso do espaço, segurança, e legislação aplicável a eventos.

E por estarem assim justas e contratadas, firmam o presente instrumento em {{DATA_ASSINATURA}}.`,
}

export const MODELOS_CONTRATO: ModeloContrato[] = [MODELO_USINE, MODELO_FABRIQUE]

export function getModeloPorEspaco(espaco: string): ModeloContrato | null {
  return MODELOS_CONTRATO.find(m => m.espaco.toLowerCase() === espaco.toLowerCase()) ?? null
}
