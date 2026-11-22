import Anthropic from '@anthropic-ai/sdk'

// Peças comuns aos chats do assistente (Consultas e Atendimento):
//  - a resposta aparece palavra por palavra (streaming), com o passo atual
//    ("Consultando a agenda...") enquanto a IA usa as ferramentas;
//  - o nível de raciocínio sobe nas perguntas jurídicas e financeiras;
//  - busca na internet, para o que não está no sistema nem nas bases.

export type EventoAoVivo =
  | { t: 'texto'; v: string } // pedaço da resposta
  | { t: 'etapa'; v: string } // o que a IA está fazendo agora
  | { t: 'volta' } // nova rodada: o texto anterior era só preâmbulo
export type Emitir = (ev: EventoAoVivo) => void

// Resposta em linhas JSON (uma por evento) que começa na hora. Linha vazia a
// cada 5 s mantém a conexão viva no iPhone; a última linha é {t:'fim', dados}.
// Erros vão em dados.error (status sempre 200, a resposta já começou).
export function respostaAoVivo(trabalho: (emitir: Emitir) => Promise<unknown>): Response {
  const enc = new TextEncoder()
  const corpo = new ReadableStream<Uint8Array>({
    async start(ctrl) {
      let fechado = false
      const enviar = (s: string) => { if (!fechado) try { ctrl.enqueue(enc.encode(s)) } catch { /* fechado */ } }
      const pulso = setInterval(() => enviar('\n'), 5000)
      enviar('\n')
      let dados: unknown
      try {
        dados = await trabalho(ev => enviar(JSON.stringify(ev) + '\n'))
      } catch (e) {
        console.error('[assistente]', e)
        dados = { error: e instanceof Error ? e.message : 'Erro no assistente.' }
      } finally {
        clearInterval(pulso)
      }
      enviar(JSON.stringify({ t: 'fim', dados }) + '\n')
      fechado = true
      ctrl.close()
    },
  })
  return new Response(corpo, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' } })
}

const ETAPAS: Record<string, string> = {
  consultar_agenda: 'Consultando a agenda',
  recebimentos: 'Conferindo os recebimentos',
  lancamentos_duplicados: 'Procurando lançamentos duplicados',
  conferir_mes: 'Conferindo o mês',
  atualizar_orcamento: 'Montando o orçamento',
  redigir_mensagem_cliente: 'Escrevendo a mensagem para o cliente',
  web_search: 'Pesquisando na internet',
}

type ParamsStream = Parameters<Anthropic['beta']['messages']['stream']>[0]

// Uma chamada à IA com streaming: repassa o texto e as etapas e devolve a
// mensagem completa (para o laço de ferramentas seguir como antes).
export async function chamarAoVivo(client: Anthropic, params: ParamsStream, emitir: Emitir) {
  emitir({ t: 'volta' })
  const stream = client.beta.messages.stream(params)
  for await (const ev of stream) {
    if (ev.type === 'content_block_start') {
      const b = ev.content_block
      if (b.type === 'tool_use' || b.type === 'server_tool_use') emitir({ t: 'etapa', v: `${ETAPAS[b.name] ?? 'Preparando'}...` })
    } else if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') {
      emitir({ t: 'texto', v: ev.delta.text })
    }
  }
  return stream.finalMessage()
}

// Raciocínio maior onde a qualidade pesa mais (jurídico e financeiro); o
// resto fica rápido. Mudar o nível entre perguntas só refaz o cache.
const JURIDICO = /\b(alvar[aá]|avcb|clcb|bombeir|brigad|seguran[cç]a privada|vigilant|ambul[aâ]nci|atendimento m[eé]dico|lota[cç][aã]o|licen[cç]|lei\b|leis\b|decreto|portaria|norma|regulament|jur[ií]dic|contrato|cl[aá]usula|multa|interdi|prefeitura|vigil[aâ]ncia sanit|responsabilidade|indeniza|rescis|cancelamento|ru[ií]do|direito de imagem|filmagem|produ[cç][aã]o audiovisual|seguro)/i
const FINANCEIRO = /\b(fechamento|conferir|confer[eê]ncia|duplicad|inadimpl|atras|vencid|recebiment|recebid|a receber|a pagar|financeir|balan[cç]o|concilia|faturamento|lucro|margem|fluxo de caixa|repasse|parcelas?)\b/i

export function esforcoDaPergunta(texto: string): 'low' | 'medium' | 'high' {
  if (JURIDICO.test(texto)) return 'high'
  if (FINANCEIRO.test(texto)) return 'medium'
  return 'low'
}

// Busca na internet (ferramenta da própria Anthropic; cada busca é cobrada à parte).
export const BUSCA_INTERNET: Anthropic.Beta.BetaWebSearchTool20260209 = {
  type: 'web_search_20260209',
  name: 'web_search',
  max_uses: 3,
  user_location: { type: 'approximate', city: 'São Paulo', region: 'São Paulo', country: 'BR', timezone: 'America/Sao_Paulo' },
}

export const REGRAS_BUSCA = `BUSCA NA INTERNET (web_search): use só quando a resposta não estiver no sistema, no MANUAL nem na BASE JURÍDICA, ou quando precisar de informação atual (notícia, norma nova, fornecedor, tendência, referência de mercado de eventos e produções). Nunca busque dados internos (clientes, valores, agenda): esses vêm das ferramentas do sistema. Diga de onde veio (nome do site). Em assunto jurídico, a BASE JURÍDICA vem primeiro; o que vier da internet entra como "a conferir com o jurídico".`

// Texto da última resposta da IA no histórico (vira o resumo quando a conversa recomeça).
export function ultimaResposta(h: Anthropic.Beta.BetaMessageParam[]): string {
  for (let i = h.length - 1; i >= 0; i--) {
    const m = h[i]
    if (m.role !== 'assistant' || typeof m.content === 'string') continue
    const t = m.content.filter(b => b.type === 'text').map(b => (b as { text: string }).text).join('\n').trim()
    if (t) return t.slice(0, 4000)
  }
  return ''
}
