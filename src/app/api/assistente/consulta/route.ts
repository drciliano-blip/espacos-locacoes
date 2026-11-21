import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { canAccess } from '@/lib/auth'
import { MANUAL_SISTEMA } from '@/lib/assistente/manual-sistema'
import { executarFerramenta, ferramentasDoPerfil, type AcaoProposta } from '@/lib/assistente/ferramentas'
import type { NivelAcesso } from '@/types'

// Assistente de IA — aba Consultas. A pessoa pergunta em linguagem natural;
// a IA usa as ferramentas do perfil dela (agenda, recebimentos, duplicados,
// conferência do mês) e responde. As consultas rodam com a sessão de quem
// pergunta: o banco só devolve o que ela já pode ver. Nada é gravado aqui.

const MODEL = 'claude-opus-5-5'
const MAX_VOLTAS = 8

const PERFIL: Record<string, string> = {
  admin: 'administrador (vê tudo: agenda, valores, financeiro)',
  financeiro: 'financeiro (vê valores, recebimentos e despesas)',
  operacional: 'operacional (vê agenda e eventos, mas NÃO vê valores a receber nem dados financeiros)',
}

function sistema(role: NivelAcesso, hoje: string) {
  return `Você é o assistente interno do sistema da Espaços & Locações: responde dúvidas de uso do sistema (pelo MANUAL acima) e busca dados (locação de espaços para eventos em São Paulo: Fabrique, Usine, House Pacaembu, Espaço Solon, Complexo Jussara).
Hoje é ${hoje}. Quem está perguntando é ${PERFIL[role] ?? role}.

Regras:
- Responda em português do Brasil, direto e organizado: frases curtas e listas com "•", valores em R$ com vírgula, datas DD/MM/AAAA. Sem markdown (nada de **, # ou tabelas).
- Use as ferramentas para buscar os dados. Nunca invente evento, valor ou lançamento: se a ferramenta não trouxe, diga que não encontrou.
- Só use as ferramentas que você recebeu. Se a pessoa pedir algo fora do perfil dela, explique que o acesso dela não permite.
- Arquivos anexados chegam em <anexo> com a leitura feita pela IA (print de tela, ficha, comprovante, boleto). Print de tela com dúvida: explique o que a tela mostra e o próximo passo, pelo MANUAL. Comprovante de pagamento de cliente: ofereça preparar_baixa. Boleto ou nota: ofereça preparar_conta_pagar.
- Ficha do cliente (anexada, colada ou ditada) para cadastrar evento: use preparar_cadastro_evento com os dados (datas em AAAA-MM-DD). Antes, confira com consultar_agenda se já existe pré-evento desse cliente nessa data: se existir, use abrir_evento com acao converter. Diga o que faltou na ficha. Depois de salvo, o próprio sistema oferece gerar o contrato.
- Pedido de orçamento para cliente ("faz um orçamento para..."): use abrir_orcamento com os dados que tiver; o orçamento é montado no atendimento que abre. Não calcule preços aqui.
- Você não grava nada sozinho: prepara a ação e a pessoa confirma. Segurar uma data: propor_pre_evento. Gerar contrato, cancelar ou reagendar evento: abrir_evento (ache o id com consultar_agenda). Dar baixa em parcela de cliente: preparar_baixa (ache o id com recebimentos). Lançar despesa: preparar_conta_pagar. Essas viram cartões que abrem a janela certa do sistema. Para corrigir ou excluir lançamentos existentes, aponte o que encontrou e diga em qual tela fazer (Contas a Pagar, Financeiro, Eventos).
- Em duplicados, diga que são POSSÍVEIS duplicados e que a pessoa deve conferir antes de excluir.
- Na conferência do mês, deixe claro que o fechamento oficial é feito na tela Financeiro.\n\nDÚVIDAS SOBRE O SISTEMA: quando perguntarem como fazer algo no sistema, responda pelo MANUAL acima, em passos curtos com os nomes exatos dos botões e a tela onde ficam, considerando o perfil de quem pergunta (se a tela não é liberada para o perfil, diga quem pode fazer). Se o manual não cobre, diga que não tem certeza e sugira falar com o administrador; não invente botões ou telas.`
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const { data: perfil } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = perfil?.role as NivelAcesso | undefined
  if (!role || !canAccess(role, 'assistente')) return NextResponse.json({ error: 'Sem permissão para o Assistente de IA.' }, { status: 403 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada no servidor.' }, { status: 500 })

  let body: { historico?: Anthropic.Beta.BetaMessageParam[]; pergunta?: string; tela?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 }) }
  const pergunta = (body.pergunta ?? '').trim()
  if (!pergunta) return NextResponse.json({ error: 'Escreva a pergunta.' }, { status: 400 })
  if (pergunta.length > 12000) return NextResponse.json({ error: 'Pergunta muito longa.' }, { status: 400 })

  // O histórico volta inteiro (com os blocos da IA como vieram), só acrescentando.
  const historico = Array.isArray(body.historico) ? body.historico.slice(-40) : []
  // A tela onde a pessoa está (botão flutuante): ajuda em "como faço isso aqui?".
  const tela = (body.tela ?? '').slice(0, 80)
  const mensagens: Anthropic.Beta.BetaMessageParam[] = [...historico, { role: 'user', content: tela ? `[A pessoa está na tela: ${tela}]\n${pergunta}` : pergunta }]
  const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
  const tools = ferramentasDoPerfil(role)
  const acoes: AcaoProposta[] = []
  const client = new Anthropic({ apiKey })

  try {
    for (let volta = 0; volta < MAX_VOLTAS; volta++) {
      const msg = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 8000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: [{ model: 'claude-opus-4-8' }],
        system: [{ type: 'text', text: MANUAL_SISTEMA, cache_control: { type: 'ephemeral' } }, { type: 'text', text: sistema(role, hoje) }],
        output_config: { effort: 'medium' },
        tools,
        messages: mensagens,
      })
      mensagens.push({ role: 'assistant', content: msg.content as Anthropic.Beta.BetaContentBlockParam[] })

      if (msg.stop_reason === 'refusal') return NextResponse.json({ error: 'A IA não respondeu a esta pergunta. Tente reformular.' }, { status: 422 })
      if (msg.stop_reason !== 'tool_use') {
        const resposta = msg.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text').map(b => b.text).join('\n').trim()
        return NextResponse.json({ resposta: resposta || '(sem resposta)', acoes, historico: mensagens })
      }

      const resultados: Anthropic.Beta.BetaToolResultBlockParam[] = []
      for (const b of msg.content) {
        if (b.type !== 'tool_use') continue
        const r = await executarFerramenta(b.name, b.input as Record<string, unknown>, supabase, { role, acoes })
        const conteudo = JSON.stringify(r)
        resultados.push({
          type: 'tool_result', tool_use_id: b.id,
          content: conteudo.length > 60000 ? conteudo.slice(0, 60000) + '…(cortado: peça um período menor)' : conteudo,
          ...(r && typeof r === 'object' && 'erro' in r ? { is_error: true } : {}),
        })
      }
      mensagens.push({ role: 'user', content: resultados })
    }
    return NextResponse.json({ resposta: 'A consulta ficou longa demais. Tente uma pergunta mais específica (um espaço ou um período menor).', acoes, historico: mensagens })
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return NextResponse.json({ error: 'Muitas consultas à IA agora. Tente em 1 minuto.' }, { status: 429 })
    if (err instanceof Anthropic.APIError) return NextResponse.json({ error: `Erro da IA (${err.status}): ${err.message}` }, { status: 502 })
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro ao consultar.' }, { status: 502 })
  }
}
