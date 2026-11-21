// Ferramentas do Assistente de IA (aba Consultas). Rodam no servidor com a
// sessão de quem pergunta: o banco (RLS) só devolve o que essa pessoa já pode
// ver, e a lista de ferramentas também depende do perfil. Nenhuma ferramenta
// grava nada: ações (ex.: pré-reservar) voltam como proposta e só acontecem
// quando a pessoa clica em Confirmar na tela.

import type Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import { canAccess, veValoresAReceber } from '@/lib/auth'
import type { NivelAcesso } from '@/types'

type Tool = Anthropic.Beta.BetaTool
type Entrada = Record<string, unknown>

export interface AcaoProposta {
  tipo: 'pre_evento'
  cliente: string
  telefone?: string
  espaco: string // nome do espaço no sistema
  data: string
  pessoas?: number
  valor?: number
  nomeEvento?: string
  observacoes?: string
}

interface Ferramenta {
  definicao: Tool
  pode: (role: NivelAcesso) => boolean
  executar: (sb: SupabaseClient, e: Entrada, ctx: { role: NivelAcesso; acoes: AcaoProposta[] }) => Promise<unknown>
}

const ISO = /^\d{4}-\d{2}-\d{2}$/
const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const norm = (s?: string | null) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
const hojeSP = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
const dias = (a: string, b: string) => Math.abs((Date.parse(a) - Date.parse(b)) / 86400000)
const LIMITE = 200

// Junta várias consultas simples (sem filtro "or"), sem repetir linhas.
async function juntar<T extends { id: string }>(consultas: PromiseLike<{ data: T[] | null; error: unknown }>[]): Promise<T[]> {
  const rs = await Promise.all(consultas)
  const vistos = new Map<string, T>()
  for (const r of rs) {
    if (r.error) throw r.error
    for (const x of r.data ?? []) vistos.set(x.id, x)
  }
  return [...vistos.values()]
}

function periodo(e: Entrada, padraoDias = 31): { de: string; ate: string } {
  const de = ISO.test(texto(e.de)) ? texto(e.de) : hojeSP()
  let ate = ISO.test(texto(e.ate)) ? texto(e.ate) : ''
  if (!ate) {
    const d = new Date(de + 'T12:00:00')
    d.setDate(d.getDate() + padraoDias)
    ate = d.toISOString().slice(0, 10)
  }
  return { de, ate }
}

async function espacos(sb: SupabaseClient) {
  const { data, error } = await sb.from('espacos').select('id, slug, nome')
  if (error) throw error
  return (data ?? []) as { id: string; slug: string; nome: string }[]
}

// "fabrique", "Fabrique", "espaço solon" → id
async function filtroEspaco(sb: SupabaseClient, v: unknown) {
  const todos = await espacos(sb)
  const nomes = new Map(todos.map(e => [e.id, e.nome]))
  const q = norm(texto(v))
  if (!q) return { id: undefined as string | undefined, nomes }
  const achado = todos.find(e => norm(e.slug) === q || norm(e.nome) === q) ?? todos.find(e => norm(e.nome).includes(q) || q.includes(norm(e.nome)))
  if (!achado) throw new Error(`Espaço "${texto(v)}" não encontrado. Espaços: ${todos.map(e => e.nome).join(', ')}.`)
  return { id: achado.id, nomes }
}

const FERRAMENTAS: Record<string, Ferramenta> = {
  consultar_agenda: {
    pode: r => canAccess(r, 'agenda') || canAccess(r, 'eventos'),
    definicao: {
      name: 'consultar_agenda',
      description: 'Lista eventos e pré-eventos (em negociação) da agenda num período. Use para saber se uma data está livre, o que tem na semana, eventos de um cliente etc. Datas em AAAA-MM-DD; sem "ate", busca 31 dias a partir de "de".',
      input_schema: {
        type: 'object',
        properties: {
          de: { type: 'string', description: 'Data inicial AAAA-MM-DD (padrão: hoje)' },
          ate: { type: 'string', description: 'Data final AAAA-MM-DD' },
          espaco: { type: 'string', description: 'Nome do espaço (opcional)' },
          status: { type: 'string', enum: ['confirmado', 'em_negociacao', 'cancelado', 'todos'], description: 'Padrão: confirmados e em negociação' },
          cliente: { type: 'string', description: 'Parte do nome do cliente (opcional)' },
        },
      },
    },
    async executar(sb, e, { role }) {
      const { de, ate } = periodo(e)
      const { id, nomes } = await filtroEspaco(sb, e.espaco)
      let q = sb.from('eventos').select('id, data, espaco_id, cliente, nome_evento, status, numero_pessoas, valor, hora_inicio, hora_fim').gte('data', de).lte('data', ate).order('data').limit(LIMITE)
      if (id) q = q.eq('espaco_id', id)
      const st = texto(e.status)
      if (st && st !== 'todos') q = q.eq('status', st)
      else if (!st) q = q.neq('status', 'cancelado')
      if (texto(e.cliente)) q = q.ilike('cliente', `%${texto(e.cliente)}%`)
      const { data, error } = await q
      if (error) throw error
      const valores = veValoresAReceber(role)
      return {
        periodo: { de, ate },
        total: data?.length ?? 0,
        eventos: (data ?? []).map(ev => ({
          data: ev.data, espaco: nomes.get(ev.espaco_id), cliente: ev.cliente, evento: ev.nome_evento ?? undefined,
          status: ev.status === 'em_negociacao' ? 'pré-evento (em negociação)' : ev.status,
          pessoas: ev.numero_pessoas ?? undefined,
          horario: ev.hora_inicio && !String(ev.hora_inicio).startsWith('00:00') ? `${String(ev.hora_inicio).slice(0, 5)}–${String(ev.hora_fim).slice(0, 5)}` : undefined,
          ...(valores ? { valor: Number(ev.valor) } : {}),
        })),
      }
    },
  },

  recebimentos: {
    pode: r => veValoresAReceber(r) && r !== 'socio',
    definicao: {
      name: 'recebimentos',
      description: 'Parcelas de clientes (receitas) num período, por vencimento. situacao "vencidos" = não pagas com vencimento antes de hoje (cobranças em atraso). Traz cliente, espaço, valor, vencimento e situação.',
      input_schema: {
        type: 'object',
        properties: {
          situacao: { type: 'string', enum: ['vencidos', 'a_receber', 'recebidos', 'todos'] },
          de: { type: 'string', description: 'AAAA-MM-DD (opcional)' },
          ate: { type: 'string', description: 'AAAA-MM-DD (opcional)' },
          espaco: { type: 'string' },
          cliente: { type: 'string' },
        },
        required: ['situacao'],
      },
    },
    async executar(sb, e) {
      const { id, nomes } = await filtroEspaco(sb, e.espaco)
      const hoje = hojeSP()
      let q = sb.from('receitas').select('id, cliente, descricao, parcela_label, espaco_id, valor, data, data_recebimento, status, evento_id').order('data').limit(LIMITE)
      const sit = texto(e.situacao)
      if (sit === 'vencidos') q = q.neq('status', 'pago').lt('data', hoje)
      else if (sit === 'a_receber') q = q.neq('status', 'pago')
      else if (sit === 'recebidos') q = q.eq('status', 'pago')
      if (ISO.test(texto(e.de))) q = q.gte(sit === 'recebidos' ? 'data_recebimento' : 'data', texto(e.de))
      if (ISO.test(texto(e.ate))) q = q.lte(sit === 'recebidos' ? 'data_recebimento' : 'data', texto(e.ate))
      if (id) q = q.eq('espaco_id', id)
      if (texto(e.cliente)) q = q.ilike('cliente', `%${texto(e.cliente)}%`)
      const { data, error } = await q
      if (error) throw error
      const lista = (data ?? []).map(r => ({
        cliente: r.cliente, espaco: nomes.get(r.espaco_id), parcela: r.parcela_label ?? r.descricao ?? undefined,
        valor: Number(r.valor), vencimento: r.data, recebido_em: r.data_recebimento ?? undefined, situacao: r.status,
        dias_em_atraso: r.status !== 'pago' && r.data < hoje ? Math.round(dias(hoje, r.data)) : undefined,
      }))
      return { total_parcelas: lista.length, soma: Math.round(lista.reduce((s, r) => s + r.valor, 0) * 100) / 100, parcelas: lista }
    },
  },

  lancamentos_duplicados: {
    pode: r => r === 'admin' || r === 'financeiro',
    definicao: {
      name: 'lancamentos_duplicados',
      description: 'Procura lançamentos possivelmente duplicados num período: despesas (contas a pagar) com mesmo espaço, valor e fornecedor/descrição em até 3 dias, ou mesmo comprovante; e receitas com mesmo cliente/evento, valor e data, ou mesmo comprovante. Devolve os pares para a equipe conferir.',
      input_schema: {
        type: 'object',
        properties: {
          de: { type: 'string', description: 'AAAA-MM-DD' },
          ate: { type: 'string', description: 'AAAA-MM-DD' },
          tipo: { type: 'string', enum: ['despesas', 'receitas', 'ambos'] },
        },
        required: ['de', 'ate'],
      },
    },
    async executar(sb, e) {
      const de = texto(e.de), ate = texto(e.ate)
      if (!ISO.test(de) || !ISO.test(ate)) throw new Error('Informe de e ate em AAAA-MM-DD.')
      const tipo = texto(e.tipo) || 'ambos'
      const { nomes } = await filtroEspaco(sb, '')
      const out: Record<string, unknown> = { periodo: { de, ate } }

      if (tipo !== 'receitas') {
        const cols = 'id, descricao, fornecedor, espaco_id, valor, data_vencimento, data_pagamento, status, categoria, comprovante_identificador, serie_id, created_at'
        const ds = await juntar([
          sb.from('contas_pagar').select(cols).gte('data_pagamento', de).lte('data_pagamento', ate).limit(3000),
          sb.from('contas_pagar').select(cols).is('data_pagamento', null).gte('data_vencimento', de).lte('data_vencimento', ate).limit(3000),
        ])
        const pares: unknown[] = []
        for (let i = 0; i < ds.length; i++) for (let j = i + 1; j < ds.length; j++) {
          const a = ds[i], b = ds[j]
          const mesmoComprovante = a.comprovante_identificador && a.comprovante_identificador === b.comprovante_identificador
          const dataA = a.data_pagamento ?? a.data_vencimento, dataB = b.data_pagamento ?? b.data_vencimento
          const parecido = a.espaco_id === b.espaco_id && Number(a.valor) === Number(b.valor) && dias(dataA, dataB) <= 3 &&
            (!a.serie_id || a.serie_id !== b.serie_id) &&
            ((norm(a.fornecedor) && norm(a.fornecedor) === norm(b.fornecedor)) || norm(a.descricao) === norm(b.descricao))
          if (mesmoComprovante || parecido) {
            const f = (x: typeof a) => ({ descricao: x.descricao, fornecedor: x.fornecedor ?? undefined, espaco: nomes.get(x.espaco_id), valor: Number(x.valor), data: x.data_pagamento ?? x.data_vencimento, categoria: x.categoria, lancado_em: x.created_at })
            pares.push({ motivo: mesmoComprovante ? 'mesmo comprovante' : 'mesmo valor, espaço e fornecedor/descrição em até 3 dias', a: f(a), b: f(b) })
            if (pares.length >= 60) break
          }
        }
        out.despesas = { analisadas: ds.length, possiveis_duplicadas: pares }
      }

      if (tipo !== 'despesas') {
        const { data, error } = await sb.from('receitas')
          .select('id, cliente, evento_id, espaco_id, valor, data, data_recebimento, status, parcela_label, comprovante_identificador, created_at')
          .gte('data', de).lte('data', ate).limit(3000)
        if (error) throw error
        const rs = data ?? []
        const pares: unknown[] = []
        for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
          const a = rs[i], b = rs[j]
          const mesmoComprovante = a.comprovante_identificador && a.comprovante_identificador === b.comprovante_identificador
          const parecido = Number(a.valor) === Number(b.valor) && a.data === b.data && a.espaco_id === b.espaco_id &&
            ((a.evento_id && a.evento_id === b.evento_id) || (!a.evento_id && norm(a.cliente) === norm(b.cliente)))
          if (mesmoComprovante || parecido) {
            const f = (x: typeof a) => ({ cliente: x.cliente, parcela: x.parcela_label ?? undefined, espaco: nomes.get(x.espaco_id), valor: Number(x.valor), vencimento: x.data, situacao: x.status, lancado_em: x.created_at })
            pares.push({ motivo: mesmoComprovante ? 'mesmo comprovante' : 'mesmo cliente/evento, valor e data', a: f(a), b: f(b) })
            if (pares.length >= 60) break
          }
        }
        out.receitas = { analisadas: rs.length, possiveis_duplicadas: pares }
      }
      return out
    },
  },

  conferir_mes: {
    pode: r => r === 'admin' || r === 'financeiro',
    definicao: {
      name: 'conferir_mes',
      description: 'Conferência do mês de um espaço (ou de todos), para ajudar no fechamento: entradas recebidas (por competência), despesas pagas, retiradas/repasses dos sócios, e pendências que costumam travar o fechamento (receita paga sem data de recebimento, despesa sem categoria, evento confirmado sem parcelas, parcelas vencidas). Não substitui o fechamento oficial da tela Financeiro.',
      input_schema: {
        type: 'object',
        properties: {
          mes: { type: 'string', description: 'AAAA-MM' },
          espaco: { type: 'string', description: 'Nome do espaço (opcional)' },
        },
        required: ['mes'],
      },
    },
    async executar(sb, e) {
      const mes = texto(e.mes)
      if (!/^\d{4}-\d{2}$/.test(mes)) throw new Error('Informe o mês em AAAA-MM.')
      const de = `${mes}-01`
      const fim = new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0)
      const ate = `${mes}-${String(fim.getDate()).padStart(2, '0')}`
      const { id, nomes } = await filtroEspaco(sb, e.espaco)
      const cRec = 'id, cliente, valor, status, data, data_recebimento, data_competencia, evento_id, espaco_id, tipo_entrada'
      const cDesp = 'id, descricao, fornecedor, valor, status, categoria, data_pagamento, data_vencimento, espaco_id'
      // Competência do mês: data_competencia; sem ela, data de recebimento; sem as duas, vencimento.
      let r1 = sb.from('receitas').select(cRec).gte('data_competencia', de).lte('data_competencia', ate).limit(3000)
      let r2 = sb.from('receitas').select(cRec).is('data_competencia', null).gte('data_recebimento', de).lte('data_recebimento', ate).limit(3000)
      let r3 = sb.from('receitas').select(cRec).is('data_competencia', null).is('data_recebimento', null).gte('data', de).lte('data', ate).limit(3000)
      let d1 = sb.from('contas_pagar').select(cDesp).gte('data_pagamento', de).lte('data_pagamento', ate).limit(3000)
      let d2 = sb.from('contas_pagar').select(cDesp).is('data_pagamento', null).gte('data_vencimento', de).lte('data_vencimento', ate).limit(3000)
      let qRep = sb.from('repasses_socios').select('socio_nome, valor, data, espaco_id').gte('data', de).lte('data', ate).limit(1000)
      let qEv = sb.from('eventos').select('id, cliente, data, valor, status, espaco_id').eq('status', 'confirmado').gte('data', de).lte('data', ate).limit(1000)
      if (id) {
        r1 = r1.eq('espaco_id', id); r2 = r2.eq('espaco_id', id); r3 = r3.eq('espaco_id', id)
        d1 = d1.eq('espaco_id', id); d2 = d2.eq('espaco_id', id); qRep = qRep.eq('espaco_id', id); qEv = qEv.eq('espaco_id', id)
      }
      const [receitas, despesas, rep, evs] = await Promise.all([juntar([r1, r2, r3]), juntar([d1, d2]), qRep, qEv])
      for (const r of [rep, evs]) if (r.error) throw r.error
      const repasses = rep.data ?? [], eventos = evs.data ?? []
      const soma = (xs: { valor: unknown }[]) => Math.round(xs.reduce((s, x) => s + Number(x.valor), 0) * 100) / 100
      const recebidas = receitas.filter(r => r.status === 'pago')
      const pagas = despesas.filter(d => d.status === 'pago')
      const porSocio: Record<string, number> = {}
      for (const r of repasses) porSocio[r.socio_nome] = Math.round(((porSocio[r.socio_nome] ?? 0) + Number(r.valor)) * 100) / 100
      const eventosComParcela = new Set(receitas.map(r => r.evento_id).filter(Boolean))
      let parcelasDoMes: Set<string> = eventosComParcela
      if (eventos.length) {
        const { data: rr } = await sb.from('receitas').select('evento_id').in('evento_id', eventos.map(ev => ev.id))
        parcelasDoMes = new Set((rr ?? []).map(r => r.evento_id))
      }
      const hoje = hojeSP()
      return {
        mes, espaco: id ? nomes.get(id) : 'todos',
        entradas_recebidas: { quantidade: recebidas.length, total: soma(recebidas) },
        entradas_pendentes_do_mes: { quantidade: receitas.length - recebidas.length, total: soma(receitas.filter(r => r.status !== 'pago')) },
        despesas_pagas: { quantidade: pagas.length, total: soma(pagas) },
        resultado_caixa: Math.round((soma(recebidas) - soma(pagas)) * 100) / 100,
        retiradas_e_repasses_por_socio: porSocio,
        pendencias: {
          receita_paga_sem_data_de_recebimento: recebidas.filter(r => !r.data_recebimento).map(r => ({ cliente: r.cliente, valor: Number(r.valor), espaco: nomes.get(r.espaco_id) })),
          despesa_sem_categoria: despesas.filter(d => !d.categoria).map(d => ({ descricao: d.descricao, valor: Number(d.valor), espaco: nomes.get(d.espaco_id) })),
          evento_confirmado_sem_parcelas: eventos.filter(ev => Number(ev.valor) > 0 && !parcelasDoMes.has(ev.id)).map(ev => ({ cliente: ev.cliente, data: ev.data, valor: Number(ev.valor), espaco: nomes.get(ev.espaco_id) })),
          parcelas_vencidas_nao_pagas: receitas.filter(r => r.status !== 'pago' && r.data < hoje).map(r => ({ cliente: r.cliente, vencimento: r.data, valor: Number(r.valor), espaco: nomes.get(r.espaco_id) })),
        },
        observacao: 'Conferência de apoio. O fechamento oficial (fundos, obras, divisão entre sócios) é feito na tela Financeiro.',
      }
    },
  },

  propor_pre_evento: {
    pode: r => canAccess(r, 'agenda'),
    definicao: {
      name: 'propor_pre_evento',
      description: 'Prepara um pré-evento (data segurada na agenda, status em negociação) para a pessoa confirmar na tela. NÃO grava nada: a pessoa precisa clicar em Confirmar. Antes, use consultar_agenda para ver se a data está livre e avise se não estiver.',
      input_schema: {
        type: 'object',
        properties: {
          cliente: { type: 'string' },
          telefone: { type: 'string' },
          espaco: { type: 'string', description: 'Nome do espaço' },
          data: { type: 'string', description: 'AAAA-MM-DD' },
          pessoas: { type: 'integer' },
          valor: { type: 'number', description: 'Valor da locação, se já combinado' },
          nome_evento: { type: 'string' },
          observacoes: { type: 'string' },
        },
        required: ['cliente', 'espaco', 'data'],
      },
    },
    async executar(sb, e, { acoes }) {
      if (!texto(e.cliente)) throw new Error('Falta o nome do cliente.')
      if (!ISO.test(texto(e.data))) throw new Error('Data em AAAA-MM-DD.')
      const { id, nomes } = await filtroEspaco(sb, e.espaco)
      if (!id) throw new Error('Informe o espaço.')
      const acao: AcaoProposta = {
        tipo: 'pre_evento', cliente: texto(e.cliente), telefone: texto(e.telefone) || undefined, espaco: nomes.get(id)!,
        data: texto(e.data), pessoas: typeof e.pessoas === 'number' ? e.pessoas : undefined,
        valor: typeof e.valor === 'number' ? e.valor : undefined, nomeEvento: texto(e.nome_evento) || undefined,
        observacoes: texto(e.observacoes) || undefined,
      }
      acoes.push(acao)
      return { ok: true, mensagem: 'Proposta pronta. Diga à pessoa para conferir e clicar em Confirmar no cartão que aparece abaixo da resposta.' }
    },
  },
}

export function ferramentasDoPerfil(role: NivelAcesso): Tool[] {
  return Object.values(FERRAMENTAS).filter(f => f.pode(role)).map(f => f.definicao)
}

export async function executarFerramenta(nome: string, entrada: Entrada, sb: SupabaseClient, ctx: { role: NivelAcesso; acoes: AcaoProposta[] }) {
  const f = FERRAMENTAS[nome]
  if (!f || !f.pode(ctx.role)) return { erro: 'Ferramenta não disponível para o seu perfil de acesso.' }
  try {
    return await f.executar(sb, entrada ?? {}, ctx)
  } catch (err) {
    return { erro: err instanceof Error ? err.message : (err as { message?: string })?.message ?? 'Erro ao consultar.' }
  }
}
