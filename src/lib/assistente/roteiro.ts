// Roteiro do atendimento: primeiro coleta (as 5 perguntas da mensagem padrão
// da E&L), depois orçamento e serviços extras. Serve hoje para a equipe e, no
// futuro, para o assistente falar direto com o cliente.

import type { DadosEvento } from './orcamento'

// Mensagem padrão que a equipe já usa no primeiro contato.
export function mensagemInicial(nomeAtendente?: string): string {
  // Nome de login (ex.: "drciliano") não vai para o cliente: só nome de pessoa,
  // cadastrado com inicial maiúscula em Usuários.
  const primeiro = (nomeAtendente ?? '').trim().split(/\s+/)[0] ?? ''
  const nome = /^\p{Lu}\p{Ll}+$/u.test(primeiro) ? primeiro : ''
  return `Olá! ${nome ? `Meu nome é ${nome}, da Espaços & Locações, muito prazer.` : 'Aqui é da Espaços & Locações, muito prazer!'}

Por favor, responda às perguntas abaixo para ser atendido.

1. Qual é o seu nome completo?
2. Qual a data do seu evento?
3. Seu evento é para quantas pessoas?
4. Qual o tipo de evento?
5. Qual espaço você tem interesse?

Opções de espaços disponíveis:

🔹 House Pacaembu
• Capacidade: até 250 pessoas
• Endereço: Rua Alagoas, 836 – Higienópolis

🔹 Espaço Fabrique
• Capacidade: até 800 pessoas
• Endereço: Rua Barra Funda, 1071 – Barra Funda

🔹 Espaço Usine
• Capacidade: até 1.500 pessoas
• Endereço: Rua Barra Funda, 973 – Barra Funda

🔹 Armazém Solon
• Capacidade: até 1.500 pessoas
• Endereço: Rua Solon, 1121 – Bom Retiro

🔹 Complexo Jussara
• Capacidade para até 2.500 pessoas
• Jussara Club para até 100 pessoas
• Galeria Jussara para até 300 pessoas
• Palacete Jussara para até 800 pessoas
• Cine Jussara para até 1.500 pessoas
• Endereço: Rua Dom José de Barros, 306 – República

Fico no aguardo das informações para enviar mais detalhes 😊`
}

export interface ItemQuestionario { chave: string; pergunta: string; resposta?: string }

export function questionario(d: DadosEvento, espacoNome?: string): ItemQuestionario[] {
  const nome = d.cliente.trim()
  return [
    { chave: 'nome', pergunta: 'Nome completo', resposta: nome.includes(' ') ? nome : undefined },
    { chave: 'data', pergunta: 'Data do evento', resposta: d.data ? d.data.split('-').reverse().join('/') : undefined },
    { chave: 'pessoas', pergunta: 'Número de pessoas', resposta: d.convidados ? String(d.convidados) : undefined },
    { chave: 'tipo', pergunta: 'Tipo de evento', resposta: d.tipoEvento.trim() || undefined },
    { chave: 'espaco', pergunta: 'Espaço de interesse', resposta: espacoNome },
  ]
}
