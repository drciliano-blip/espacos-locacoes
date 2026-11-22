import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import { executarFerramenta, type AcaoProposta } from './ferramentas'
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

interface Rotina { tipo: 'manha' | 'semanal' | 'fechamento'; publico: Publico; titulo: string; dados: Record<string, unknown>; pedido: string }

async function ferramenta(sb: SupabaseClient, nome: string, entrada: Record<string, unknown>, publico: Publico) {
  const acoes: AcaoProposta[] = []
  return executarFerramenta(nome, entrada, sb, { role: PAPEL[publico], acoes })
}

// Que rotinas rodam hoje (segunda = conferência; dia 1º = pré-fechamento).
export function rotinasDoDia(hoje: string): Rotina['tipo'][] {
  const tipos: Rotina['tipo'][] = ['manha']
  if (new Date(hoje + 'T12:00:00Z').getUTCDay() === 1) tipos.push('semanal')
  if (hoje.endsWith('-01')) tipos.push('fechamento')
  return tipos
}

async function montar(sb: SupabaseClient, tipo: Rotina['tipo'], publico: Publico, hoje: string): Promise<Rotina | null> {
  if (tipo === 'manha') {
    const agenda = await ferramenta(sb, 'consultar_agenda', { de: hoje, ate: somar(hoje, 7) }, publico)
    const preEventos = await ferramenta(sb, 'consultar_agenda', { de: hoje, ate: somar(hoje, 90), status: 'em_negociacao' }, publico)
    const dados: Record<string, unknown> = { hoje, agenda_7_dias: agenda, pre_eventos_90_dias: preEventos }
    if (publico === 'gestao') {
      dados.parcelas_vencendo_7_dias = await ferramenta(sb, 'recebimentos', { situacao: 'a_receber', de: hoje, ate: somar(hoje, 7) }, publico)
      dados.parcelas_em_atraso = await ferramenta(sb, 'recebimentos', { situacao: 'vencidos' }, publico)
    }
    return {
      tipo, publico, dados,
      titulo: `Resumo da manhã · ${br(hoje)}`,
      pedido: publico === 'gestao'
        ? 'Resumo da manhã para a gestão (administração e financeiro). Seções, nesta ordem, só as que tiverem conteúdo: "Hoje" (eventos do dia, com espaço e público); "Próximos 7 dias"; "A receber nesta semana" (cliente, valor, vencimento, total); "Em atraso" (os maiores e o total, e quem cobrar primeiro); "Pré-eventos" (os que estão há tempo sem virar evento ou com data próxima: pedir sinal ou liberar a data). Termine com "Para fazer hoje": no máximo 5 itens.'
        : 'Resumo da manhã para a equipe de operação (sem valores financeiros). Seções, só as que tiverem conteúdo: "Hoje" (eventos do dia: espaço, cliente, horário, público); "Próximos 7 dias"; "Pré-eventos com data próxima". Termine com "Para fazer hoje": no máximo 5 itens de operação (montagem, equipe, documentos).',
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
