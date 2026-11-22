import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import { executarFerramenta, type AcaoProposta } from './ferramentas'
import { TABELAS_ESPACOS } from './tabelas-espacos'
import type { NivelAcesso } from '@/types'

// Etapa 4: rotinas automáticas do assistente. Todo dia às 8h (horário de
// Brasília) o servidor junta os números do sistema e a IA escreve um resumo
// para cada público; às segundas, a conferência de lançamentos; no dia 1º, o
// pré-fechamento do mês anterior. Só lê e avisa: nada é gravado nos dados.

const MODEL = 'claude-opus-5-5'

export type Publico = 'gestao' | 'operacao'
const PERFIS: Record<Publico, NivelAcesso[]> = { gestao: ['admin', 'financeiro'], operacao: ['operacional'] }
const PAPEL: Record<Publico, NivelAcesso> = { gestao: 'admin', operacao: 'operacional' }

export const hojeSP = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
const somar = (iso: string, dias: number) => new Date(Date.parse(iso + 'T12:00:00Z') + dias * 864e5).toISOString().slice(0, 10)
const br = (iso: string) => iso.split('-').reverse().join('/')
const mesAnterior = (iso: string) => { const d = new Date(Date.parse(iso.slice(0, 8) + '01T12:00:00Z') - 864e5); return d.toISOString().slice(0, 7) }

interface Rotina { tipo: 'manha' | 'semanal' | 'fechamento' | 'vendas'; publico: Publico; titulo: string; dados: Record<string, unknown>; pedido: string }

async function ferramenta(sb: SupabaseClient, nome: string, entrada: Record<string, unknown>, publico: Publico) {
  const acoes: AcaoProposta[] = []
  return executarFerramenta(nome, entrada, sb, { role: PAPEL[publico], acoes })
}

// Que rotinas rodam hoje (segunda = conferência; sexta = vendas da semana; dia 1º = pré-fechamento).
export function rotinasDoDia(hoje: string): Rotina['tipo'][] {
  const tipos: Rotina['tipo'][] = ['manha']
  if (new Date(hoje + 'T12:00:00Z').getUTCDay() === 1) tipos.push('semanal')
  if (new Date(hoje + 'T12:00:00Z').getUTCDay() === 5) tipos.push('vendas')
  if (hoje.endsWith('-01')) tipos.push('fechamento')
  return tipos
}

const reais = (n: unknown) => Number(n ?? 0)
const diaSemana = (iso: string) => ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'].at(new Date(iso + 'T12:00:00Z').getUTCDay())

// Lançamentos feitos nos últimos 2 dias com sinal de erro de digitação:
// data muito longe de hoje, valor zerado/negativo ou fora do normal, pago sem
// data de pagamento, despesa sem espaço ou sem categoria.
async function lancamentosSuspeitos(sb: SupabaseClient, hoje: string) {
  const desde = new Date(Date.now() - 2 * 864e5).toISOString()
  const min = somar(hoje, -400), max = somar(hoje, 800)
  const [{ data: rec }, { data: con }, { data: esp }] = await Promise.all([
    sb.from('receitas').select('id, cliente, descricao, valor, data, data_recebimento, status, espaco_id, created_at').gte('created_at', desde).limit(300),
    sb.from('contas_pagar').select('id, descricao, fornecedor, valor, data_vencimento, data_pagamento, status, categoria, espaco_id, created_at').gte('created_at', desde).limit(300),
    sb.from('espacos').select('id, nome'),
  ])
  const nome = new Map((esp ?? []).map(e => [e.id, e.nome]))
  const achados: { tipo: string; lancamento: string; problema: string; onde_corrigir: string }[] = []
  for (const r of rec ?? []) {
    const l = `${r.cliente ?? r.descricao} · R$ ${reais(r.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} · venc. ${r.data}${r.espaco_id ? ` · ${nome.get(r.espaco_id) ?? ''}` : ''}`
    const onde = 'Eventos (plano de pagamento) ou Financeiro'
    if (r.data && (r.data < min || r.data > max)) achados.push({ tipo: 'receita', lancamento: l, problema: `data ${r.data} muito longe de hoje (ano digitado errado?)`, onde_corrigir: onde })
    if (r.data_recebimento && (r.data_recebimento > hoje || r.data_recebimento < min)) achados.push({ tipo: 'receita', lancamento: l, problema: `data de recebimento ${r.data_recebimento} estranha`, onde_corrigir: onde })
    if (reais(r.valor) <= 0) achados.push({ tipo: 'receita', lancamento: l, problema: 'valor zerado ou negativo', onde_corrigir: onde })
    if (reais(r.valor) > 300000) achados.push({ tipo: 'receita', lancamento: l, problema: 'valor muito alto (zero a mais?)', onde_corrigir: onde })
    if (r.status === 'pago' && !r.data_recebimento) achados.push({ tipo: 'receita', lancamento: l, problema: 'marcada como paga sem data de recebimento', onde_corrigir: onde })
  }
  for (const c of con ?? []) {
    const l = `${c.descricao}${c.fornecedor ? ` (${c.fornecedor})` : ''} · R$ ${reais(c.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} · venc. ${c.data_vencimento}${c.espaco_id ? ` · ${nome.get(c.espaco_id) ?? ''}` : ''}`
    const onde = 'Contas a Pagar'
    if (c.data_vencimento && (c.data_vencimento < min || c.data_vencimento > max)) achados.push({ tipo: 'despesa', lancamento: l, problema: `vencimento ${c.data_vencimento} muito longe de hoje (ano digitado errado?)`, onde_corrigir: onde })
    if (c.data_pagamento && (c.data_pagamento > hoje || c.data_pagamento < min)) achados.push({ tipo: 'despesa', lancamento: l, problema: `data de pagamento ${c.data_pagamento} estranha`, onde_corrigir: onde })
    if (reais(c.valor) <= 0) achados.push({ tipo: 'despesa', lancamento: l, problema: 'valor zerado ou negativo', onde_corrigir: onde })
    if (reais(c.valor) > 200000) achados.push({ tipo: 'despesa', lancamento: l, problema: 'valor muito alto (zero a mais?)', onde_corrigir: onde })
    if (c.status === 'pago' && !c.data_pagamento) achados.push({ tipo: 'despesa', lancamento: l, problema: 'paga sem data de pagamento', onde_corrigir: onde })
    if (!c.espaco_id && c.categoria !== 'retirada_socio') achados.push({ tipo: 'despesa', lancamento: l, problema: 'sem espaço', onde_corrigir: onde })
    if (!c.categoria) achados.push({ tipo: 'despesa', lancamento: l, problema: 'sem categoria', onde_corrigir: onde })
  }
  return { lancados_nos_ultimos_2_dias: { receitas: rec?.length ?? 0, despesas: con?.length ?? 0 }, achados: achados.slice(0, 40) }
}

// Eventos confirmados dos próximos 60 dias com o financeiro incompleto: sem
// parcelas, sem nenhum pagamento a menos de 30 dias, ou com a soma das
// parcelas diferente do valor do evento.
async function eventosComPendencia(sb: SupabaseClient, hoje: string) {
  const [{ data: ev }, { data: esp }] = await Promise.all([
    sb.from('eventos').select('id, cliente, data, espaco_id, valor').eq('status', 'confirmado').gte('data', hoje).lte('data', somar(hoje, 60)).order('data').limit(200),
    sb.from('espacos').select('id, nome'),
  ])
  const nome = new Map((esp ?? []).map(e => [e.id, e.nome]))
  const ids = (ev ?? []).map(e => e.id)
  const { data: rec } = ids.length ? await sb.from('receitas').select('evento_id, valor, status').in('evento_id', ids) : { data: [] }
  const sem_parcelas: string[] = [], sem_pagamento_a_30_dias: string[] = [], soma_diferente: string[] = []
  for (const e of ev ?? []) {
    const parc = (rec ?? []).filter(r => r.evento_id === e.id)
    const rotulo = `${e.cliente} · ${nome.get(e.espaco_id) ?? ''} · ${br(e.data)} (${diaSemana(e.data)})`
    if (!parc.length) { sem_parcelas.push(rotulo); continue }
    if (e.data <= somar(hoje, 30) && !parc.some(r => r.status === 'pago')) sem_pagamento_a_30_dias.push(rotulo)
    const soma = parc.reduce((t, r) => t + reais(r.valor), 0)
    if (reais(e.valor) > 0 && Math.abs(soma - reais(e.valor)) > 1) soma_diferente.push(`${rotulo} · valor do evento R$ ${reais(e.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} x soma das parcelas R$ ${soma.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`)
  }
  return { sem_parcelas, sem_pagamento_a_30_dias, soma_das_parcelas_diferente_do_valor: soma_diferente }
}

// Orçamentos do assistente marcados como enviados e parados há 3 dias ou mais.
async function orcamentosParados(sb: SupabaseClient, publico: Publico) {
  const limite = new Date(Date.now() - 3 * 864e5).toISOString()
  const { data } = await sb.from('assistente_atendimentos').select('numero, titulo, espaco_slug, data_evento, total_locacao, total_servicos, updated_at').eq('status', 'enviado').lt('updated_at', limite).order('updated_at').limit(20)
  return (data ?? []).map(a => ({
    cliente: a.titulo, numero: a.numero, espaco: TABELAS_ESPACOS.find(t => t.slug === a.espaco_slug)?.nome, data_evento: a.data_evento ? br(a.data_evento) : undefined,
    parado_ha_dias: Math.floor((Date.now() - Date.parse(a.updated_at)) / 864e5),
    ...(publico === 'gestao' ? { total: reais(a.total_locacao) + reais(a.total_servicos) } : {}),
  }))
}

// Sábados livres nos próximos 60 dias, por espaço que tem agenda no sistema.
async function sabadosLivres(sb: SupabaseClient, hoje: string) {
  const ate = somar(hoje, 60)
  const [{ data: esp }, { data: ev }] = await Promise.all([
    sb.from('espacos').select('id, slug, nome'),
    sb.from('eventos').select('espaco_id, data').neq('status', 'cancelado').gte('data', hoje).lte('data', ate),
  ])
  const ocupado = new Set((ev ?? []).map(e => `${e.espaco_id}|${e.data}`))
  const sabados: string[] = []
  for (let d = hoje; d <= ate; d = somar(d, 1)) if (new Date(d + 'T12:00:00Z').getUTCDay() === 6) sabados.push(d)
  const resultado: Record<string, string[]> = {}
  for (const t of TABELAS_ESPACOS) {
    if (t.semAgendaNoSistema) continue
    const e = (esp ?? []).find(x => x.slug === t.slug)
    if (!e) continue
    resultado[t.nome] = sabados.filter(d => !ocupado.has(`${e.id}|${d}`)).map(br)
  }
  return resultado
}

// Vendas da semana (sexta): orçamentos do assistente e eventos fechados.
async function vendasDaSemana(sb: SupabaseClient, hoje: string) {
  const desde = new Date(Date.parse(somar(hoje, -7) + 'T00:00:00-03:00')).toISOString()
  const [{ data: at }, { data: ev }, { data: esp }] = await Promise.all([
    sb.from('assistente_atendimentos').select('titulo, status, total_locacao, total_servicos, created_at, updated_at').gte('updated_at', desde).limit(200),
    sb.from('eventos').select('cliente, data, espaco_id, valor, status, created_at, updated_at').gte('updated_at', desde).limit(200),
    sb.from('espacos').select('id, nome'),
  ])
  const nome = new Map((esp ?? []).map(e => [e.id, e.nome]))
  const total = (a: { total_locacao: unknown; total_servicos: unknown }) => reais(a.total_locacao) + reais(a.total_servicos)
  const por = (st: string) => (at ?? []).filter(a => a.status === st)
  return {
    periodo: `${br(somar(hoje, -7))} a ${br(hoje)}`,
    orcamentos_novos: (at ?? []).filter(a => a.created_at >= desde).length,
    orcamentos_por_situacao: Object.fromEntries(['aberto', 'enviado', 'fechado', 'perdido'].map(st => [st, { quantidade: por(st).length, valor: por(st).reduce((t, a) => t + total(a), 0) }])),
    fechados: por('fechado').map(a => `${a.titulo} · R$ ${total(a).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`),
    perdidos: por('perdido').map(a => a.titulo),
    eventos_confirmados_ou_alterados: (ev ?? []).filter(e => e.status === 'confirmado').map(e => `${e.cliente} · ${nome.get(e.espaco_id) ?? ''} · ${br(e.data)} · R$ ${reais(e.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`),
    pre_eventos_novos: (ev ?? []).filter(e => e.status === 'em_negociacao' && e.created_at >= desde).map(e => `${e.cliente} · ${nome.get(e.espaco_id) ?? ''} · ${br(e.data)}`),
  }
}

async function montar(sb: SupabaseClient, tipo: Rotina['tipo'], publico: Publico, hoje: string): Promise<Rotina | null> {
  if (tipo === 'manha') {
    const agenda = await ferramenta(sb, 'consultar_agenda', { de: hoje, ate: somar(hoje, 7) }, publico)
    const preEventos = await ferramenta(sb, 'consultar_agenda', { de: hoje, ate: somar(hoje, 90), status: 'em_negociacao' }, publico)
    const dados: Record<string, unknown> = { hoje, agenda_7_dias: agenda, pre_eventos_90_dias: preEventos }
    dados.orcamentos_enviados_sem_resposta = await orcamentosParados(sb, publico)
    dados.sabados_livres_60_dias = await sabadosLivres(sb, hoje)
    if (publico === 'gestao') {
      dados.parcelas_vencendo_7_dias = await ferramenta(sb, 'recebimentos', { situacao: 'a_receber', de: hoje, ate: somar(hoje, 7) }, publico)
      dados.parcelas_em_atraso = await ferramenta(sb, 'recebimentos', { situacao: 'vencidos' }, publico)
      dados.lancamentos_com_possivel_erro = await lancamentosSuspeitos(sb, hoje)
      dados.possiveis_duplicados_7_dias = await ferramenta(sb, 'lancamentos_duplicados', { de: somar(hoje, -7), ate: somar(hoje, 30) }, publico)
      dados.eventos_com_financeiro_incompleto = await eventosComPendencia(sb, hoje)
    }
    return {
      tipo, publico, dados,
      titulo: `Resumo da manhã · ${br(hoje)}`,
      pedido: publico === 'gestao'
        ? 'Resumo da manhã para a gestão (administração e financeiro). Seções, nesta ordem, só as que tiverem conteúdo: "Hoje" (eventos do dia, com espaço e público); "Próximos 7 dias"; "Conferir lançamentos" (cada lançamento com possível erro de digitação ou possível duplicado: o que é, o problema e a tela onde corrigir; diga que é para conferir, não que está errado); "Eventos com financeiro incompleto" (sem parcelas, sem nenhum pagamento a menos de 30 dias, soma das parcelas diferente do valor do evento); "A receber nesta semana" (cliente, valor, vencimento, total); "Em atraso" (os maiores e o total, e quem cobrar primeiro); "Orçamentos sem resposta" (cliente, há quantos dias, e uma frase curta sugerida para retomar o contato); "Pré-eventos" (os que estão há tempo sem virar evento ou com data próxima: pedir sinal ou liberar a data); "Sábados livres" (por espaço, em uma linha cada, só os próximos 4). Termine com "Para fazer hoje": no máximo 6 itens, começando pelo que evita perder dinheiro ou corrigir erro.'
        : 'Resumo da manhã para a equipe de operação (sem valores financeiros). Seções, só as que tiverem conteúdo: "Hoje" (eventos do dia: espaço, cliente, horário, público); "Próximos 7 dias"; "Pré-eventos com data próxima"; "Orçamentos sem resposta" (cliente, há quantos dias, e uma frase curta sugerida para retomar o contato); "Sábados livres" (por espaço, em uma linha cada, só os próximos 4). Termine com "Para fazer hoje": no máximo 5 itens de operação (montagem, equipe, documentos, retomar orçamentos).',
    }
  }
  if (tipo === 'semanal' && publico === 'gestao') {
    const de = somar(hoje, -35)
    const duplicados = await ferramenta(sb, 'lancamentos_duplicados', { de, ate: hoje }, publico)
    const [rec, con, zero] = await Promise.all([
      sb.from('receitas').select('id, cliente, descricao, valor, data, status').or('data.lt.2000-01-01,data.gt.2100-01-01').limit(30),
      sb.from('contas_pagar').select('id, descricao, valor, data_vencimento, status').or('data_vencimento.lt.2000-01-01,data_vencimento.gt.2100-01-01').limit(30),
      sb.from('receitas').select('id, cliente, descricao, data, status').eq('valor', 0).neq('status', 'pago').limit(30),
    ])
    return {
      tipo, publico,
      titulo: `Conferência da semana · ${br(hoje)}`,
      dados: { periodo: { de, ate: hoje }, possiveis_duplicados: duplicados, receitas_com_data_estranha: rec.data ?? [], contas_com_data_estranha: con.data ?? [], parcelas_com_valor_zero: zero.data ?? [] },
      pedido: 'Conferência semanal de lançamentos para a gestão. Seções, só as que tiverem conteúdo: "Possíveis duplicados" (cada par, em uma linha, e por que parece duplicado; lembre que é POSSÍVEL duplicado, conferir antes de excluir); "Datas estranhas" (ano errado, como 0026 ou 0202, com a data provável); "Parcelas sem valor". Diga em qual tela corrigir cada tipo. Se não houver nada, diga em uma linha que a semana está limpa.',
    }
  }
  if (tipo === 'vendas' && publico === 'gestao') {
    return {
      tipo, publico,
      titulo: `Vendas da semana · ${br(hoje)}`,
      dados: await vendasDaSemana(sb, hoje),
      pedido: 'Resumo de vendas da semana para a direção: orçamentos novos, enviados, fechados e perdidos (quantidade e valor), eventos confirmados na semana e pré-eventos novos. Em uma linha, a taxa de fechamento (fechados sobre fechados + perdidos) quando houver. Termine com 3 sugestões práticas para a próxima semana, baseadas só nesses números.',
    }
  }
  if (tipo === 'fechamento' && publico === 'gestao') {
    const mes = mesAnterior(hoje)
    const conferencia = await ferramenta(sb, 'conferir_mes', { mes }, publico)
    return {
      tipo, publico,
      titulo: `Pré-fechamento de ${mes.split('-').reverse().join('/')}`,
      dados: { mes, conferencia },
      pedido: `Pré-fechamento do mês ${mes} para a gestão: por espaço, entradas, despesas e retiradas em linhas curtas, e principalmente as pendências que travam o fechamento (o que é e onde corrigir). Deixe claro que o fechamento oficial é feito na tela Financeiro.`,
    }
  }
  return null
}

const SISTEMA = `Você é o assistente interno do sistema da Espaços & Locações (locação de espaços para eventos em São Paulo: Fabrique, Usine, House Pacaembu, Espaço Solon, Complexo Jussara). Você escreve resumos automáticos que a equipe lê no celular logo cedo.
Regras:
- Português do Brasil, frases curtas, listas com "•", valores em R$ com vírgula, datas DD/MM. Sem markdown (nada de **, # ou tabelas). Títulos de seção em uma linha própria, terminando com ":".
- Use só os dados recebidos. Nunca invente evento, valor ou data. Se uma seção não tem nada, não escreva a seção.
- Seja curto: no máximo 30 linhas no total.
- Não fale de exigências legais, normas ou alvarás: isso só quando alguém perguntar ao assistente.`

async function escrever(client: Anthropic, r: Rotina): Promise<string> {
  const msg = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 8000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: [{ model: 'claude-opus-4-8' }],
    system: [{ type: 'text', text: SISTEMA }],
    output_config: { effort: 'medium' },
    messages: [{ role: 'user', content: `${r.pedido}\n\n<dados>\n${JSON.stringify(r.dados).slice(0, 60000)}\n</dados>` }],
  })
  if (msg.stop_reason === 'refusal') throw new Error('A IA não escreveu este resumo.')
  return msg.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text').map(b => b.text).join('\n').trim()
}

// Gera e grava as rotinas do dia. Cada rotina é independente: uma falha não
// derruba as outras (fica gravado o aviso de erro no lugar do texto).
export async function gerarRotinas(sb: SupabaseClient, apiKey: string, hoje = hojeSP(), tipos = rotinasDoDia(hoje)) {
  const client = new Anthropic({ apiKey })
  const pedidos = tipos.flatMap(t => (['gestao', 'operacao'] as Publico[]).map(p => ({ t, p })))
  const feitos = await Promise.all(pedidos.map(async ({ t, p }) => {
    try {
      const r = await montar(sb, t, p, hoje)
      if (!r) return null
      let texto: string
      try { texto = await escrever(client, r) } catch (e) { texto = `Não foi possível escrever este resumo agora (${e instanceof Error ? e.message : 'erro'}). Use "Gerar agora" para tentar de novo.` }
      const { error } = await sb.from('assistente_rotinas').upsert(
        { tipo: r.tipo, publico: r.publico, data: hoje, titulo: r.titulo, texto, dados: r.dados, perfis: PERFIS[r.publico], created_at: new Date().toISOString() },
        { onConflict: 'tipo,publico,data' },
      )
      if (error) throw error
      return `${t}/${p}`
    } catch (e) {
      console.error('[rotinas]', t, p, e)
      return `${t}/${p}: erro (${e instanceof Error ? e.message : 'erro'})`
    }
  }))
  return feitos.filter(Boolean)
}
