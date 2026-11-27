// Ferramentas do Assistente de IA — Ondas 1 e 2 (27/11/2026): editar evento,
// contas a pagar, cobrança, documentos, datas livres, fechamento, conciliação
// pelo extrato, aporte/retirada, relatórios e plano de pagamento.
//
// Mesmas regras de ferramentas.ts: rodam com a sessão de quem pergunta (o banco
// só devolve o que ela pode ver), a lista depende do perfil e NADA grava daqui.
// Ações voltam como cartão; quem confere toca para gravar ou abrir a tela.

import { canAccess, veValoresAReceber } from '@/lib/auth'
import { DIVISAO_SOCIOS } from '@/lib/socios-config'
import type { NivelAcesso } from '@/types'
import { conferirMes, type AlteracoesEvento } from './ferramentas'
import {
  ISO, LIMITE, arred, br, brl, dias, filtroEspaco, fimDoMes, hojeSP, juntar, norm, parecido, somarDias, texto, todasAsLinhas,
  type Ferramenta,
} from './ferramentas-util'

const ehFinanceiro = (r: NivelAcesso) => r === 'admin' || r === 'financeiro'
const DIAS_SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
const DIA_CAP = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const diaDaSemana = (iso: string) => new Date(iso + 'T12:00:00').getDay()
const hora = (v: unknown) => { const t = texto(v); return /^\d{1,2}:\d{2}$/.test(t) ? t.padStart(5, '0') : '' }
const numero = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() && !Number.isNaN(Number(v)) ? Number(v) : undefined)

// Categorias que não são despesa operacional (mesma regra do fechamento).
const NAO_OPERACIONAL = ['fundo_caixa', 'retirada_socio', 'obra']

export const FERRAMENTAS_EXTRA: Record<string, Ferramenta> = {
  // ─── Onda 1 ────────────────────────────────────────────────────────────────

  editar_evento: {
    pode: r => r !== 'socio' && r !== 'visualizador' && (canAccess(r, 'agenda') || canAccess(r, 'eventos')),
    definicao: {
      name: 'editar_evento',
      description: 'Prepara a alteração de dados de um evento ou pré-evento já cadastrado (horário, montagem, número de pessoas, nome do evento, contato, responsável, observações, tipo, decoração, vistoria, valor). Mostra um cartão com o antes → depois: "Confirmar alteração" grava com um toque (com Desfazer) e "Abrir para ajustar" abre a edição do evento preenchida. Mudar a DATA é reagendar (abrir_evento). Mande só os campos que mudam. Use consultar_agenda antes para achar o id.',
      input_schema: {
        type: 'object',
        properties: {
          evento_id: { type: 'string' },
          hora_inicio: { type: 'string', description: 'HH:MM' },
          hora_fim: { type: 'string', description: 'HH:MM' },
          hora_inicio_montagem: { type: 'string', description: 'HH:MM' },
          numero_pessoas: { type: 'integer' },
          nome_evento: { type: 'string' },
          cliente: { type: 'string', description: 'Só para corrigir o nome do cliente' },
          telefone: { type: 'string' },
          email: { type: 'string' },
          responsavel: { type: 'string' },
          observacoes: { type: 'string', description: 'Texto a ACRESCENTAR às observações (não apaga as atuais)' },
          observacoes_tecnicas: { type: 'string', description: 'Texto a ACRESCENTAR às observações técnicas' },
          tipo_evento: { type: 'string', enum: ['Festivo', 'Corporativo', 'Audiovisual', 'Locação Portaria'] },
          decoracao: { type: 'string', enum: ['própria', 'terceirizada', 'não aplicável'] },
          status_vistoria: { type: 'string', enum: ['pendente', 'aprovada', 'aprovada com ressalvas', 'reprovada', 'não realizada'] },
          valor: { type: 'number', description: 'Valor negociado (só admin/financeiro; em evento com plano de pagamento o valor segue o plano: use propor_plano)' },
        },
        required: ['evento_id'],
      },
    },
    async executar(sb, e, { role, acoes }) {
      const { data: ev, error } = await sb.from('eventos')
        .select('id, cliente, data, status, espaco_id, hora_inicio, hora_fim, hora_inicio_montagem, numero_pessoas, nome_evento, telefone_contato, email, responsavel, observacoes, observacoes_tecnicas, tipo_evento, decoracao, status_vistoria, valor, tipo_contrato')
        .eq('id', texto(e.evento_id)).maybeSingle()
      if (error) throw error
      if (!ev) throw new Error('Evento não encontrado (ou sem acesso). Use consultar_agenda para achar o id.')
      if (ev.status === 'cancelado') throw new Error('Evento cancelado: reative pela tela antes de alterar.')

      const alt: AlteracoesEvento = {}
      const mudancas: string[] = []
      const mudar = (campo: keyof AlteracoesEvento, rotulo: string, novo: string | number | undefined, atual: unknown) => {
        if (novo === undefined || novo === '' || String(novo) === String(atual ?? '')) return
        alt[campo] = novo
        mudancas.push(`${rotulo}: ${atual === null || atual === undefined || atual === '' ? '(vazio)' : String(atual)} → ${novo}`)
      }
      const hi = hora(e.hora_inicio), hf = hora(e.hora_fim), hm = hora(e.hora_inicio_montagem)
      if ((e.hora_inicio && !hi) || (e.hora_fim && !hf) || (e.hora_inicio_montagem && !hm)) throw new Error('Horário em HH:MM (ex.: 22:00).')
      mudar('horaInicio', 'Início', hi || undefined, String(ev.hora_inicio ?? '').slice(0, 5))
      mudar('horaFim', 'Término', hf || undefined, String(ev.hora_fim ?? '').slice(0, 5))
      mudar('horaInicioMontagem', 'Montagem', hm || undefined, String(ev.hora_inicio_montagem ?? '').slice(0, 5))
      const pessoas = numero(e.numero_pessoas)
      if (pessoas !== undefined && !(pessoas > 0)) throw new Error('Número de pessoas inválido.')
      mudar('numeroPessoas', 'Pessoas', pessoas, ev.numero_pessoas)
      mudar('nomeEvento', 'Nome do evento', texto(e.nome_evento) || undefined, ev.nome_evento)
      mudar('cliente', 'Cliente', texto(e.cliente) || undefined, ev.cliente)
      mudar('telefoneContato', 'Telefone', texto(e.telefone) || undefined, ev.telefone_contato)
      mudar('email', 'E-mail', texto(e.email) || undefined, ev.email)
      mudar('responsavel', 'Responsável', texto(e.responsavel) || undefined, ev.responsavel)
      mudar('tipoEvento', 'Tipo', texto(e.tipo_evento) || undefined, ev.tipo_evento)
      mudar('decoracao', 'Decoração', texto(e.decoracao) || undefined, ev.decoracao)
      mudar('statusVistoria', 'Vistoria', texto(e.status_vistoria) || undefined, ev.status_vistoria)
      const obs = texto(e.observacoes)
      if (obs) { alt.observacoes = [ev.observacoes, obs].filter(Boolean).join('\n'); mudancas.push(`Observações: + "${obs}"`) }
      const obsT = texto(e.observacoes_tecnicas)
      if (obsT) { alt.observacoesTecnicas = [ev.observacoes_tecnicas, obsT].filter(Boolean).join('\n'); mudancas.push(`Obs. técnicas: + "${obsT}"`) }

      let aviso: string | undefined
      const valor = numero(e.valor)
      if (valor !== undefined) {
        if (!veValoresAReceber(role) || role === 'socio') throw new Error('O seu perfil não altera valores. Peça ao financeiro ou ao administrador.')
        if (!(valor >= 0)) throw new Error('Valor inválido.')
        if (ev.tipo_contrato !== 'parceria') {
          const { count } = await sb.from('receitas').select('id', { count: 'exact', head: true }).eq('evento_id', ev.id).not('parcela_numero', 'is', null)
          if ((count ?? 0) > 0) throw new Error('Este evento tem plano de pagamento: o valor segue a soma das parcelas. Para mudar o valor, use propor_plano com as novas parcelas.')
        }
        mudar('valor', 'Valor', valor, Number(ev.valor))
      }
      if (!mudancas.length) throw new Error('Nada a alterar: os dados pedidos já são os atuais.')
      const ini = String(alt.horaInicio ?? ev.hora_inicio ?? ''), fim = String(alt.horaFim ?? ev.hora_fim ?? '')
      if (ev.status === 'confirmado' && (ini.startsWith('00:00') || fim.startsWith('00:00') || !ini || !fim)) {
        aviso = 'O evento ainda está sem horário de início/término. A tela exige os dois para salvar: peça o horário que falta (o cartão só grava com os dois).'
      }
      const { nomes } = await filtroEspaco(sb, '')
      acoes.push({ tipo: 'editar_evento', eventoId: ev.id, alteracoes: alt, mudancas, resumo: `Alterar evento: ${ev.cliente} · ${nomes.get(ev.espaco_id) ?? ''} · ${br(ev.data)}` })
      return { ok: true, mudancas, aviso, mensagem: 'Cartão mostrado com o antes → depois. Ainda NÃO foi alterado: a pessoa toca em "Confirmar alteração".' }
    },
  },

  contas_a_pagar: {
    pode: ehFinanceiro,
    definicao: {
      name: 'contas_a_pagar',
      description: 'Lista contas a pagar (despesas) por situação: "atrasadas" (não pagas e vencidas), "a_vencer" (não pagas, vencimento de hoje em diante), "pendentes" (todas não pagas), "pagas" (por data de pagamento) ou "todas". Filtros: período, espaço, fornecedor/descrição. Traz id, descrição, fornecedor, espaço, valor, vencimento, pagamento e categoria. Use para "o que vence essa semana", "o que está atrasado", "já paguei a luz?".',
      input_schema: {
        type: 'object',
        properties: {
          situacao: { type: 'string', enum: ['atrasadas', 'a_vencer', 'pendentes', 'pagas', 'todas'] },
          de: { type: 'string', description: 'AAAA-MM-DD (vencimento; para pagas, data do pagamento)' },
          ate: { type: 'string', description: 'AAAA-MM-DD' },
          espaco: { type: 'string' },
          busca: { type: 'string', description: 'Parte da descrição ou do fornecedor' },
        },
        required: ['situacao'],
      },
    },
    async executar(sb, e) {
      const { id, nomes } = await filtroEspaco(sb, e.espaco)
      const hoje = hojeSP()
      const sit = texto(e.situacao)
      const campoData = sit === 'pagas' ? 'data_pagamento' : 'data_vencimento'
      const linhas = await todasAsLinhas<Record<string, unknown>>((a, b) => {
        let q = sb.from('contas_pagar').select('id, descricao, fornecedor, espaco_id, valor, data_vencimento, data_pagamento, status, categoria, subcategoria').order(campoData).range(a, b)
        if (sit === 'pagas') q = q.eq('status', 'pago')
        else if (sit !== 'todas') q = q.neq('status', 'pago')
        if (sit === 'atrasadas') q = q.lt('data_vencimento', hoje)
        if (sit === 'a_vencer') q = q.gte('data_vencimento', hoje)
        if (ISO.test(texto(e.de))) q = q.gte(campoData, texto(e.de))
        if (ISO.test(texto(e.ate))) q = q.lte(campoData, texto(e.ate))
        if (id) q = q.eq('espaco_id', id)
        return q
      }, 5000)
      const busca = norm(texto(e.busca))
      const lista = linhas
        .filter(c => !busca || norm(String(c.descricao)).includes(busca) || norm(String(c.fornecedor ?? '')).includes(busca))
        .map(c => ({
          id: c.id, descricao: c.descricao, fornecedor: c.fornecedor ?? undefined, espaco: c.espaco_id ? nomes.get(String(c.espaco_id)) : 'Todos',
          valor: Number(c.valor), vencimento: c.data_vencimento, pago_em: c.data_pagamento ?? undefined, categoria: c.categoria,
          situacao: c.status === 'pago' ? 'paga' : String(c.data_vencimento) < hoje ? 'atrasada' : 'a vencer',
          dias_em_atraso: c.status !== 'pago' && String(c.data_vencimento) < hoje ? Math.round(dias(hoje, String(c.data_vencimento))) : undefined,
        }))
      return {
        total_contas: lista.length, soma: arred(lista.reduce((s, c) => s + c.valor, 0)), contas: lista.slice(0, LIMITE),
        ...(lista.length > LIMITE ? { aviso: `Mostrando ${LIMITE} de ${lista.length}; o total e a soma consideram todas.` } : {}),
      }
    },
  },

  preparar_baixa_conta: {
    pode: ehFinanceiro,
    definicao: {
      name: 'preparar_baixa_conta',
      description: 'Prepara a baixa (pagamento) de uma conta a pagar JÁ LANÇADA. Use contas_a_pagar para achar o id. Pelo sistema a baixa exige o comprovante: o cartão abre a janela "Dar baixa" da conta, onde a pessoa anexa o comprovante (a IA lê data e hora). Exceção: na conciliação pelo extrato (conciliar_extrato), passe via_extrato=true com a data e o identificador da linha do extrato: aí o cartão grava com um toque, como na tela de Conciliação. Uma chamada por conta.',
      input_schema: {
        type: 'object',
        properties: {
          conta_id: { type: 'string' },
          data_pagamento: { type: 'string', description: 'AAAA-MM-DD (do extrato ou comprovante)' },
          via_extrato: { type: 'boolean' },
          identificador: { type: 'string', description: 'Identificador da transação no extrato, se houver' },
        },
        required: ['conta_id'],
      },
    },
    async executar(sb, e, { acoes }) {
      const { data: c, error } = await sb.from('contas_pagar').select('id, descricao, fornecedor, valor, data_vencimento, status, espaco_id').eq('id', texto(e.conta_id)).maybeSingle()
      if (error) throw error
      if (!c) throw new Error('Conta não encontrada (ou sem acesso). Use contas_a_pagar para achar o id.')
      if (c.status === 'pago') throw new Error('Esta conta já está paga.')
      const data = ISO.test(texto(e.data_pagamento)) ? texto(e.data_pagamento) : undefined
      if (data && data > hojeSP()) throw new Error('Data de pagamento não pode ser futura.')
      const viaExtrato = e.via_extrato === true && !!data
      const { nomes } = await filtroEspaco(sb, '')
      acoes.push({
        tipo: 'baixa_conta', contaId: c.id, dataPagamento: data, identificador: texto(e.identificador) || undefined, viaExtrato,
        resumo: `Pagar conta: ${c.descricao}${c.fornecedor ? ` (${c.fornecedor})` : ''} · ${brl(Number(c.valor))} · venc. ${br(c.data_vencimento)} · ${c.espaco_id ? nomes.get(c.espaco_id) : 'Todos'}`,
      })
      return { ok: true, mensagem: viaExtrato ? 'Cartão mostrado: a pessoa confere com o extrato e toca em "Confirmar pagamento".' : 'Cartão mostrado: abre a janela "Dar baixa", onde a pessoa anexa o comprovante. Ainda NÃO está paga.' }
    },
  },

  cobrancas: {
    pode: ehFinanceiro,
    definicao: {
      name: 'cobrancas',
      description: 'Clientes com parcela vencida e não paga, agrupados por evento: cliente, telefone, espaço, data do evento (e se já aconteceu), parcelas e total em atraso. Com incluir_proximos_dias, traz também o que vence nos próximos N dias (para lembrete). Depois, prepare uma mensagem de cobrança por cliente com preparar_mensagem (cordial, com valor e vencimento; nunca ameaçadora).',
      input_schema: {
        type: 'object',
        properties: {
          espaco: { type: 'string' },
          cliente: { type: 'string' },
          incluir_proximos_dias: { type: 'integer', description: 'Ex.: 7 para incluir o que vence na próxima semana' },
        },
      },
    },
    async executar(sb, e) {
      const { id, nomes } = await filtroEspaco(sb, e.espaco)
      const hoje = hojeSP()
      const limite = numero(e.incluir_proximos_dias) ? somarDias(hoje, Math.min(60, Number(e.incluir_proximos_dias))) : undefined
      let q = sb.from('receitas').select('id, cliente, descricao, parcela_label, espaco_id, valor, data, status, evento_id, tipo_entrada').neq('status', 'pago').limit(3000)
      q = limite ? q.lte('data', limite) : q.lt('data', hoje)
      if (id) q = q.eq('espaco_id', id)
      if (texto(e.cliente)) q = q.ilike('cliente', `%${texto(e.cliente)}%`)
      const { data, error } = await q
      if (error) throw error
      const parcelas = (data ?? []).filter(r => (r.tipo_entrada === 'evento' || !r.tipo_entrada) && Number(r.valor) > 0)
      const idsEv = [...new Set(parcelas.map(p => p.evento_id).filter(Boolean))] as string[]
      const evs = new Map<string, Record<string, unknown>>()
      for (let i = 0; i < idsEv.length; i += 200) {
        const { data: lote } = await sb.from('eventos').select('id, data, cliente, nome_evento, telefone_contato, email, status').in('id', idsEv.slice(i, i + 200))
        for (const ev of lote ?? []) evs.set(ev.id, ev)
      }
      const grupos = new Map<string, { cliente: string; espaco?: string; evento?: string; data_evento?: string; evento_ja_aconteceu?: boolean; status_evento?: string; telefone?: string; email?: string; parcelas: unknown[]; em_atraso: number; a_vencer: number }>()
      for (const p of parcelas) {
        const ev = p.evento_id ? evs.get(p.evento_id) : undefined
        const chave = p.evento_id ?? `sem-evento:${norm(p.cliente)}`
        const g = grupos.get(chave) ?? {
          cliente: String(ev?.cliente ?? p.cliente ?? ''), espaco: nomes.get(p.espaco_id), evento: ev?.nome_evento ? String(ev.nome_evento) : undefined,
          data_evento: ev?.data ? String(ev.data) : undefined, evento_ja_aconteceu: ev?.data ? String(ev.data) < hoje : undefined,
          status_evento: ev?.status ? String(ev.status) : undefined, telefone: ev?.telefone_contato ? String(ev.telefone_contato) : undefined,
          email: ev?.email ? String(ev.email) : undefined, parcelas: [], em_atraso: 0, a_vencer: 0,
        }
        const vencida = p.data < hoje
        g.parcelas.push({ receita_id: p.id, parcela: p.parcela_label ?? p.descricao, valor: Number(p.valor), vencimento: p.data, situacao: vencida ? `vencida há ${Math.round(dias(hoje, p.data))} dias` : 'a vencer' })
        if (vencida) g.em_atraso = arred(g.em_atraso + Number(p.valor)); else g.a_vencer = arred(g.a_vencer + Number(p.valor))
        grupos.set(chave, g)
      }
      const lista = [...grupos.values()].filter(g => g.status_evento !== 'cancelado').sort((a, b) => b.em_atraso - a.em_atraso)
      return {
        clientes: lista.length, total_em_atraso: arred(lista.reduce((s, g) => s + g.em_atraso, 0)),
        ...(limite ? { total_a_vencer_ate: { data: limite, valor: arred(lista.reduce((s, g) => s + g.a_vencer, 0)) } } : {}),
        cobrancas: lista.slice(0, 80),
        observacao: 'Evento que já aconteceu com parcela "vencida" pode ter sido pago e não baixado: confira no extrato antes de cobrar.',
      }
    },
  },

  preparar_mensagem: {
    pode: r => r === 'admin' || r === 'financeiro' || r === 'operacional',
    definicao: {
      name: 'preparar_mensagem',
      description: 'Mostra um texto pronto para o staff mandar ao cliente (cobrança, lembrete, datas disponíveis, confirmação). O cartão tem "Copiar" e, com telefone, "Abrir no WhatsApp" (abre o WhatsApp do próprio celular com o texto; o envio é manual). Tom cordial de WhatsApp, até 12 linhas, no máximo 1 ou 2 emojis. Uma chamada por cliente.',
      input_schema: {
        type: 'object',
        properties: {
          titulo: { type: 'string', description: 'Ex.: "Cobrança · Fulano"' },
          texto: { type: 'string' },
          telefone: { type: 'string', description: 'Telefone do cliente com DDD (opcional)' },
        },
        required: ['titulo', 'texto'],
      },
    },
    async executar(_sb, e, { acoes }) {
      const t = texto(e.texto)
      if (!t) throw new Error('Texto vazio.')
      const tel = texto(e.telefone).replace(/\D/g, '')
      acoes.push({ tipo: 'mensagem', titulo: texto(e.titulo) || 'Mensagem para o cliente', texto: t, telefone: tel.length >= 10 ? tel : undefined, resumo: texto(e.titulo) || 'Mensagem para o cliente' })
      return { ok: true, mensagem: 'Cartão com o texto mostrado. Não repita o texto inteiro na resposta.' }
    },
  },

  buscar_documentos: {
    pode: r => r === 'admin' || r === 'financeiro' || r === 'operacional',
    definicao: {
      name: 'buscar_documentos',
      description: 'Procura documentos guardados no sistema (contratos gerados e assinados, comprovantes de pagamento e de sinal, fichas de clientes, minutas, extratos, documentos de credenciamento) pelo nome do arquivo, do cliente ou do evento. Depois use mostrar_documentos com os ids que a pessoa quer abrir.',
      input_schema: {
        type: 'object',
        properties: {
          busca: { type: 'string', description: 'Nome do cliente, do evento ou parte do nome do arquivo' },
          tipo: { type: 'string', enum: ['contrato', 'comprovante', 'ficha', 'minuta', 'extrato', 'credenciamento', 'qualquer'] },
          espaco: { type: 'string' },
        },
        required: ['busca'],
      },
    },
    async executar(sb, e) {
      const termo = texto(e.busca).replace(/[,()%*\\]/g, ' ').trim()
      if (termo.length < 2) throw new Error('Diga o nome do cliente, do evento ou do arquivo.')
      const tipo = texto(e.tipo) || 'qualquer'
      let espacoNome: string | undefined
      if (texto(e.espaco)) { const { id, nomes } = await filtroEspaco(sb, e.espaco); espacoNome = id ? nomes.get(id) : undefined }
      const cols = 'id, name, module, entity_id, entity_name, espaco, categoria, uploaded_at'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filtrar = (q: any) => {
        let x = q
        if (espacoNome) x = x.eq('espaco', espacoNome)
        if (tipo === 'contrato') x = x.in('module', ['contratos', 'agenda'])
        else if (tipo === 'comprovante') x = x.ilike('categoria', '%comprovante%')
        else if (tipo === 'ficha') x = x.eq('module', 'fichas')
        else if (tipo === 'minuta') x = x.ilike('categoria', 'minuta%')
        else if (tipo === 'extrato') x = x.eq('module', 'extratos')
        else if (tipo === 'credenciamento') x = x.eq('module', 'credenciamento')
        return x
      }
      // Pelo nome do arquivo, pelo nome da entidade e pelos eventos do cliente.
      const { data: evs } = await sb.from('eventos').select('id').or(`cliente.ilike.%${termo}%,nome_evento.ilike.%${termo}%`).limit(50)
      const idsEv = (evs ?? []).map(x => x.id as string)
      const consultas = [
        filtrar(sb.from('files').select(cols).ilike('name', `%${termo}%`)).order('uploaded_at', { ascending: false }).limit(40),
        filtrar(sb.from('files').select(cols).ilike('entity_name', `%${termo}%`)).order('uploaded_at', { ascending: false }).limit(40),
        ...(idsEv.length ? [filtrar(sb.from('files').select(cols).in('entity_id', idsEv)).order('uploaded_at', { ascending: false }).limit(40)] : []),
      ]
      const achados = await juntar<{ id: string } & Record<string, unknown>>(consultas)
      achados.sort((a, b) => String(b.uploaded_at).localeCompare(String(a.uploaded_at)))
      return {
        encontrados: achados.length,
        documentos: achados.slice(0, 40).map(f => ({ id: f.id, arquivo: f.name, de: f.entity_name ?? undefined, area: f.module, tipo: f.categoria ?? undefined, espaco: f.espaco ?? undefined, enviado_em: br(String(f.uploaded_at)) })),
      }
    },
  },

  mostrar_documentos: {
    pode: r => r === 'admin' || r === 'financeiro' || r === 'operacional',
    definicao: {
      name: 'mostrar_documentos',
      description: 'Mostra cartões com "Abrir" e "Baixar" para os documentos escolhidos (ids de buscar_documentos). Até 8 por vez.',
      input_schema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'string' } } }, required: ['ids'] },
    },
    async executar(sb, e, { acoes }) {
      const ids = (Array.isArray(e.ids) ? e.ids : []).map(String).slice(0, 8)
      if (!ids.length) throw new Error('Informe os ids.')
      const { data, error } = await sb.from('files').select('id, name, entity_name, categoria').in('id', ids)
      if (error) throw error
      for (const f of data ?? []) acoes.push({ tipo: 'arquivo', fileId: f.id, nome: f.name, resumo: `${f.name}${f.entity_name ? ` · ${f.entity_name}` : ''}` })
      return { ok: true, mostrados: data?.length ?? 0 }
    },
  },

  datas_livres: {
    pode: r => canAccess(r, 'agenda'),
    definicao: {
      name: 'datas_livres',
      description: 'Datas livres de um ou mais espaços num período, com filtro de dias da semana (igual à tela "Consultar Disponibilidade"). Evento confirmado bloqueia; pré-evento não bloqueia mas aparece como pré-reservada. Devolve as datas e um "texto_para_cliente" no formato do "Copiar Datas" (só as livres). Para mandar ao cliente, use preparar_mensagem com esse texto.',
      input_schema: {
        type: 'object',
        properties: {
          espacos: { type: 'array', items: { type: 'string' }, description: 'Nomes dos espaços; vazio = todos' },
          de: { type: 'string', description: 'AAAA-MM-DD' },
          ate: { type: 'string', description: 'AAAA-MM-DD' },
          dias_semana: { type: 'array', items: { type: 'integer' }, description: '0=domingo ... 6=sábado; vazio = todos' },
        },
        required: ['de', 'ate'],
      },
    },
    async executar(sb, e) {
      const de = texto(e.de), ate = texto(e.ate)
      if (!ISO.test(de) || !ISO.test(ate)) throw new Error('Informe de e ate em AAAA-MM-DD.')
      if (ate < de) throw new Error('O período final não pode ser anterior ao inicial.')
      if (dias(de, ate) > 400) throw new Error('Período longo demais (máx. ~13 meses).')
      const { todos } = await filtroEspaco(sb, '')
      const pedidos = (Array.isArray(e.espacos) ? e.espacos : []).map(String).filter(Boolean)
      const alvo = pedidos.length ? await Promise.all(pedidos.map(async p => { const r = await filtroEspaco(sb, p); return todos.find(t => t.id === r.id)! })) : todos
      const diasSem = (Array.isArray(e.dias_semana) ? e.dias_semana : []).map(Number).filter(n => n >= 0 && n <= 6)
      const { data, error } = await sb.from('eventos').select('espaco_id, data, cliente, status, exclusao_solicitada_em')
        .in('espaco_id', alvo.map(a => a.id)).gte('data', de).lte('data', ate).neq('status', 'cancelado').limit(5000)
      if (error) throw error
      const bloq = new Set<string>(), pre = new Map<string, string[]>()
      for (const ev of data ?? []) {
        if (ev.exclusao_solicitada_em) continue
        const k = `${ev.espaco_id}|${ev.data}`
        if (ev.status === 'confirmado') bloq.add(k)
        else if (ev.status === 'em_negociacao') pre.set(k, [...(pre.get(k) ?? []), ev.cliente])
      }
      const datas: string[] = []
      for (let d = de; d <= ate; d = somarDias(d, 1)) if (!diasSem.length || diasSem.includes(diaDaSemana(d))) datas.push(d)
      const resultado = alvo.map(a => {
        const livres = datas.filter(d => !bloq.has(`${a.id}|${d}`) && !pre.has(`${a.id}|${d}`))
        const preReservadas = datas.filter(d => pre.has(`${a.id}|${d}`)).map(d => ({ data: d, dia: DIAS_SEMANA[diaDaSemana(d)], clientes: pre.get(`${a.id}|${d}`) }))
        return { espaco: a.nome, livres: livres.map(d => ({ data: d, dia: DIAS_SEMANA[diaDaSemana(d)] })), pre_reservadas: preReservadas, ocupadas: datas.filter(d => bloq.has(`${a.id}|${d}`)).length }
      })
      // Mesmo formato do "Copiar Datas" da tela Consultar Disponibilidade.
      const blocos = resultado.filter(r => r.livres.length).map(r => {
        const porMes = new Map<string, string[]>()
        for (const l of r.livres) {
          const k = l.data.slice(0, 7)
          porMes.set(k, [...(porMes.get(k) ?? []), `• ${l.data.slice(8, 10)}/${l.data.slice(5, 7)} – ${DIA_CAP[diaDaSemana(l.data)]}`])
        }
        return [`${r.espaco} – Datas disponíveis`, ...[...porMes.entries()].map(([k, ls]) => `\n${MESES[Number(k.slice(5, 7)) - 1]}/${k.slice(0, 4)}\n${ls.join('\n')}`)].join('\n').trimEnd()
      })
      return { periodo: { de, ate }, espacos: resultado, texto_para_cliente: blocos.join('\n\n') || '(nenhuma data livre no período)' }
    },
  },

  // ─── Onda 2 ────────────────────────────────────────────────────────────────

  preparar_fechamento: {
    pode: ehFinanceiro,
    definicao: {
      name: 'preparar_fechamento',
      description: 'Prepara o fechamento do mês de UM espaço: faz a conferência (entradas, despesas, retiradas, pendências que travam), confere se o período já está fechado, se o mês já terminou e se há meses sem fechar antes, e mostra um cartão que abre a tela Financeiro no espaço e no período certos com "Fechar Período" aberto (lá aparecem o resultado oficial e a parte de cada sócio). Quem confere clica em Confirmar na tela. Nunca diga que fechou.',
      input_schema: {
        type: 'object',
        properties: {
          espaco: { type: 'string' },
          mes: { type: 'string', description: 'AAAA-MM' },
        },
        required: ['espaco', 'mes'],
      },
    },
    async executar(sb, e, ctx) {
      const mes = texto(e.mes)
      if (!/^\d{4}-\d{2}$/.test(mes)) throw new Error('Informe o mês em AAAA-MM.')
      const { id, nomes } = await filtroEspaco(sb, e.espaco)
      if (!id) throw new Error('O fechamento é por espaço: informe qual.')
      const espaco = nomes.get(id)!
      const de = `${mes}-01`, ate = fimDoMes(mes)
      const { data: fechs, error } = await sb.from('fechamentos_mensais').select('data_inicio, data_fim, fechado_por_nome, created_at').eq('espaco_id', id).order('data_fim', { ascending: false })
      if (error) throw error
      const bloqueios: string[] = [], avisos: string[] = []
      const sobrepoe = (fechs ?? []).find(f => f.data_inicio <= ate && f.data_fim >= de)
      if (sobrepoe) bloqueios.push(`Período já fechado: ${br(sobrepoe.data_inicio)} a ${br(sobrepoe.data_fim)}${sobrepoe.fechado_por_nome ? ` por ${sobrepoe.fechado_por_nome}` : ''}.`)
      if (ate >= hojeSP()) bloqueios.push('O mês ainda não terminou: só dá para fechar a partir do dia seguinte ao último dia do mês.')
      const ultimo = (fechs ?? [])[0]
      if (ultimo && !sobrepoe && somarDias(ultimo.data_fim, 1) < de) avisos.push(`O último fechamento terminou em ${br(ultimo.data_fim)}: há dias sem fechar entre ele e este mês. Feche na ordem.`)
      if (!ultimo) avisos.push('Primeiro fechamento deste espaço no sistema.')
      const conferencia = await conferirMes(sb, { mes, espaco }, ctx)
      if (!bloqueios.length) ctx.acoes.push({ tipo: 'fechamento', espaco, de, ate, resumo: `Fechar ${MESES[Number(mes.slice(5, 7)) - 1]}/${mes.slice(0, 4)} · ${espaco}` })
      return {
        espaco, periodo: { de, ate }, bloqueios, avisos, conferencia,
        mensagem: bloqueios.length ? 'Não dá para fechar agora: explique os bloqueios.' : 'Cartão mostrado: abre a tela Financeiro com "Fechar Período" aberto, onde a pessoa vê o resultado oficial e a parte de cada sócio e confirma. Resuma a conferência e as pendências antes.',
      }
    },
  },

  conciliar_extrato: {
    pode: ehFinanceiro,
    definicao: {
      name: 'conciliar_extrato',
      description: 'Cruza as linhas de um extrato bancário (lido do anexo) com o que está EM ABERTO no sistema: entradas (valor positivo) com parcelas de clientes não pagas; saídas (valor negativo) com contas a pagar não pagas. Também avisa as linhas que parecem já lançadas como pagas. Devolve, por linha, a melhor sugestão e alternativas. Depois: para entradas com sugestão boa, preparar_baixa (data = data da linha); para saídas, preparar_baixa_conta com via_extrato=true, a data e o identificador. Na dúvida (dois candidatos parecidos), pergunte. Não gera vínculo na tela de Conciliação.',
      input_schema: {
        type: 'object',
        properties: {
          espaco: { type: 'string', description: 'Espaço da conta bancária, se souber' },
          linhas: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                data: { type: 'string', description: 'AAAA-MM-DD' },
                descricao: { type: 'string' },
                valor: { type: 'number', description: 'Positivo = entrada (crédito); negativo = saída (débito)' },
                identificador: { type: 'string' },
              },
              required: ['data', 'valor'],
            },
          },
        },
        required: ['linhas'],
      },
    },
    async executar(sb, e) {
      const linhas = (Array.isArray(e.linhas) ? e.linhas : []).slice(0, 150)
        .map(l => l as Record<string, unknown>)
        .filter(l => ISO.test(texto(l.data)) && typeof l.valor === 'number' && l.valor !== 0)
      if (!linhas.length) throw new Error('Nenhuma linha válida (data AAAA-MM-DD e valor diferente de zero).')
      const { id, nomes } = await filtroEspaco(sb, e.espaco)
      const datas = linhas.map(l => texto(l.data)).sort()
      const min = somarDias(datas[0], -90), max = somarDias(datas[datas.length - 1], 90)
      let qr = sb.from('receitas').select('id, cliente, descricao, parcela_label, espaco_id, valor, data, status, data_recebimento').gte('data', min).lte('data', max).limit(5000)
      let qc = sb.from('contas_pagar').select('id, descricao, fornecedor, espaco_id, valor, data_vencimento, data_pagamento, status').gte('data_vencimento', min).lte('data_vencimento', max).limit(5000)
      if (id) { qr = qr.eq('espaco_id', id); qc = qc.eq('espaco_id', id) }
      const [rr, rc] = await Promise.all([qr, qc])
      if (rr.error) throw rr.error
      if (rc.error) throw rc.error
      const receitas = rr.data ?? [], contas = rc.data ?? []
      const usados = new Set<string>()
      const resultado = linhas.map((l, i) => {
        const v = Math.abs(Number(l.valor)), data = texto(l.data), desc = texto(l.descricao)
        const entrada = Number(l.valor) > 0
        const base = { linha: i + 1, data, descricao: desc || undefined, valor: Number(l.valor), identificador: texto(l.identificador) || undefined }
        type Cand = { id: string; quem: string; valor: number; vencimento: string; espaco?: string; pontos: number; pago?: string | null }
        const cands: Cand[] = entrada
          ? receitas.filter(r => Math.abs(Number(r.valor) - v) < 0.01).map(r => ({ id: r.id, quem: `${r.cliente ?? ''} · ${r.parcela_label ?? r.descricao ?? ''}`, valor: Number(r.valor), vencimento: r.data, espaco: nomes.get(r.espaco_id), pago: r.status === 'pago' ? r.data_recebimento : null, pontos: 0 }))
          : contas.filter(c => Math.abs(Number(c.valor) - v) < 0.01).map(c => ({ id: c.id, quem: `${c.descricao}${c.fornecedor ? ` (${c.fornecedor})` : ''}`, valor: Number(c.valor), vencimento: c.data_vencimento, espaco: c.espaco_id ? nomes.get(c.espaco_id) : 'Todos', pago: c.status === 'pago' ? c.data_pagamento : null, pontos: 0 }))
        // Já lançado como pago perto dessa data?
        const jaPago = cands.find(c => c.pago && dias(String(c.pago), data) <= 3)
        if (jaPago) return { ...base, situacao: 'parece já lançado como pago', lancamento: { quem: jaPago.quem, pago_em: br(String(jaPago.pago)) } }
        const abertos = cands.filter(c => !c.pago && !usados.has(c.id))
        for (const c of abertos) {
          const dist = dias(c.vencimento, data)
          c.pontos = Math.round((40 + Math.max(0, 30 - dist) + 30 * parecido(desc, c.quem)) * 10) / 10
        }
        abertos.sort((a, b) => b.pontos - a.pontos)
        if (!abertos.length) return { ...base, situacao: entrada ? 'sem parcela em aberto com esse valor' : 'sem conta em aberto com esse valor' }
        const melhor = abertos[0]
        const empate = abertos[1] && abertos[1].pontos >= melhor.pontos - 5
        if (!empate) usados.add(melhor.id)
        return {
          ...base,
          situacao: empate ? 'dois ou mais candidatos parecidos: pergunte' : melhor.pontos >= 60 ? 'sugestão forte' : 'sugestão fraca: confirme com a pessoa',
          sugestao: { [entrada ? 'receita_id' : 'conta_id']: melhor.id, quem: melhor.quem, vencimento: br(melhor.vencimento), espaco: melhor.espaco, pontos: melhor.pontos },
          alternativas: abertos.slice(1, 3).map(c => ({ [entrada ? 'receita_id' : 'conta_id']: c.id, quem: c.quem, vencimento: br(c.vencimento), pontos: c.pontos })),
        }
      })
      return { linhas_analisadas: linhas.length, resultado }
    },
  },

  preparar_lancamento_socio: {
    pode: ehFinanceiro,
    definicao: {
      name: 'preparar_lancamento_socio',
      description: 'Prepara um aporte (sócio colocou dinheiro no espaço) ou uma retirada (sócio tirou dinheiro) e mostra um cartão que abre "+ Aporte" ou "+ Retirada" da tela Financeiro já preenchido; a pessoa confere, anexa o comprovante se tiver e salva. O sócio precisa ser do quadro do espaço.',
      input_schema: {
        type: 'object',
        properties: {
          lancamento: { type: 'string', enum: ['aporte', 'retirada'] },
          espaco: { type: 'string' },
          socio: { type: 'string' },
          valor: { type: 'number' },
          data: { type: 'string', description: 'AAAA-MM-DD' },
          descricao: { type: 'string' },
        },
        required: ['lancamento', 'espaco', 'socio'],
      },
    },
    async executar(sb, e, { acoes }) {
      const lanc = texto(e.lancamento) === 'retirada' ? 'retirada' : 'aporte'
      const { id, nomes } = await filtroEspaco(sb, e.espaco)
      if (!id) throw new Error('Informe o espaço.')
      const espaco = nomes.get(id)!
      const quadro = DIVISAO_SOCIOS[espaco] ?? []
      const socio = quadro.find(s => norm(s.nome) === norm(texto(e.socio))) ?? quadro.find(s => norm(s.nome).includes(norm(texto(e.socio))) || norm(texto(e.socio)).includes(norm(s.nome)))
      if (!socio) throw new Error(`"${texto(e.socio)}" não é sócio do ${espaco}. Sócios: ${quadro.map(s => s.nome).join(', ') || 'nenhum cadastrado'}.`)
      const valor = numero(e.valor)
      if (valor !== undefined && !(valor > 0)) throw new Error('Valor inválido.')
      const data = ISO.test(texto(e.data)) ? texto(e.data) : undefined
      if (data && data > hojeSP()) throw new Error('Data não pode ser futura.')
      acoes.push({
        tipo: 'socio', lancamento: lanc, espaco, socio: socio.nome, valor, data, descricao: texto(e.descricao) || undefined,
        resumo: `${lanc === 'aporte' ? 'Aporte' : 'Retirada'}: ${socio.nome} · ${espaco}${valor ? ` · ${brl(valor)}` : ''}${data ? ` · ${br(data)}` : ''}`,
      })
      return { ok: true, mensagem: 'Cartão mostrado: abre a janela da tela Financeiro preenchida. Ainda NÃO foi lançado.' }
    },
  },

  relatorio_financeiro: {
    pode: ehFinanceiro,
    definicao: {
      name: 'relatorio_financeiro',
      description: 'Números de gestão num período, pela mesma regra do Financeiro (só o que foi pago/recebido, na data efetiva: competência > recebimento > vencimento): faturamento operacional (receitas de eventos), despesas operacionais, resultado, obra, aportes e retiradas, por espaço e por mês; eventos realizados e maiores clientes. Use para "faturamento do Fabrique no ano", "qual espaço rendeu mais em outubro", "maiores clientes". Números de apoio: o oficial é a tela Financeiro.',
      input_schema: {
        type: 'object',
        properties: {
          de: { type: 'string', description: 'AAAA-MM-DD' },
          ate: { type: 'string', description: 'AAAA-MM-DD' },
          espaco: { type: 'string' },
        },
        required: ['de', 'ate'],
      },
    },
    async executar(sb, e) {
      const de = texto(e.de), ate = texto(e.ate)
      if (!ISO.test(de) || !ISO.test(ate) || ate < de) throw new Error('Período inválido (AAAA-MM-DD).')
      const { id, nomes } = await filtroEspaco(sb, e.espaco)
      const cR = 'id, cliente, valor, status, data, data_recebimento, data_competencia, espaco_id, tipo_entrada, evento_id'
      const cD = 'id, valor, status, categoria, data_vencimento, data_pagamento, espaco_id, fornecedor, descricao'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const comEspaco = (q: any) => (id ? q.eq('espaco_id', id) : q)
      const [r1, r2, r3, d1] = await Promise.all([
        todasAsLinhas<Record<string, unknown>>((a, b) => comEspaco(sb.from('receitas').select(cR).eq('status', 'pago').gte('data_competencia', de).lte('data_competencia', ate)).range(a, b)),
        todasAsLinhas<Record<string, unknown>>((a, b) => comEspaco(sb.from('receitas').select(cR).eq('status', 'pago').is('data_competencia', null).gte('data_recebimento', de).lte('data_recebimento', ate)).range(a, b)),
        todasAsLinhas<Record<string, unknown>>((a, b) => comEspaco(sb.from('receitas').select(cR).eq('status', 'pago').is('data_competencia', null).is('data_recebimento', null).gte('data', de).lte('data', ate)).range(a, b)),
        todasAsLinhas<Record<string, unknown>>((a, b) => comEspaco(sb.from('contas_pagar').select(cD).eq('status', 'pago').gte('data_pagamento', de).lte('data_pagamento', ate)).range(a, b)),
      ])
      const receitas = [...new Map([...r1, ...r2, ...r3].map(r => [String(r.id), r])).values()]
      const dataR = (r: Record<string, unknown>) => String(r.data_competencia ?? r.data_recebimento ?? r.data).slice(0, 10)
      type Linha = { faturamento: number; despesas_operacionais: number; obra: number; aportes: number; retiradas: number; outras_entradas: number }
      const vazio = (): Linha => ({ faturamento: 0, despesas_operacionais: 0, obra: 0, aportes: 0, retiradas: 0, outras_entradas: 0 })
      const porEspaco = new Map<string, Linha>(), porMes = new Map<string, Linha>(), clientes = new Map<string, number>()
      const somar = (esp: string, mes: string, campo: keyof Linha, v: number) => {
        for (const [m, k] of [[porEspaco, esp], [porMes, mes]] as const) { const l = m.get(k) ?? vazio(); l[campo] = arred(l[campo] + v); m.set(k, l) }
      }
      for (const r of receitas) {
        const esp = nomes.get(String(r.espaco_id)) ?? '—', mes = dataR(r).slice(0, 7), v = Number(r.valor)
        const t = String(r.tipo_entrada ?? 'evento')
        if (t === 'evento') { somar(esp, mes, 'faturamento', v); const c = String(r.cliente ?? '—'); clientes.set(c, arred((clientes.get(c) ?? 0) + v)) }
        else if (t === 'aporte_societario' || t === 'aporte_obra') somar(esp, mes, 'aportes', v)
        else if (t === 'outras_entradas') somar(esp, mes, 'outras_entradas', v)
      }
      for (const c of d1) {
        const esp = c.espaco_id ? nomes.get(String(c.espaco_id)) ?? '—' : 'Todos', mes = String(c.data_pagamento).slice(0, 7), v = Number(c.valor)
        const cat = String(c.categoria)
        if (cat === 'obra') somar(esp, mes, 'obra', v)
        else if (cat === 'retirada_socio') somar(esp, mes, 'retiradas', v)
        else if (!NAO_OPERACIONAL.includes(cat)) somar(esp, mes, 'despesas_operacionais', v)
      }
      const comResultado = (l: Linha) => ({ ...l, resultado_operacional: arred(l.faturamento - l.despesas_operacionais) })
      let qEv = sb.from('eventos').select('id, valor, espaco_id', { count: 'exact' }).eq('status', 'confirmado').gte('data', de).lte('data', ate).limit(5000)
      if (id) qEv = qEv.eq('espaco_id', id)
      const { data: evs, count } = await qEv
      const total = [...porEspaco.values()].reduce((s, l) => { for (const k of Object.keys(s) as (keyof Linha)[]) s[k] = arred(s[k] + l[k]); return s }, vazio())
      return {
        periodo: { de, ate }, espaco: id ? nomes.get(id) : 'todos',
        total: comResultado(total),
        por_espaco: Object.fromEntries([...porEspaco.entries()].map(([k, l]) => [k, comResultado(l)])),
        por_mes: Object.fromEntries([...porMes.entries()].sort().map(([k, l]) => [k, comResultado(l)])),
        eventos_confirmados_no_periodo: { quantidade: count ?? evs?.length ?? 0, valor_contratado: arred((evs ?? []).reduce((s, x) => s + Number(x.valor), 0)) },
        maiores_clientes: [...clientes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([cliente, valor]) => ({ cliente, valor })),
        observacao: 'Pela regra do Financeiro (pago/recebido na data efetiva). Fundo de caixa não entra. O oficial com fundos e divisão é a tela Financeiro.',
      }
    },
  },

  propor_plano: {
    pode: r => r === 'admin',
    definicao: {
      name: 'propor_plano',
      description: 'Propõe um novo plano de pagamento para um evento (ex.: "divide o saldo em 3 vezes"). As parcelas já PAGAS ficam como estão; você manda só as parcelas em aberto do novo plano (identificação, vencimento, valor). O cartão abre o painel do evento com "Editar plano" já preenchido; o administrador confere e toca em "Salvar plano". O valor do evento passa a ser a soma do plano. Use consultar_agenda e recebimentos antes para ver o evento e as parcelas atuais.',
      input_schema: {
        type: 'object',
        properties: {
          evento_id: { type: 'string' },
          parcelas: {
            type: 'array',
            items: { type: 'object', properties: { label: { type: 'string' }, data: { type: 'string', description: 'AAAA-MM-DD' }, valor: { type: 'number' } }, required: ['label', 'data', 'valor'] },
          },
        },
        required: ['evento_id', 'parcelas'],
      },
    },
    async executar(sb, e, { acoes }) {
      const { data: ev, error } = await sb.from('eventos').select('id, cliente, data, status, valor, espaco_id, tipo_contrato').eq('id', texto(e.evento_id)).maybeSingle()
      if (error) throw error
      if (!ev) throw new Error('Evento não encontrado.')
      if (ev.status !== 'confirmado') throw new Error('Só evento confirmado tem plano de pagamento (converta o pré-evento antes).')
      const novas = (Array.isArray(e.parcelas) ? e.parcelas : []).map(p => p as Record<string, unknown>)
      if (!novas.length) throw new Error('Mande as parcelas do novo plano.')
      for (const p of novas) {
        if (!texto(p.label) || !ISO.test(texto(p.data)) || !(Number(p.valor) > 0)) throw new Error('Toda parcela precisa de identificação, vencimento AAAA-MM-DD e valor maior que zero.')
      }
      const { data: atuais, error: e2 } = await sb.from('receitas').select('id, parcela_numero, parcela_label, descricao, data, valor, status, categoria:categorias_receita(slug)')
        .eq('evento_id', ev.id).not('parcela_numero', 'is', null)
      if (e2) throw e2
      const aluguel = (atuais ?? []).filter(r => (r.categoria as unknown as { slug?: string } | null)?.slug === 'aluguel')
      const pagas = aluguel.filter(r => r.status === 'pago').sort((a, b) => Number(a.parcela_numero) - Number(b.parcela_numero))
      let prox = Math.max(0, ...aluguel.map(r => Number(r.parcela_numero))) + 1
      const parcelas = [
        ...pagas.map(r => ({ numero: Number(r.parcela_numero), label: String(r.parcela_label ?? r.descricao ?? `Parcela ${r.parcela_numero}`).split(' — ')[0], data: String(r.data), valor: Number(r.valor) })),
        ...novas.map(p => ({ numero: prox++, label: texto(p.label), data: texto(p.data), valor: arred(Number(p.valor)) })),
      ]
      const total = arred(parcelas.reduce((s, p) => s + p.valor, 0))
      const linhas = parcelas.map(p => `${p.label} · ${br(p.data)} · ${brl(p.valor)}${pagas.some(x => Number(x.parcela_numero) === p.numero) ? ' (paga)' : ''}`)
      const { nomes } = await filtroEspaco(sb, '')
      acoes.push({ tipo: 'plano', eventoId: ev.id, parcelas, linhas, resumo: `Novo plano: ${ev.cliente} · ${nomes.get(ev.espaco_id) ?? ''} · ${br(ev.data)} · total ${brl(total)}` })
      const removidas = aluguel.filter(r => r.status !== 'pago').map(r => `${r.parcela_label ?? r.descricao} · ${br(r.data)} · ${brl(Number(r.valor))}`)
      return {
        ok: true, total_do_plano: total, valor_atual_do_evento: Number(ev.valor), diferenca: arred(total - Number(ev.valor)),
        parcelas_pagas_mantidas: pagas.length, parcelas_em_aberto_substituidas: removidas,
        mensagem: 'Cartão mostrado: abre o plano já preenchido no painel do evento. Só vale depois de "Salvar plano". Se o total mudou, avise que o valor do evento muda junto.',
      }
    },
  },
}
