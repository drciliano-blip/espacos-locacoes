import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assinaturaValida, normalizarTelefone, pedeSaida, segmentoDoNome } from '@/lib/whatsapp/cloud'

// Webhook da Cloud API da Meta (campanhas + caixa de entrada).
// Cadastrar na Meta: App > WhatsApp > Configuração
//   URL de callback: https://sistema.espacoselocacoes.com.br/api/whatsapp/cloud/webhook
//   Token de verificação: WHATSAPP_VERIFY_TOKEN; assinar o campo "messages".
// (O /api/whatsapp/webhook continua sendo o do Blip.)

export async function GET(request: Request) {
  const p = new URL(request.url).searchParams
  const esperado = process.env.WHATSAPP_VERIFY_TOKEN
  if (esperado && p.get('hub.mode') === 'subscribe' && p.get('hub.verify_token') === esperado) {
    return new Response(p.get('hub.challenge') ?? '', { status: 200, headers: { 'Content-Type': 'text/plain' } })
  }
  return new Response('Forbidden', { status: 403 })
}

type Obj = Record<string, unknown>
const arr = (v: unknown) => (Array.isArray(v) ? v : []) as Obj[]

// Texto legível de uma mensagem recebida (texto, botão, lista, mídia...).
function textoDa(m: Obj): string {
  const tipo = String(m.type ?? '')
  if (tipo === 'text') return String((m.text as Obj | undefined)?.body ?? '')
  if (tipo === 'button') return String((m.button as Obj | undefined)?.text ?? (m.button as Obj | undefined)?.payload ?? '')
  if (tipo === 'interactive') {
    const i = (m.interactive ?? {}) as Obj
    const r = (i.button_reply ?? i.list_reply ?? {}) as Obj
    return String(r.title ?? r.id ?? '')
  }
  const midia = (m[tipo] ?? {}) as Obj
  if (midia.caption) return `[${tipo}] ${midia.caption}`
  return tipo ? `[${tipo} recebido]` : ''
}

export async function POST(request: Request) {
  const bruto = await request.text()
  if (!process.env.WHATSAPP_APP_SECRET) return NextResponse.json({ error: 'WHATSAPP_APP_SECRET não configurado.' }, { status: 503 })
  if (!assinaturaValida(bruto, request.headers.get('x-hub-signature-256'))) {
    return NextResponse.json({ error: 'Assinatura inválida.' }, { status: 401 })
  }

  let corpo: Obj
  try { corpo = JSON.parse(bruto) } catch { return NextResponse.json({ ok: true }) }

  const sb = createAdminClient()
  const { error: eLog } = await sb.from('wa_webhook_events').insert({ payload: corpo, assinatura_ok: true })
  if (eLog) return NextResponse.json({ error: eLog.message }, { status: 500 }) // a Meta tenta de novo

  const campanhas = new Set<string>()
  try {
    for (const entry of arr(corpo.entry)) {
      for (const ch of arr(entry.changes)) {
        const v = (ch.value ?? {}) as Obj

        // Status das mensagens enviadas.
        for (const s of arr(v.statuses)) {
          const ts = s.timestamp ? new Date(Number(s.timestamp) * 1000).toISOString() : new Date().toISOString()
          const erros = arr(s.errors)
          const { data: cid } = await sb.rpc('wa_aplicar_status', {
            p_wa_id: String(s.id), p_status: String(s.status), p_ts: ts, p_erro: erros.length ? erros : null,
          })
          if (cid) campanhas.add(cid as string)
        }

        // Mensagens recebidas.
        const perfis = arr(v.contacts)
        for (const m of arr(v.messages)) {
          const telefone = normalizarTelefone(String(m.from ?? ''))
          if (!telefone) continue
          const nomePerfil = (perfis.find(p => p.wa_id === m.from)?.profile as Obj | undefined)?.name as string | undefined
          const texto = textoDa(m)
          const em = m.timestamp ? new Date(Number(m.timestamp) * 1000).toISOString() : new Date().toISOString()

          let { data: contato } = await sb.from('wa_contacts').select('id, opt_out').eq('telefone', telefone).maybeSingle()
          if (!contato) {
            const { data: novo } = await sb.from('wa_contacts')
              .upsert({ telefone, nome: nomePerfil ?? null, segmento: segmentoDoNome(nomePerfil), origem: 'whatsapp' }, { onConflict: 'telefone', ignoreDuplicates: false })
              .select('id, opt_out').single()
            contato = novo
          }
          if (!contato) continue

          // Resposta conta para a última campanha que esse contato recebeu (30 dias).
          const { data: ultima } = await sb.from('wa_messages').select('campaign_id')
            .eq('contact_id', contato.id).eq('direction', 'out').not('campaign_id', 'is', null)
            .gte('created_at', new Date(Date.now() - 30 * 86400_000).toISOString())
            .order('created_at', { ascending: false }).limit(1).maybeSingle()

          const { error: eMsg } = await sb.from('wa_messages').insert({
            contact_id: contato.id, campaign_id: ultima?.campaign_id ?? null, direction: 'in',
            wa_message_id: String(m.id), tipo: String(m.type ?? 'desconhecido'),
            conteudo: { texto, bruto: m }, status: 'received', created_at: em,
          })
          if (eMsg && !eMsg.message.includes('duplicate')) throw new Error(eMsg.message)
          if (eMsg) continue // a Meta reenviou a mesma mensagem

          const mudancas: Obj = { ultima_entrada_at: em }
          if (pedeSaida(texto) && !contato.opt_out) { mudancas.opt_out = true; mudancas.opt_out_at = em }
          await sb.from('wa_contacts').update(mudancas).eq('id', contato.id)
          if (ultima?.campaign_id) campanhas.add(ultima.campaign_id)
        }
      }
    }
  } finally {
    await Promise.all([...campanhas].map(id => sb.rpc('wa_recontar_campanha', { p_id: id })))
  }
  return NextResponse.json({ ok: true })
}
