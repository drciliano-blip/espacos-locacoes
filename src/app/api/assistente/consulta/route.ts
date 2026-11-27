import { NextResponse } from 'next/server'

// A IA pode levar mais de 10 s (várias consultas seguidas): sem isto a conexão cai ("Load failed").
export const maxDuration = 120
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { canAccess } from '@/lib/auth'
import { MANUAL_SISTEMA } from '@/lib/assistente/manual-sistema'
import { BASE_JURIDICA, REGRAS_JURIDICAS } from '@/lib/assistente/base-juridica'
import { LIMITE_HISTORICO, respostaViva } from '@/lib/assistente/resposta-viva'
import { BUSCA_INTERNET, REGRAS_BUSCA, chamarAoVivo, esforcoDaPergunta, mensagemErroIA, respostaAoVivo, ultimaResposta, type Emitir } from '@/lib/assistente/ao-vivo'
import { executarFerramenta, ferramentasDoPerfil, type AcaoProposta } from '@/lib/assistente/ferramentas'
import type { NivelAcesso } from '@/types'

// Assistente de IA — aba Consultas. A pessoa pergunta em linguagem natural;
// a IA usa as ferramentas do perfil dela (agenda, recebimentos, duplicados,
// conferência do mês) e responde. As consultas rodam com a sessão de quem
// pergunta: o banco só devolve o que ela já pode ver. Nada é gravado aqui.

const MODEL = 'claude-opus-5-5'
const MAX_VOLTAS = 10

const PERFIL: Record<string, string> = {
  admin: 'administrador (vê tudo: agenda, valores, financeiro)',
  financeiro: 'financeiro (vê valores, recebimentos e despesas)',
  operacional: 'operacional (vê agenda e eventos, mas NÃO vê valores a receber nem dados financeiros)',
}

function sistema(role: NivelAcesso, hoje: string) {
  return `Você é o assistente interno do sistema da Espaços & Locações: responde dúvidas de uso do sistema (pelo MANUAL acima), dúvidas jurídicas e de regulamentação de eventos (pela BASE JURÍDICA acima) e busca dados (locação de espaços para eventos em São Paulo: Fabrique, Usine, House Pacaembu, Espaço Solon, Complexo Jussara).
Hoje é ${hoje}. Quem está perguntando é ${PERFIL[role] ?? role}.

Regras:
- Responda em português do Brasil, direto e organizado: frases curtas e listas com "•", valores em R$ com vírgula, datas DD/MM/AAAA. Sem markdown (nada de **, # ou tabelas).
- Use as ferramentas para buscar os dados. Nunca invente evento, valor ou lançamento: se a ferramenta não trouxe, diga que não encontrou.
- Só use as ferramentas que você recebeu. Se a pessoa pedir algo fora do perfil dela, explique que o acesso dela não permite.
- Arquivos anexados chegam em <anexo> com a leitura feita pela IA (print de tela, ficha, comprovante, boleto). Print de tela com dúvida: explique o que a tela mostra e o próximo passo, pelo MANUAL. Comprovante de pagamento de cliente: ofereça preparar_baixa. Boleto ou nota: ofereça preparar_conta_pagar.
- Ficha do cliente (anexada, colada ou ditada) para cadastrar evento: use preparar_cadastro_evento com os dados (datas em AAAA-MM-DD). Antes, confira com consultar_agenda se já existe pré-evento desse cliente nessa data: se existir, use abrir_evento com acao converter. Diga o que faltou na ficha. Depois de salvo, o próprio sistema oferece gerar o contrato.
- Pedido de orçamento para cliente ("faz um orçamento para..."): use abrir_orcamento com os dados que tiver; o orçamento é montado no atendimento que abre. Não calcule preços aqui.
- Você não grava nada sozinho: prepara a ação e a pessoa confirma. Segurar uma data: propor_pre_evento. Gerar contrato, cancelar, reagendar ou converter evento: abrir_evento (ache o id com consultar_agenda). Dar baixa em parcela de cliente: preparar_baixa (ache o id com recebimentos; várias parcelas = uma chamada para cada; data e forma pelo comprovante ou pelo que a pessoa disse). Lançar despesa: preparar_conta_pagar. Baixa, conta, alteração de evento e conta paga pelo extrato viram cartões que gravam com um toque de quem confere (com Desfazer); os demais abrem a janela certa do sistema. Depois de preparar, diga que está pronto para confirmar no cartão, nunca que já foi feito. Para corrigir ou excluir lançamentos existentes, aponte o que encontrou e diga em qual tela fazer (Contas a Pagar, Financeiro, Eventos).
- Alterar dados de evento (horário, pessoas, contato, responsável, observações, vistoria...): editar_evento, só com os campos que mudam. Data nova = reagendar (abrir_evento). Valor de evento com plano de pagamento = propor_plano (só administrador).
- Contas a pagar: contas_a_pagar para consultar ("o que vence essa semana", "o que está atrasado", "já paguei a luz?"). Pagar uma conta já lançada: preparar_baixa_conta (o cartão abre "Dar baixa", onde se anexa o comprovante). Conta nova: preparar_conta_pagar.
- Cobrança: cobrancas para ver quem deve; depois uma preparar_mensagem por cliente (cordial, com valor e vencimento, nunca ameaçadora), com o telefone do cliente. Evento que já aconteceu com parcela "vencida" pode ter sido pago e não baixado: diga para conferir no extrato antes de cobrar.
- Datas livres para cliente: datas_livres e, para enviar, preparar_mensagem com o texto_para_cliente (só datas livres; pré-reservadas não vão para o cliente).
- Documentos ("acha o contrato do Fulano", "o comprovante do sinal da Maria"): buscar_documentos e depois mostrar_documentos com os que a pessoa quer (até 8).
- Fechamento do mês: preparar_fechamento (por espaço). Resuma a conferência e as pendências; o cartão abre "Fechar Período" na tela Financeiro, onde aparecem o resultado oficial e a parte de cada sócio. Nunca diga que fechou.
- Extrato bancário anexado: tire as linhas (data, descrição, valor + entrada / − saída, identificador) e chame conciliar_extrato. Depois prepare as baixas das sugestões fortes: entradas com preparar_baixa (data = data da linha; forma PIX/Transferência conforme a descrição) e saídas com preparar_baixa_conta (via_extrato=true, data e identificador). Liste à parte as sugestões fracas, os empates (pergunte) e o que não achou. Extrato longo: avise que pode mandar em partes.
- Aporte ou retirada de sócio: preparar_lancamento_socio (abre "+ Aporte"/"+ Retirada" preenchido).
- Números de gestão (faturamento, despesas, resultado, por espaço ou mês, maiores clientes): relatorio_financeiro. Diga que é apoio e que o oficial é a tela Financeiro.
- Mensagens para o cliente: o WhatsApp da empresa não está integrado; o staff copia o texto do cartão ou abre no WhatsApp do próprio celular.
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

  let body: { historico?: Anthropic.Beta.BetaMessageParam[]; pergunta?: string; tela?: string; aoVivo?: boolean }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 }) }
  const pergunta = (body.pergunta ?? '').trim()
  if (!pergunta) return NextResponse.json({ error: 'Escreva a pergunta.' }, { status: 400 })
  if (pergunta.length > 12000) return NextResponse.json({ error: 'Pergunta muito longa.' }, { status: 400 })

  const papel: NivelAcesso = role
  const historicoRecebido = Array.isArray(body.historico) ? body.historico : []
  // A tela onde a pessoa está (botão flutuante): ajuda em "como faço isso aqui?".
  const tela = (body.tela ?? '').slice(0, 80)
  const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
  const tools = [...ferramentasDoPerfil(role), BUSCA_INTERNET]
  const esforco = esforcoDaPergunta(pergunta)
  const client = new Anthropic({ apiKey })

  // O histórico volta inteiro (com os blocos da IA como vieram), só acrescentando.
  // Grande demais (ou recusado pela IA): recomeça com um resumo (a última resposta).
  function montar(recomecar: boolean): Anthropic.Beta.BetaMessageParam[] {
    const longo = JSON.stringify(historicoRecebido).length > LIMITE_HISTORICO
    const resumo = recomecar || longo ? ultimaResposta(historicoRecebido) : ''
    const base = recomecar || longo ? [] : historicoRecebido
    const texto = [resumo && `<resumo_da_conversa_anterior>\n${resumo}\n</resumo_da_conversa_anterior>`, tela && `[A pessoa está na tela: ${tela}]`, pergunta].filter(Boolean).join('\n')
    return [...base, { role: 'user', content: texto }]
  }

  async function trabalhar(emitir: Emitir, recomecar = false, sinal?: AbortSignal): Promise<unknown> {
    const mensagens = montar(recomecar)
    const acoes: AcaoProposta[] = []
    const inicio = Date.now()
    try {
      for (let volta = 0; volta < MAX_VOLTAS; volta++) {
        const msg = await chamarAoVivo(client, {
          model: MODEL,
          max_tokens: 16000,
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: [{ model: 'claude-opus-4-8' }],
          system: [{ type: 'text', text: MANUAL_SISTEMA }, { type: 'text', text: BASE_JURIDICA, cache_control: { type: 'ephemeral' } }, { type: 'text', text: sistema(papel, hoje) + '\n\n' + REGRAS_JURIDICAS + '\n\n' + REGRAS_BUSCA }],
          output_config: { effort: esforco },
          // Perto do limite de tempo: responde com o que já tem, sem novas consultas.
          ...(Date.now() - inicio > 50000 ? { tool_choice: { type: 'none' as const } } : {}),
          tools,
          messages: mensagens,
          // Guarda a conversa em cache: cada rodada reaproveita a anterior (mais rápido e barato).
          cache_control: { type: 'ephemeral' },
        }, emitir, sinal)
        mensagens.push({ role: 'assistant', content: msg.content as Anthropic.Beta.BetaContentBlockParam[] })

        if (msg.stop_reason === 'refusal') return { error: 'A IA não respondeu a esta pergunta. Tente reformular.' }
        // Busca na internet longa: a IA pausa e continua na próxima chamada.
        if (msg.stop_reason === 'pause_turn') continue
        if (msg.stop_reason !== 'tool_use') {
          const resposta = msg.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text').map(b => b.text).join('\n').trim()
          return { resposta: resposta || '(sem resposta)', acoes, historico: mensagens }
        }

        const resultados: Anthropic.Beta.BetaToolResultBlockParam[] = []
        for (const b of msg.content) {
          if (b.type !== 'tool_use') continue
          const r = await executarFerramenta(b.name, b.input as Record<string, unknown>, supabase, { role: papel, acoes })
          const conteudo = JSON.stringify(r)
          resultados.push({
            type: 'tool_result', tool_use_id: b.id,
            content: conteudo.length > 25000 ? conteudo.slice(0, 25000) + '…(cortado: peça um período menor)' : conteudo,
            ...(r && typeof r === 'object' && 'erro' in r ? { is_error: true } : {}),
          })
        }
        mensagens.push({ role: 'user', content: resultados })
      }
      return { resposta: 'A consulta ficou longa demais. Tente uma pergunta mais específica (um espaço ou um período menor).', acoes, historico: mensagens }
    } catch (err) {
      console.error('[assistente/consulta]', err)
      // Conversa antiga que a IA não aceita mais (ex.: mudou o conjunto de
      // ferramentas): tenta uma vez recomeçando a partir do resumo.
      if (err instanceof Anthropic.BadRequestError && !recomecar && historicoRecebido.length > 0) return trabalhar(emitir, true, sinal)
      return { error: mensagemErroIA(err) }
    }
  }

  // Tela nova: resposta palavra por palavra. Tela antiga (app ainda não atualizado): JSON no fim.
  return body.aoVivo ? respostaAoVivo((e, sinal) => trabalhar(e, false, sinal)) : respostaViva(() => trabalhar(() => {}))
}
