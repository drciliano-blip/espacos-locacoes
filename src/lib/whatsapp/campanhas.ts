// Disparo das campanhas (servidor, service role). Chamado pelo botão
// "Disparar" (um lote por clique, a tela repete enquanto houver cota) e pelo
// agendador diário da Vercel, que retoma o que ficou pela cota de 24 h.
//
// Trava contra envio duplicado: antes de chamar a Meta grava a mensagem como
// "pendente"; o índice único (campanha, contato) impede dois envios iguais
// mesmo com o botão e o agendador rodando ao mesmo tempo.

import type { SupabaseClient } from '@supabase/supabase-js'
import { ErroMeta, cloudConfigurado, enviarTemplate, limiteDiario } from './cloud'

const LOTE_MAX = 60
const PARALELO = 6

export interface ResultadoLote {
  enviadas: number
  falhas: number
  restantes: number
  cotaRestante: number
  status: string
  aviso?: string
}

// Supabase devolve no máximo 1000 linhas por consulta.
async function todas<T>(consulta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = []
  for (let de = 0; ; de += 1000) {
    const { data, error } = await consulta(de, de + 999)
    if (error) throw new Error(error.message)
    out.push(...(data ?? []))
    if (!data || data.length < 1000) return out
  }
}

// Contatos únicos que já receberam modelo nas últimas 24 h (limite da Meta).
export async function cotaUsada(sb: SupabaseClient): Promise<number> {
  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const linhas = await todas<{ contact_id: string }>((de, ate) =>
    sb.from('wa_messages').select('contact_id').eq('direction', 'out').eq('tipo', 'template')
      .neq('status', 'failed').gte('created_at', desde).range(de, ate))
  return new Set(linhas.map(l => l.contact_id)).size
}

async function pendentesDaCampanha(sb: SupabaseClient, c: { id: string; segmento: string | null }) {
  const [contatos, jaFeitos] = await Promise.all([
    todas<{ id: string; telefone: string }>((de, ate) => {
      let q = sb.from('wa_contacts').select('id, telefone').eq('opt_out', false)
      if (c.segmento) q = q.eq('segmento', c.segmento)
      return q.order('created_at').range(de, ate)
    }),
    todas<{ contact_id: string }>((de, ate) =>
      sb.from('wa_messages').select('contact_id').eq('campaign_id', c.id).eq('direction', 'out').range(de, ate)),
  ])
  const feitos = new Set(jaFeitos.map(f => f.contact_id))
  return { pendentes: contatos.filter(x => !feitos.has(x.id)), feitos: feitos.size }
}

export async function processarCampanha(sb: SupabaseClient, campanhaId: string, prazoMs = 45_000): Promise<ResultadoLote> {
  const inicio = Date.now()
  const { data: c, error } = await sb.from('wa_campaigns').select('*').eq('id', campanhaId).single()
  if (error || !c) throw new Error('Campanha não encontrada.')
  const base = { enviadas: 0, falhas: 0, restantes: 0, cotaRestante: 0, status: c.status as string }
  if (c.status !== 'enviando') return base
  if (!cloudConfigurado()) return { ...base, aviso: 'WhatsApp (Meta) não configurado na Vercel.' }

  const inicial = await pendentesDaCampanha(sb, c)
  const feitos = inicial.feitos
  let pendentes = inicial.pendentes
  await sb.from('wa_campaigns').update({ total: feitos + pendentes.length, updated_at: new Date().toISOString() }).eq('id', c.id)
  if (pendentes.length === 0) {
    await sb.from('wa_campaigns').update({ status: 'concluida' }).eq('id', c.id)
    await sb.rpc('wa_recontar_campanha', { p_id: c.id })
    return { ...base, status: 'concluida' }
  }

  let cota = limiteDiario() - (await cotaUsada(sb))
  let enviadas = 0, falhas = 0
  let aviso: string | undefined
  pendentes = pendentes.slice(0, Math.max(0, Math.min(cota, LOTE_MAX)))

  for (let i = 0; i < pendentes.length && Date.now() - inicio < prazoMs && !aviso; i += PARALELO) {
    // Alguém pausou no meio? Para no próximo grupo.
    const { data: atual } = await sb.from('wa_campaigns').select('status').eq('id', c.id).single()
    if (atual?.status !== 'enviando') { base.status = atual?.status ?? base.status; break }

    await Promise.all(pendentes.slice(i, i + PARALELO).map(async contato => {
      const { data: msg, error: eIns } = await sb.from('wa_messages').insert({
        campaign_id: c.id, contact_id: contato.id, direction: 'out', tipo: 'template', status: 'pendente',
        conteudo: { template: c.template_name, idioma: c.template_lang },
      }).select('id').single()
      if (eIns || !msg) return // já enviada por outro processo (índice único)
      try {
        const waId = await enviarTemplate(contato.telefone, c.template_name, c.template_lang)
        await sb.from('wa_messages').update({ wa_message_id: waId, status: 'accepted' }).eq('id', msg.id)
        await sb.from('wa_contacts').update({ ultima_saida_at: new Date().toISOString() }).eq('id', contato.id)
        enviadas++; cota--
      } catch (e) {
        if (e instanceof ErroMeta && e.bloqueiaTudo) {
          // Problema da conta, não do contato: desfaz a trava para tentar de novo depois.
          await sb.from('wa_messages').delete().eq('id', msg.id)
          aviso = e.message
          return
        }
        const detalhe = e instanceof ErroMeta ? e.detalhe : { message: String(e) }
        await sb.from('wa_messages').update({ status: 'failed', erro: detalhe, failed_at: new Date().toISOString() }).eq('id', msg.id)
        falhas++
      }
    }))
  }

  if (aviso) await sb.from('wa_campaigns').update({ status: 'pausada' }).eq('id', c.id)
  await sb.rpc('wa_recontar_campanha', { p_id: c.id })
  const restantes = (await pendentesDaCampanha(sb, c)).pendentes.length
  let status = aviso ? 'pausada' : base.status
  if (!aviso && restantes === 0 && status === 'enviando') {
    await sb.from('wa_campaigns').update({ status: 'concluida' }).eq('id', c.id)
    status = 'concluida'
  }
  return { enviadas, falhas, restantes, cotaRestante: Math.max(0, cota), status, aviso: aviso ? `${aviso} A campanha foi pausada.` : undefined }
}
