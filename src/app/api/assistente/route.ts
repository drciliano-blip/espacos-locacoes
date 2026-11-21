import { NextResponse } from 'next/server'

// A IA pode levar mais de 10 s (várias consultas seguidas): sem isto a conexão cai ("Load failed").
export const maxDuration = 60
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { canAccess } from '@/lib/auth'
import type { NivelAcesso } from '@/types'

// Assistente de IA — etapa 1 (copiloto da equipe). Duas ações:
//  - extrair:  lê a mensagem do cliente e devolve os dados do evento;
//  - resposta: escreve a mensagem de WhatsApp a partir do orçamento já
//              montado e calculado pelo sistema (a IA não inventa preço).
// Nada é enviado ao cliente daqui: a equipe revisa e envia.

const MODEL = 'claude-opus-5-5'

const SISTEMA_EXTRAIR = `Você é o assistente de atendimento da Espaços & Locações, empresa de São Paulo que aluga espaços para eventos (Fabrique, Usine, House Pacaembu, Armazém Solon, CESA) e oferece serviços para o evento (buffet Experiência Churrasco e parceiros: decoração, foto e vídeo, som, luz, LED, mobiliário, produção).

Leia a conversa com um cliente (WhatsApp, e-mail ou formulário do site; pode ter várias mensagens, em ordem) e extraia os dados do evento.
Regras:
- Vale sempre a informação mais recente da conversa (ex.: o cliente mudou a data ou o número de convidados).
- Em <dados_atuais> vêm os dados que a equipe já preencheu. Repita-os quando a conversa não trouxer nada mais novo sobre aquele campo.
- Use null quando a informação não estiver na mensagem. Não invente.
- dataEvento no formato AAAA-MM-DD. Se o cliente não disser o ano, use a próxima ocorrência da data a partir de hoje.
- espacoDesejado: um destes slugs, só se o cliente citar o espaço: fabrique, usine, house-pacaembu, espaco-solon, cesa. Se o cliente pedir o Complexo Jussara, deixe null e registre em observacoes que o Jussara é atendido pessoalmente pela direção.
- servicosPedidos: serviços que o cliente pediu ou perguntou (ex.: "buffet", "bebidas", "decoração", "DJ"), em português curto.
- faltaPerguntar: o que falta para fechar o orçamento (ex.: data, número de convidados, horário, tipo de evento), no máximo 4 itens.`

const SCHEMA_EXTRAIR = {
  type: 'object',
  additionalProperties: false,
  required: ['cliente', 'empresa', 'telefone', 'email', 'tipoEvento', 'dataEvento', 'convidados', 'duracaoHoras', 'vesperaOuFeriado', 'espacoDesejado', 'servicosPedidos', 'observacoes', 'faltaPerguntar'],
  properties: {
    cliente: { type: ['string', 'null'] },
    empresa: { type: ['string', 'null'] },
    telefone: { type: ['string', 'null'] },
    email: { type: ['string', 'null'] },
    tipoEvento: { type: ['string', 'null'], description: 'Ex.: festa de fim de ano, casamento, formatura, show, congresso' },
    dataEvento: { type: ['string', 'null'], description: 'AAAA-MM-DD' },
    convidados: { type: ['integer', 'null'] },
    duracaoHoras: { type: ['number', 'null'] },
    vesperaOuFeriado: { type: 'string', enum: ['normal', 'vespera', 'feriado'], description: 'A data cai em véspera de feriado ou feriado nacional/SP?' },
    espacoDesejado: { type: ['string', 'null'] },
    servicosPedidos: { type: 'array', items: { type: 'string' } },
    observacoes: { type: ['string', 'null'], description: 'Outras informações úteis (orçamento do cliente, restrições, horário)' },
    faltaPerguntar: { type: 'array', items: { type: 'string' } },
  },
} as const

const SISTEMA_RESPOSTA = `Você é o assistente de atendimento da Espaços & Locações (São Paulo). Escreva a resposta que a equipe vai enviar ao cliente pelo WhatsApp, junto com dois PDFs: o Orçamento de Locação (espaço, com staff da casa e rider técnico inclusos) e o Orçamento de Serviços (buffet e parceiros).

O contexto diz a etapa do atendimento:
- etapa "coleta": ainda falta parte do questionário inicial (nome completo, data, número de pessoas, tipo de evento, espaço). NÃO mande valores. Agradeça, confirme em uma linha o que já entendeu e peça só o que falta, em lista numerada. Se houver espaços livres que comportam o público, sugira esses espaços (nome e capacidade). Na coleta, upsell fica vazio.
- etapa "orcamento": todas as respostas chegaram. Mande o orçamento (regras abaixo) e, depois da locação, ofereça os serviços extras (buffet, decoração, foto e vídeo etc.) de forma natural, sem pressionar.

Regras:
- Português do Brasil, tom cordial e direto, como uma pessoa da equipe. Sem exageros nem emojis em excesso (no máximo 1 ou 2).
- O contexto traz a conversa até agora: responda à última mensagem do cliente, sem repetir o que a equipe já disse.
- Use SÓ os valores e datas do contexto. Nunca invente preço, desconto, disponibilidade ou condição.
- Não confirme a reserva: diga que a data fica pré-reservada por 72 h após o aceite e o sinal, sujeita a confirmação da equipe.
- No orçamento: cite o total da locação e o total dos serviços separadamente e diga que os detalhes estão nos PDFs.
- Se faltar informação, faça no máximo 2 perguntas no fim.
- Se o espaço escolhido estiver ocupado ou não comportar o público, não ofereça ele: ofereça as alternativas livres do contexto.
- Se a contratação for parceria, diga que a venda de ingressos é pela FASTIX, ticketeira oficial, e que o pagamento segue a condição FASTIX (25% na reserva e 75% até 8 dias antes).
- Mensagem com no máximo 12 linhas.

Também sugira até 3 serviços extras (upsell) que combinem com o tipo e o tamanho do evento e que ainda não estejam no orçamento, escolhendo do catálogo do contexto quando houver. E liste alertas para a equipe (ex.: data em dezembro com acréscimo, exigência de gerador, segurança para grandes públicos, informação que falta).`

const SCHEMA_RESPOSTA = {
  type: 'object',
  additionalProperties: false,
  required: ['mensagem', 'upsell', 'alertas'],
  properties: {
    mensagem: { type: 'string' },
    upsell: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['servico', 'motivo'],
        properties: { servico: { type: 'string' }, motivo: { type: 'string' } },
      },
    },
    alertas: { type: 'array', items: { type: 'string' } },
  },
} as const

async function chamarIA(client: Anthropic, sistema: string, conteudo: string, schema: Record<string, unknown>, effort: 'low' | 'medium') {
  const msg = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 4096,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: [{ model: 'claude-opus-4-8' }],
    system: [{ type: 'text', text: sistema, cache_control: { type: 'ephemeral' } }],
    output_config: { effort, format: { type: 'json_schema', schema } },
    messages: [{ role: 'user', content: conteudo }],
  })
  if (msg.stop_reason === 'refusal') throw new Error('A IA recusou esta mensagem. Faça este atendimento manualmente.')
  if (msg.stop_reason === 'max_tokens') throw new Error('A resposta da IA veio incompleta. Tente de novo.')
  const texto = msg.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')?.text ?? '{}'
  return JSON.parse(texto)
}

export async function POST(request: Request) {
  // Página liberada só para quem tem a aba (admin e operacional).
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!perfil || !canAccess(perfil.role as NivelAcesso, 'assistente')) {
    return NextResponse.json({ error: 'Sem permissão para o Assistente de IA.' }, { status: 403 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada no servidor.' }, { status: 500 })

  let body: { acao?: string; texto?: string; dadosAtuais?: unknown; contexto?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })
  }

  const client = new Anthropic({ apiKey })
  const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })

  try {
    if (body.acao === 'extrair') {
      const texto = (body.texto ?? '').trim()
      if (!texto) return NextResponse.json({ error: 'Cole a mensagem do cliente.' }, { status: 400 })
      if (texto.length > 60000) return NextResponse.json({ error: 'Conversa muito longa: cole só a parte com o pedido.' }, { status: 400 })
      const atuais = body.dadosAtuais ? `\n\n<dados_atuais>\n${JSON.stringify(body.dadosAtuais)}\n</dados_atuais>` : ''
      const dados = await chamarIA(client, SISTEMA_EXTRAIR, `Hoje é ${hoje}.${atuais}\n\n<conversa_com_o_cliente>\n${texto}\n</conversa_com_o_cliente>`, SCHEMA_EXTRAIR, 'low')
      return NextResponse.json(dados)
    }
    if (body.acao === 'resposta') {
      if (!body.contexto) return NextResponse.json({ error: 'Monte o orçamento antes de gerar a resposta.' }, { status: 400 })
      const dados = await chamarIA(client, SISTEMA_RESPOSTA, `Hoje é ${hoje}.\n\n<contexto>\n${JSON.stringify(body.contexto, null, 2)}\n</contexto>`, SCHEMA_RESPOSTA, 'medium')
      return NextResponse.json(dados)
    }
    return NextResponse.json({ error: 'Ação desconhecida.' }, { status: 400 })
  } catch (err) {
    console.error('[assistente/orcamento]', err)
    if (err instanceof Anthropic.RateLimitError) return NextResponse.json({ error: 'Muitas consultas à IA agora. Tente em 1 minuto.' }, { status: 429 })
    if (err instanceof Anthropic.APIError) return NextResponse.json({ error: `Erro da IA (${err.status}): ${err.message}` }, { status: 502 })
    const message = err instanceof Error ? err.message : 'Erro desconhecido ao consultar a IA.'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
