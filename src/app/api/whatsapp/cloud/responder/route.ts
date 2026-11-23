import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { exigirPerfil } from '@/lib/whatsapp/acesso'
import { ErroMeta, JANELA_24H_MS, enviarTextoCloud } from '@/lib/whatsapp/cloud'

// Resposta da caixa de entrada: texto livre só dentro de 24 h da última
// mensagem do cliente (regra da Meta). Fora disso, só modelo aprovado.
export async function POST(request: Request) {
  const quem = await exigirPerfil(['admin', 'operacional'])
  if (quem instanceof NextResponse) return quem
  let b: { contactId?: string; texto?: string }
  try { b = await request.json() } catch { return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 }) }
  const texto = b.texto?.trim()
  if (!texto) return NextResponse.json({ error: 'Mensagem vazia.' }, { status: 400 })
  if (texto.length > 4096) return NextResponse.json({ error: 'Mensagem longa demais (máx. 4096 caracteres).' }, { status: 400 })

  const sb = createAdminClient()
  const { data: c } = await sb.from('wa_contacts').select('id, telefone, ultima_entrada_at').eq('id', b.contactId ?? '').single()
  if (!c) return NextResponse.json({ error: 'Contato não encontrado.' }, { status: 404 })
  if (!c.ultima_entrada_at || Date.now() - Date.parse(c.ultima_entrada_at) > JANELA_24H_MS) {
    return NextResponse.json({ error: 'Passaram mais de 24 h desde a última mensagem do cliente. Pela regra da Meta, agora só modelo aprovado.' }, { status: 409 })
  }

  let waId: string
  try { waId = await enviarTextoCloud(c.telefone, texto) } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao enviar.' }, { status: e instanceof ErroMeta ? 502 : 500 })
  }
  const { data: msg, error } = await sb.from('wa_messages').insert({
    contact_id: c.id, direction: 'out', tipo: 'text', wa_message_id: waId, status: 'accepted',
    conteudo: { texto }, enviado_por_nome: quem.nome,
  }).select('*').single()
  await sb.from('wa_contacts').update({ ultima_saida_at: new Date().toISOString() }).eq('id', c.id)
  if (error) return NextResponse.json({ error: `Enviada, mas não gravei no sistema: ${error.message}` }, { status: 500 })
  return NextResponse.json({ ok: true, mensagem: msg })
}
