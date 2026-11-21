import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { canAccess } from '@/lib/auth'
import { MANUAL_SISTEMA } from '@/lib/assistente/manual-sistema'
import { executarFerramenta, ferramentasDoPerfil, type AcaoProposta } from '@/lib/assistente/ferramentas'
import { aplicarPatch, calcular, type PatchOrcamento } from '@/lib/assistente/calculo-estado'
import { TABELAS_ESPACOS, tabelaPorSlug } from '@/lib/assistente/tabelas-espacos'
import { br, diaDaSemana } from '@/lib/assistente/orcamento'
import type { EstadoAtendimento } from '@/lib/assistente/atendimentos'
import type { BuffetTabela } from '@/lib/buffet'
import type { NivelAcesso } from '@/types'

// Chat do atendimento: quem atende conversa com o assistente em linguagem
// natural ("monta o orçamento do Fabrique para 12/12", "cadastra um
// pré-evento", ou cola o que o cliente escreveu). O assistente preenche o
// orçamento, consulta a agenda e prepara mensagens e ações — que aparecem
// como cartões e só valem com o clique de quem atende. Roda com a sessão de
// quem pergunta (o banco só devolve o que ela pode ver).

const MODEL = 'claude-opus-5-5'
const MAX_VOLTAS = 8

type Acao =
  | { tipo: 'rascunho'; texto: string }
  | { tipo: 'pre_evento'; dados: AcaoProposta }
  | { tipo: 'pdfs' }
  | { tipo: 'confirmar_evento' }
  | { tipo: 'sistema'; dados: AcaoProposta } // contrato, cancelar, reagendar, baixa, conta a pagar

const SISTEMA = `Você é o assistente de atendimento da Espaços & Locações (locação de espaços para eventos em São Paulo). Você conversa com a PESSOA DA EQUIPE que está atendendo um cliente — não com o cliente. Cada chat é um atendimento (um cliente/orçamento).

Espaços com tabela: Espaço Fabrique (até 800), Espaço Usine (até 1.500), House Pacaembu (até 250), Armazém Solon (até 1.500), CESA Eventos SP (564 poltronas, agenda fora do sistema). Complexo Jussara: atendido pessoalmente pela direção (não orce; diga isso).

Como trabalhar:
- Quando a pessoa colar o que o cliente escreveu, ou contar dados do evento, chame atualizar_orcamento com o que entendeu (nome, data AAAA-MM-DD, pessoas, tipo, espaço, serviços...). Vale a informação mais nova.
- Fluxo: 1) coleta das 5 respostas (nome completo, data, nº de pessoas, tipo de evento, espaço); 2) orçamento de locação e de serviços (separados); 3) oferta de serviços extras (buffet E&L e parceiros); 4) pré-reserva na agenda; 5) confirmar e converter em evento.
- Enquanto faltar resposta do questionário, use redigir_mensagem_cliente para preparar a mensagem que pede só o que falta (e, se já houver data e pessoas, sugira os espaços livres que comportam).
- Com tudo respondido, monte o orçamento (atualizar_orcamento), confira os totais no resultado da ferramenta, chame mostrar_pdfs e prepare com redigir_mensagem_cliente a mensagem com os totais de locação e serviços e uma oferta natural de extras.
- Para segurar a data use pre_reservar; para converter em evento use confirmar_evento. Elas viram cartões: a pessoa confirma.
- Ficha do cliente (em <ficha_anexada>, colada ou ditada) para fechar o evento: se já houver pré-evento deste atendimento, use confirmar_evento; senão, preparar_cadastro_evento com os dados (datas AAAA-MM-DD). Aproveite a ficha também para completar o orçamento (atualizar_orcamento). Diga o que faltou. Depois de salvo, o sistema oferece gerar o contrato.
- Tarefas em eventos já cadastrados (gerar contrato, cancelar, reagendar) use abrir_evento; dar baixa em parcela de cliente use preparar_baixa; lançar despesa use preparar_conta_pagar. Todas viram cartões que abrem a janela certa do sistema; a pessoa confere e salva lá. Se a ferramenta não estiver disponível para o perfil, diga quem pode fazer.
- Preços: SÓ os que as ferramentas devolverem. Nunca invente valor, desconto, disponibilidade ou condição. Staff complementar e valores de parceiros: só se a pessoa informar.
- Parceria: venda de ingressos obrigatória pela FASTIX (pagamento 25% na reserva e 75% até 8 dias antes); na locação a FASTIX é opcional.
- Respostas para a pessoa da equipe: curtas, em português, sem markdown (nada de ** ou #), listas com "•", valores em R$ com vírgula, datas DD/MM/AAAA. Diga o que fez e o próximo passo.
- Mensagens para o cliente (redigir_mensagem_cliente): tom cordial de WhatsApp, até 12 linhas, no máximo 1 ou 2 emojis, sem confirmar reserva (pré-reserva vale 72 h após o aceite e o sinal).\n\nDÚVIDAS SOBRE O SISTEMA: quando perguntarem como fazer algo no sistema, responda pelo MANUAL acima, em passos curtos com os nomes exatos dos botões e a tela onde ficam, considerando o perfil de quem pergunta (se a tela não é liberada para o perfil, diga quem pode fazer). Se o manual não cobre, diga que não tem certeza e sugira falar com o administrador; não invente botões ou telas.`

const FERRAMENTAS_ATENDIMENTO: Anthropic.Beta.BetaTool[] = [
  {
    name: 'atualizar_orcamento',
    description: 'Preenche ou altera o orçamento deste atendimento e devolve os totais calculados pela tabela do espaço, a disponibilidade da data e o que falta do questionário. Mande só os campos que mudaram. servicos/opcionais substituem a lista inteira.',
    input_schema: {
      type: 'object',
      properties: {
        cliente: { type: 'string', description: 'Nome completo do cliente' },
        empresa: { type: 'string' }, telefone: { type: 'string' }, email: { type: 'string' },
        tipo_evento: { type: 'string' },
        data: { type: 'string', description: 'AAAA-MM-DD' },
        convidados: { type: 'integer' }, duracao_horas: { type: 'number' },
        tipo_dia: { type: 'string', enum: ['normal', 'vespera', 'feriado'] },
        observacoes: { type: 'string' },
        espaco: { type: ['string', 'null'], description: 'Nome do espaço (null para tirar)' },
        contratacao: { type: 'string', enum: ['locacao', 'parceria'] },
        fastix: { type: 'boolean', description: 'Condição FASTIX na locação (opcional)' },
        staff_complementar: { type: 'number', description: 'Valor em R$ informado pela equipe' },
        montagem: { type: 'boolean', description: 'Montagem 1 dia antes (Armazém Solon)' },
        valor_locacao: { type: ['number', 'null'], description: 'Só se a equipe combinou outro valor de locação' },
        buffet: {
          type: ['object', 'null'],
          properties: { tabela: { type: 'string' }, opcao: { type: 'string' }, valor: { type: 'number' } },
          required: ['tabela'],
          description: 'Buffet E&L pela tabela cadastrada (null para tirar)',
        },
        servicos: { type: 'array', items: { type: 'object', properties: { descricao: { type: 'string' }, prestador: { type: 'string' }, valor: { type: 'number' }, detalhe: { type: 'string' } }, required: ['descricao', 'valor'] } },
        opcionais: { type: 'array', items: { type: 'object', properties: { descricao: { type: 'string' }, prestador: { type: 'string' }, valor: { type: 'number' }, detalhe: { type: 'string' } }, required: ['descricao', 'valor'] } },
      },
    },
  },
  {
    name: 'redigir_mensagem_cliente',
    description: 'Prepara uma mensagem para o CLIENTE. Aparece no chat como rascunho com botões Copiar / Enviar pelo WhatsApp; a equipe revisa antes.',
    input_schema: { type: 'object', properties: { texto: { type: 'string' } }, required: ['texto'] },
  },
  {
    name: 'mostrar_pdfs',
    description: 'Mostra no chat os botões para gerar os PDFs do Orçamento de Locação e do Orçamento de Serviços. Use depois de o espaço estar escolhido.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'pre_reservar',
    description: 'Prepara a pré-reserva da data na Agenda (pré-evento, status em negociação) com os dados deste orçamento. Vira um cartão "Confirmar". Precisa de cliente, data e espaço do sistema.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'confirmar_evento',
    description: 'Mostra o cartão para converter o pré-evento deste atendimento em evento confirmado (abre o formulário padrão do sistema).',
    input_schema: { type: 'object', properties: {} },
  },
]

async function carregarBuffets(sb: Awaited<ReturnType<typeof createClient>>): Promise<BuffetTabela[]> {
  const [{ data: tabs }, { data: faixas }] = await Promise.all([
    sb.from('buffet_tabelas_preco').select('*').eq('ativo', true).order('ordem'),
    sb.from('buffet_tabela_faixas').select('*'),
  ])
  return (tabs ?? []).map(t => ({
    id: t.id, nome: t.nome, descricao: t.descricao ?? undefined, inclusos: t.inclusos ?? undefined, observacao: t.observacao ?? undefined,
    ativo: t.ativo, ordem: t.ordem,
    faixas: (faixas ?? []).filter(f => f.tabela_id === t.id).map(f => ({ id: f.id, tabelaId: f.tabela_id, ateConvidados: f.ate_convidados, opcao: f.opcao, valor: Number(f.valor) })),
  }))
}

async function ocupacao(sb: Awaited<ReturnType<typeof createClient>>, data: string, ignorar?: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return null
  const [{ data: esp }, { data: ev, error }] = await Promise.all([
    sb.from('espacos').select('id, slug'),
    sb.from('eventos').select('id, espaco_id, status').eq('data', data).neq('status', 'cancelado'),
  ])
  if (error) return null
  const slugDe = new Map((esp ?? []).map(e => [e.id, e.slug]))
  const ocupados = new Set((ev ?? []).filter(e => e.id !== ignorar).map(e => slugDe.get(e.espaco_id)).filter(Boolean))
  return TABELAS_ESPACOS.map(t => ({ espaco: t.nome, capacidade: t.capacidade, situacao: t.semAgendaNoSistema ? 'agenda fora do sistema: confirmar por fora' : ocupados.has(t.slug) ? 'ocupado' : 'livre' }))
}

function resumo(e: EstadoAtendimento, buffets: BuffetTabela[]) {
  const c = calcular(e, buffets)
  const r = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
  return {
    cliente: e.dados.cliente || null, empresa: e.dados.empresa || null, telefone: e.dados.telefone || null,
    evento: e.dados.tipoEvento || null, data: e.dados.data ? `${diaDaSemana(e.dados.data)}, ${br(e.dados.data)}` : null,
    convidados: e.dados.convidados, espaco: c.espaco?.nome ?? null, contratacao: e.contratacao, fastix: c.fastix,
    falta_no_questionario: c.perguntas.filter(p => !p.resposta).map(p => p.pergunta),
    locacao: c.espaco ? { itens: c.linhasLoc.map(l => `${l.descricao}: ${r(l.valor)}`), total: r(c.totalLoc), pagamento: c.parcelasLoc.map(p => `${p.descricao}: ${r(p.valor)}${p.vencimento ? ` até ${br(p.vencimento)}` : ''}`), obrigatorios: c.espaco.obrigatorios, incluso: [...c.espaco.staffDaCasa, ...c.espaco.rider.map(x => x.titulo)], cabe_o_publico: !e.dados.convidados || e.dados.convidados <= c.espaco.capacidade } : null,
    servicos: { itens: c.linhasServ.map(l => `${l.descricao} (${l.prestador || 'E&L'}): ${r(l.valor)}`), total: r(c.totalServ), buffet_sem_faixa_para_o_publico: c.buffetSemFaixa },
    opcionais: e.opcionais.map(o => `${o.descricao}: ${r(o.valor)}`),
    catalogo_buffet: buffets.map(b => ({ tabela: b.nome, opcoes: [...new Set(b.faixas.map(f => f.opcao))], faixas_ate: [...new Set(b.faixas.map(f => f.ateConvidados))].sort((a, z) => a - z) })),
  }
}

export async function POST(request: Request) {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const { data: perfil } = await sb.from('profiles').select('role').eq('id', user.id).single()
  const role = perfil?.role as NivelAcesso | undefined
  if (!role || !canAccess(role, 'assistente')) return NextResponse.json({ error: 'Sem permissão para o Assistente de IA.' }, { status: 403 })
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada no servidor.' }, { status: 500 })

  let body: { mensagem?: string; historico?: Anthropic.Beta.BetaMessageParam[]; estado?: Partial<EstadoAtendimento>; preEvento?: { status: string } | null; clienteNovas?: string[] }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 }) }
  const texto = (body.mensagem ?? '').trim()
  if (!texto && !(body.clienteNovas?.length)) return NextResponse.json({ error: 'Escreva a mensagem.' }, { status: 400 })
  if (texto.length > 20000) return NextResponse.json({ error: 'Mensagem muito longa.' }, { status: 400 })

  const buffets = await carregarBuffets(sb)
  let estado = aplicarPatch(body.estado ?? {}, {}, buffets).estado
  let estadoMudou = false
  const acoes: Acao[] = []
  const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })

  // Cada turno leva o orçamento atual e as mensagens novas do cliente (WhatsApp).
  const partes = [
    `Hoje é ${hoje}. Perfil de quem está atendendo: ${role}.`,
    `<orcamento_atual>\n${JSON.stringify(resumo(estado, buffets))}\n</orcamento_atual>`,
    `<pre_evento>${body.preEvento ? `existe, status ${body.preEvento.status}` : 'nenhum'}</pre_evento>`,
    ...(body.clienteNovas?.length ? [`<mensagens_novas_do_cliente>\n${body.clienteNovas.join('\n---\n')}\n</mensagens_novas_do_cliente>`] : []),
    `<equipe>\n${texto || '(chegou mensagem nova do cliente: o que fazer?)'}\n</equipe>`,
  ]
  const historico = Array.isArray(body.historico) ? body.historico : []
  const mensagens: Anthropic.Beta.BetaMessageParam[] = [...historico, { role: 'user', content: partes.join('\n\n') }]
  const tools = [...FERRAMENTAS_ATENDIMENTO, ...ferramentasDoPerfil(role).filter(t => t.name !== 'propor_pre_evento' && t.name !== 'abrir_orcamento')]
  const client = new Anthropic({ apiKey })

  try {
    for (let volta = 0; volta < MAX_VOLTAS; volta++) {
      const msg = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 8000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: [{ model: 'claude-opus-4-8' }],
        system: [{ type: 'text', text: MANUAL_SISTEMA }, { type: 'text', text: SISTEMA, cache_control: { type: 'ephemeral' } }],
        output_config: { effort: 'medium' },
        tools,
        messages: mensagens,
      })
      mensagens.push({ role: 'assistant', content: msg.content as Anthropic.Beta.BetaContentBlockParam[] })
      if (msg.stop_reason === 'refusal') return NextResponse.json({ error: 'A IA não respondeu. Tente reformular.' }, { status: 422 })
      if (msg.stop_reason !== 'tool_use') {
        const resposta = msg.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text').map(b => b.text).join('\n').trim()
        return NextResponse.json({ resposta, acoes, historico: mensagens, estado: estadoMudou ? estado : undefined })
      }

      const resultados: Anthropic.Beta.BetaToolResultBlockParam[] = []
      for (const b of msg.content) {
        if (b.type !== 'tool_use') continue
        const entrada = (b.input ?? {}) as Record<string, unknown>
        let r: unknown
        if (b.name === 'atualizar_orcamento') {
          const { estado: novo, avisos } = aplicarPatch(estado, entrada as PatchOrcamento, buffets)
          estado = novo; estadoMudou = true
          r = { ok: true, avisos, orcamento: resumo(estado, buffets), agenda_da_data: await ocupacao(sb, estado.dados.data, estado.preEventoId) }
        } else if (b.name === 'redigir_mensagem_cliente') {
          const t = String(entrada.texto ?? '').trim()
          if (t) acoes.push({ tipo: 'rascunho', texto: t })
          r = { ok: !!t, mensagem: 'Rascunho mostrado à equipe.' }
        } else if (b.name === 'mostrar_pdfs') {
          if (!estado.slug) r = { erro: 'Escolha o espaço antes (atualizar_orcamento).' }
          else { acoes.push({ tipo: 'pdfs' }); r = { ok: true } }
        } else if (b.name === 'pre_reservar') {
          const t = tabelaPorSlug(estado.slug)
          const cliente = (estado.dados.empresa || estado.dados.cliente).trim()
          if (!canAccess(role, 'agenda')) r = { erro: 'O perfil desta pessoa não cria eventos na Agenda.' }
          else if (body.preEvento) r = { erro: 'Este atendimento já tem pré-evento na Agenda.' }
          else if (!t || t.semAgendaNoSistema) r = { erro: 'Escolha um espaço que está na agenda do sistema.' }
          else if (!cliente || !estado.dados.data) r = { erro: 'Faltam o nome do cliente e/ou a data.' }
          else {
            const c = calcular(estado, buffets)
            acoes.push({ tipo: 'pre_evento', dados: { tipo: 'pre_evento', cliente, telefone: estado.dados.telefone || undefined, espaco: t.slug, data: estado.dados.data, pessoas: estado.dados.convidados ?? undefined, valor: c.totalLoc || undefined, nomeEvento: estado.dados.tipoEvento || undefined } })
            r = { ok: true, agenda_da_data: await ocupacao(sb, estado.dados.data, estado.preEventoId), mensagem: 'Cartão de confirmação mostrado. Se a data estiver ocupada, avise.' }
          }
        } else if (b.name === 'confirmar_evento') {
          if (!body.preEvento) r = { erro: 'Ainda não há pré-evento: use pre_reservar antes.' }
          else if (body.preEvento.status !== 'em_negociacao') r = { erro: `O evento já está ${body.preEvento.status}.` }
          else { acoes.push({ tipo: 'confirmar_evento' }); r = { ok: true } }
        } else {
          const propostas: AcaoProposta[] = []
          r = await executarFerramenta(b.name, entrada, sb, { role, acoes: propostas })
          for (const p of propostas) if (p.tipo !== 'pre_evento') acoes.push({ tipo: 'sistema', dados: p })
        }
        const conteudo = JSON.stringify(r)
        resultados.push({
          type: 'tool_result', tool_use_id: b.id,
          content: conteudo.length > 60000 ? conteudo.slice(0, 60000) + '…(cortado)' : conteudo,
          ...(r && typeof r === 'object' && 'erro' in r ? { is_error: true } : {}),
        })
      }
      mensagens.push({ role: 'user', content: resultados })
    }
    return NextResponse.json({ resposta: 'Essa tarefa ficou longa demais. Pode dividir em partes?', acoes, historico: mensagens, estado: estadoMudou ? estado : undefined })
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return NextResponse.json({ error: 'Muitas consultas à IA agora. Tente em 1 minuto.' }, { status: 429 })
    if (err instanceof Anthropic.APIError) return NextResponse.json({ error: `Erro da IA (${err.status}): ${err.message}` }, { status: 502 })
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro ao consultar.' }, { status: 502 })
  }
}
