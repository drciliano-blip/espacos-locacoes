// Ferramentas do Assistente de IA (aba Consultas). Rodam no servidor com a
// sessão de quem pergunta: o banco (RLS) só devolve o que essa pessoa já pode
// ver, e a lista de ferramentas também depende do perfil. Nenhuma ferramenta
// grava nada: ações (ex.: pré-reservar) voltam como proposta e só acontecem
// quando a pessoa clica em Confirmar na tela.

import type Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import { canAccess, veValoresAReceber } from '@/lib/auth'
import type { FichaCliente, NivelAcesso } from '@/types'
import { aplicarPatch } from './calculo-estado'
import { mensagemInicial } from './roteiro'

type Tool = Anthropic.Beta.BetaTool
type Entrada = Record<string, unknown>

export type AcaoProposta =
  | {
      tipo: 'pre_evento'
      cliente: string
      telefone?: string
      espaco: string // nome do espaço no sistema (no chat do atendimento: o slug)
      data: string
      pessoas?: number
      valor?: number
      nomeEvento?: string
      observacoes?: string
    }
  // Abre o painel do evento já na ação pedida (contrato, cancelar, reagendar, converter).
  | { tipo: 'evento'; eventoId: string; acao: 'gerar_contrato' | 'cancelar' | 'reagendar' | 'converter' | 'ver'; novaData?: string; resumo: string }
  // Abre a janela "Editar parcela" para dar baixa.
  | { tipo: 'baixa'; receitaId: string; resumo: string; dataPagamento?: string; forma?: string }
  // Abre "Novo Evento" preenchido com a ficha do cliente (depois oferece gerar o contrato).
  | { tipo: 'cadastro_evento'; ficha: FichaCliente; resumo: string }
  // Abre o atendimento (chat do cliente) criado com os dados, para montar o orçamento.
  // Novo orçamento: o atendimento só é criado quando a pessoa toca no cartão.
  | { tipo: 'atendimento'; atendimentoId?: string; novo?: { titulo: string; estado: Record<string, unknown>; mensagens: Record<string, unknown>[]; espaco_slug: string | null; data_evento: string | null }; resumo: string }
  // Abre "Nova Conta a Pagar" já preenchida.
  | { tipo: 'conta'; campos: { descricao: string; valor: number; vencimento: string; categoria: string; subcategoria: string; espaco: string; fornecedor?: string; observacoes?: string }; resumo: string }

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
        ...((data?.length ?? 0) >= LIMITE ? { aviso: `Mostrando só os primeiros ${LIMITE} eventos do período: pode haver mais. Peça um período menor.` } : {}),
        eventos: (data ?? []).map(ev => ({
          id: ev.id, data: ev.data, espaco: nomes.get(ev.espaco_id), cliente: ev.cliente, evento: ev.nome_evento ?? undefined,
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
      // Busca até 5.000 para o total sair certo; a lista mostrada à IA vai até 200.
      let q = sb.from('receitas').select('id, cliente, descricao, parcela_label, espaco_id, valor, data, data_recebimento, status, evento_id').order('data').limit(5000)
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
        id: r.id, cliente: r.cliente, espaco: nomes.get(r.espaco_id), parcela: r.parcela_label ?? r.descricao ?? undefined,
        valor: Number(r.valor), vencimento: r.data, recebido_em: r.data_recebimento ?? undefined, situacao: r.status,
        dias_em_atraso: r.status !== 'pago' && r.data < hoje ? Math.round(dias(hoje, r.data)) : undefined,
      }))
      const soma = Math.round(lista.reduce((s, r) => s + r.valor, 0) * 100) / 100
      return {
        total_parcelas: lista.length, soma, parcelas: lista.slice(0, LIMITE),
        ...(lista.length > LIMITE ? { aviso: `A lista mostra só ${LIMITE} de ${lista.length} parcelas (as de vencimento mais antigo); o total e a soma consideram todas. Para ver as demais, peça um período ou um espaço.` } : {}),
      }
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
  preparar_cadastro_evento: {
    pode: r => r !== 'socio' && r !== 'visualizador' && canAccess(r, 'eventos'),
    definicao: {
      name: 'preparar_cadastro_evento',
      description: 'Cadastra um evento confirmado a partir da ficha do cliente (texto colado, ficha anexada já lida ou dados ditados). Mostra um cartão que abre "Novo Evento" do sistema já preenchido; a pessoa confere, salva e o próprio sistema oferece gerar o contrato em seguida. Para só segurar a data, use pré-evento. Datas em AAAA-MM-DD; valores como texto "16.000,00".',
      input_schema: {
        type: 'object',
        properties: {
          nome_completo: { type: 'string' }, cpf: { type: 'string' }, rg: { type: 'string' }, data_nascimento: { type: 'string', description: 'AAAA-MM-DD' },
          email: { type: 'string' }, telefone: { type: 'string' },
          endereco: { type: 'object', properties: { rua: { type: 'string' }, numero: { type: 'string' }, complemento: { type: 'string' }, bairro: { type: 'string' }, cidade: { type: 'string' }, estado: { type: 'string' }, cep: { type: 'string' } } },
          pessoa_juridica: { type: 'boolean' }, razao_social: { type: 'string' }, nome_fantasia: { type: 'string' }, cnpj: { type: 'string' },
          nome_evento: { type: 'string' }, espaco: { type: 'string' }, tipo_evento: { type: 'string' },
          data_evento: { type: 'string', description: 'AAAA-MM-DD' },
          hora_inicio_montagem: { type: 'string', description: 'HH:MM' }, hora_inicio: { type: 'string', description: 'HH:MM' }, hora_fim: { type: 'string', description: 'HH:MM' },
          valor_locacao: { type: 'string' }, forma_pagamento: { type: 'string' }, valor_sinal: { type: 'string' },
          vencimento_saldo: { type: 'string', description: 'AAAA-MM-DD' },
        },
        required: ['nome_completo', 'data_evento'],
      },
    },
    async executar(sb, e, { acoes }) {
      const data = texto(e.data_evento)
      if (!ISO.test(data)) throw new Error('Data do evento em AAAA-MM-DD.')
      let espaco = texto(e.espaco)
      if (espaco) { const { id, nomes } = await filtroEspaco(sb, espaco); espaco = id ? nomes.get(id) ?? espaco : espaco }
      const end = (e.endereco ?? {}) as Record<string, unknown>
      const ficha: FichaCliente = {
        id: crypto.randomUUID(), criadoEm: new Date().toISOString(),
        nomeCompleto: texto(e.nome_completo), cpf: texto(e.cpf), rg: texto(e.rg) || undefined,
        dataNascimento: ISO.test(texto(e.data_nascimento)) ? texto(e.data_nascimento) : undefined,
        email: texto(e.email), telefoneCelular: texto(e.telefone),
        endereco: { rua: texto(end.rua) || undefined, numero: texto(end.numero) || undefined, complemento: texto(end.complemento) || undefined, bairro: texto(end.bairro) || undefined, cidade: texto(end.cidade) || undefined, estado: texto(end.estado) || undefined, cep: texto(end.cep) || undefined },
        pessoaJuridica: e.pessoa_juridica === true, razaoSocial: texto(e.razao_social) || undefined, nomeFantasia: texto(e.nome_fantasia) || undefined, cnpj: texto(e.cnpj) || undefined,
        nomeEvento: texto(e.nome_evento), espacoDesejado: espaco, tipoEvento: texto(e.tipo_evento), dataEvento: data,
        horaInicioMontagem: texto(e.hora_inicio_montagem) || undefined, horaInicioEvento: texto(e.hora_inicio) || undefined, horaTerminoEvento: texto(e.hora_fim) || undefined,
        valorLocacao: texto(e.valor_locacao) || undefined, formaPagamento: texto(e.forma_pagamento) || undefined, valorSinal: texto(e.valor_sinal) || undefined,
        dataVencimentoSaldo: ISO.test(texto(e.vencimento_saldo)) ? texto(e.vencimento_saldo) : undefined,
      }
      let aviso: string | undefined
      if (espaco) {
        const { id } = await filtroEspaco(sb, espaco)
        if (id) {
          const { data: conflito } = await sb.from('eventos').select('cliente, status').eq('espaco_id', id).eq('data', data).neq('status', 'cancelado')
          if (conflito?.length) aviso = `Atenção: já existe evento nesse espaço em ${data}: ${conflito.map(c => `${c.cliente} (${c.status === 'em_negociacao' ? 'pré-evento' : c.status})`).join(', ')}. Se for o pré-evento deste cliente, o certo é converter o pré-evento (abrir_evento com acao converter) em vez de cadastrar outro.`
        }
      }
      const faltando = [!ficha.telefoneCelular && 'telefone', !espaco && 'espaço', !ficha.horaInicioEvento && 'horário', !ficha.valorLocacao && 'valor'].filter(Boolean)
      acoes.push({ tipo: 'cadastro_evento', ficha, resumo: `Cadastrar evento: ${ficha.nomeCompleto} · ${espaco || 'espaço a definir'} · ${data.split('-').reverse().join('/')}` })
      return { ok: true, aviso, faltando_na_ficha: faltando, mensagem: 'Cartão mostrado; a pessoa confere, completa o que falta e salva. Depois o sistema oferece gerar o contrato.' }
    },
  },

  abrir_orcamento: {
    pode: r => r === 'admin' || r === 'operacional',
    definicao: {
      name: 'abrir_orcamento',
      description: 'Começa um orçamento para um cliente: mostra um cartão que, ao ser tocado, abre o atendimento (chat do cliente) já com os dados que a pessoa passou; lá o assistente monta o Orçamento de Locação e o de Serviços, os PDFs e as mensagens. Use sempre que pedirem para fazer/montar/gerar um orçamento.',
      input_schema: {
        type: 'object',
        properties: {
          cliente: { type: 'string' }, empresa: { type: 'string' }, telefone: { type: 'string' },
          tipo_evento: { type: 'string' }, data: { type: 'string', description: 'AAAA-MM-DD' },
          convidados: { type: 'integer' }, espaco: { type: 'string', description: 'Nome do espaço' },
          pedido: { type: 'string', description: 'O que mais a pessoa pediu (buffet, serviços, observações), em uma frase' },
        },
      },
    },
    async executar(sb, e, { acoes }) {
      const { estado, avisos } = aplicarPatch({}, {
        cliente: texto(e.cliente) || undefined, empresa: texto(e.empresa) || undefined, telefone: texto(e.telefone) || undefined,
        tipo_evento: texto(e.tipo_evento) || undefined, data: ISO.test(texto(e.data)) ? texto(e.data) : undefined,
        convidados: typeof e.convidados === 'number' ? e.convidados : undefined, espaco: texto(e.espaco) || undefined,
      }, [])
      const titulo = (estado.dados.empresa || estado.dados.cliente || 'Novo atendimento').trim()
      const agora = Date.now()
      const resumoPedido = [estado.dados.cliente || estado.dados.empresa, estado.dados.tipoEvento, estado.dados.data && estado.dados.data.split('-').reverse().join('/'), estado.dados.convidados && `${estado.dados.convidados} pessoas`, texto(e.espaco), texto(e.pedido)].filter(Boolean).join(', ')
      const mensagens = [
        { id: crypto.randomUUID(), autor: 'assistente', texto: 'Atendimento aberto pela conversa do assistente. Escreva aqui o que mais o cliente pediu, ou peça para eu montar o orçamento.', em: new Date(agora).toISOString() },
        { id: crypto.randomUUID(), autor: 'equipe', texto: `Pedido: ${resumoPedido || '(sem detalhes ainda)'}`, em: new Date(agora + 1).toISOString() },
        { id: crypto.randomUUID(), autor: 'assistente', tipo: 'rascunho_cliente', enviada: false, texto: mensagemInicial(), em: new Date(agora + 2).toISOString() },
      ]
      // Nada é gravado aqui: o cartão cria o atendimento quando a pessoa toca nele.
      acoes.push({
        tipo: 'atendimento',
        novo: { titulo, estado: estado as unknown as Record<string, unknown>, mensagens, espaco_slug: estado.slug || null, data_evento: estado.dados.data || null },
        resumo: `Orçamento: ${titulo}${resumoPedido ? ` · ${resumoPedido}` : ''}`,
      })
      return { ok: true, avisos, mensagem: 'Cartão mostrado. Diga à pessoa para tocar nele: o atendimento é aberto e o orçamento montado lá.' }
    },
  },

  abrir_evento: {
    pode: r => r !== 'socio' && r !== 'visualizador' && (canAccess(r, 'agenda') || canAccess(r, 'eventos')),
    definicao: {
      name: 'abrir_evento',
      description: 'Prepara uma ação num evento já cadastrado e mostra um cartão; ao clicar, abre o painel do evento já na tela da ação: gerar_contrato (gera o contrato pela minuta do espaço), cancelar (manter receita, reembolso ou excluir), reagendar (abre a edição com a nova data), converter (pré-evento em evento confirmado) ou ver. Use consultar_agenda antes para achar o id do evento.',
      input_schema: {
        type: 'object',
        properties: {
          evento_id: { type: 'string' },
          acao: { type: 'string', enum: ['gerar_contrato', 'cancelar', 'reagendar', 'converter', 'ver'] },
          nova_data: { type: 'string', description: 'AAAA-MM-DD, só para reagendar' },
        },
        required: ['evento_id', 'acao'],
      },
    },
    async executar(sb, e, { acoes }) {
      const acao = texto(e.acao) as 'gerar_contrato' | 'cancelar' | 'reagendar' | 'converter' | 'ver'
      const { data: ev, error } = await sb.from('eventos').select('id, cliente, data, status, espaco_id').eq('id', texto(e.evento_id)).maybeSingle()
      if (error) throw error
      if (!ev) throw new Error('Evento não encontrado (ou sem acesso). Use consultar_agenda para achar o id.')
      const { nomes } = await filtroEspaco(sb, '')
      if (acao === 'cancelar' && ev.status !== 'confirmado') throw new Error(`Só dá para cancelar evento confirmado (este está ${ev.status}).`)
      if (acao === 'converter' && ev.status !== 'em_negociacao') throw new Error('Este evento não é um pré-evento.')
      if (acao === 'gerar_contrato' && ev.status === 'em_negociacao') throw new Error('Pré-evento ainda não gera contrato: converta em evento confirmado antes.')
      let aviso: string | undefined
      const novaData = texto(e.nova_data)
      if (acao === 'reagendar') {
        if (!ISO.test(novaData)) throw new Error('Informe nova_data em AAAA-MM-DD.')
        const { data: conflito } = await sb.from('eventos').select('cliente, status').eq('espaco_id', ev.espaco_id).eq('data', novaData).neq('status', 'cancelado').neq('id', ev.id)
        if (conflito?.length) aviso = `Atenção: já existe evento nesse espaço em ${novaData}: ${conflito.map(c => `${c.cliente} (${c.status})`).join(', ')}.`
      }
      const rotulo = { gerar_contrato: 'Gerar contrato', cancelar: 'Cancelar evento', reagendar: `Reagendar para ${novaData.split('-').reverse().join('/')}`, converter: 'Converter em evento confirmado', ver: 'Abrir evento' }[acao]
      acoes.push({ tipo: 'evento', eventoId: ev.id, acao, novaData: novaData || undefined, resumo: `${rotulo}: ${ev.cliente} · ${nomes.get(ev.espaco_id) ?? ''} · ${String(ev.data).split('-').reverse().join('/')}` })
      return { ok: true, aviso, mensagem: 'Cartão mostrado; a pessoa abre e confirma na janela do sistema.' }
    },
  },

  preparar_baixa: {
    pode: r => r === 'admin' || r === 'financeiro',
    definicao: {
      name: 'preparar_baixa',
      description: 'Prepara a baixa (registro de pagamento) de uma parcela de cliente. Mostra um cartão com a data e a forma de pagamento já preenchidas e o botão "Confirmar baixa", que grava com um toque de quem confere (com "Desfazer"); "Abrir para ajustar" abre a janela "Editar parcela" para pagamento parcial, repasse de sócio ou anexar comprovante. Use recebimentos para achar o id. Uma chamada por parcela (várias parcelas = várias chamadas). Preencha data e forma pelo comprovante ou pelo que a pessoa disse.',
      input_schema: {
        type: 'object',
        properties: {
          receita_id: { type: 'string' },
          data_pagamento: { type: 'string', description: 'AAAA-MM-DD; se não souber, deixe em branco (o cartão usa hoje)' },
          forma_pagamento: { type: 'string', enum: ['PIX', 'Transferência', 'Dinheiro', 'Cartão de Crédito', 'Cartão de Débito', 'Cheque'] },
        },
        required: ['receita_id'],
      },
    },
    async executar(sb, e, { acoes }) {
      const { data: r, error } = await sb.from('receitas').select('id, cliente, valor, data, status, parcela_label, descricao').eq('id', texto(e.receita_id)).maybeSingle()
      if (error) throw error
      if (!r) throw new Error('Parcela não encontrada (ou sem acesso).')
      if (r.status === 'pago') throw new Error('Esta parcela já está paga.')
      const dataPagamento = ISO.test(texto(e.data_pagamento)) ? texto(e.data_pagamento) : undefined
      acoes.push({ tipo: 'baixa', receitaId: r.id, dataPagamento, forma: texto(e.forma_pagamento) || undefined, resumo: `Dar baixa: ${r.cliente} · ${r.parcela_label ?? r.descricao ?? 'parcela'} · R$ ${Number(r.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} · venc. ${String(r.data).split('-').reverse().join('/')}` })
      return { ok: true, mensagem: 'Cartão mostrado; a pessoa confere data e forma e toca em "Confirmar baixa". Ainda NÃO está paga: não diga que deu baixa.' }
    },
  },

  preparar_conta_pagar: {
    pode: r => r === 'admin' || r === 'financeiro',
    definicao: {
      name: 'preparar_conta_pagar',
      description: 'Prepara uma nova conta a pagar (despesa, pendente) com os dados que a pessoa passou ou colou (boleto, nota, mensagem). Mostra um cartão com "Lançar agora" (grava com um toque, com "Desfazer"; o cartão avisa se parecer duplicada) e "Abrir para ajustar" (abre "Nova Conta a Pagar" preenchida, para anexar o documento). Retirada de sócio e fundo de caixa só pela tela. Não marca como paga.',
      input_schema: {
        type: 'object',
        properties: {
          descricao: { type: 'string' },
          valor: { type: 'number' },
          vencimento: { type: 'string', description: 'AAAA-MM-DD' },
          categoria: { type: 'string', enum: ['operacional', 'obra', 'financeiro', 'retirada_socio', 'fundo_caixa', 'reembolso_evento'] },
          subcategoria: { type: 'string', enum: ['aluguel', 'energia', 'agua', 'iptu', 'internet', 'funcionários', 'manutenção', 'fornecedores', 'extras', 'outros', 'despesa_a_comprovar'] },
          espaco: { type: 'string', description: 'Nome do espaço' },
          fornecedor: { type: 'string' },
          observacoes: { type: 'string' },
        },
        required: ['descricao', 'valor', 'vencimento', 'categoria', 'subcategoria', 'espaco'],
      },
    },
    async executar(sb, e, { acoes }) {
      const valor = Number(e.valor)
      if (!(valor > 0)) throw new Error('Valor inválido.')
      if (!ISO.test(texto(e.vencimento))) throw new Error('Vencimento em AAAA-MM-DD.')
      const { id, nomes } = await filtroEspaco(sb, e.espaco)
      if (!id) throw new Error('Informe o espaço da despesa.')
      const campos = {
        descricao: texto(e.descricao), valor, vencimento: texto(e.vencimento), categoria: texto(e.categoria), subcategoria: texto(e.subcategoria),
        espaco: nomes.get(id)!, fornecedor: texto(e.fornecedor) || undefined, observacoes: texto(e.observacoes) || undefined,
      }
      acoes.push({ tipo: 'conta', campos, resumo: `Nova conta: ${campos.descricao} · R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} · venc. ${campos.vencimento.split('-').reverse().join('/')} · ${campos.espaco}` })
      return { ok: true, mensagem: 'Cartão mostrado; a pessoa confere e toca em "Lançar agora". Ainda NÃO está lançada: não diga que lançou.' }
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
