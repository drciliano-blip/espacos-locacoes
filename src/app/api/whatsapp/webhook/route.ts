import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { lerMensagemRecebida, numeroParaExibir } from '@/lib/whatsapp/blip'
import { DADOS_VAZIOS, novoNumero } from '@/lib/assistente/orcamento'
import { mensagemInicial } from '@/lib/assistente/roteiro'
import type { Mensagem } from '@/lib/assistente/atendimentos'

// Recebe as mensagens do WhatsApp (o Blip posta aqui) e coloca cada uma no
// atendimento daquele número no Assistente de IA. Número novo → atendimento
// novo, já com a mensagem padrão (as 5 perguntas) pronta para a equipe enviar.
// Nada é respondido daqui: na etapa 1 a equipe aprova cada envio.
// Endereço para cadastrar no Blip: https://<sistema>/api/whatsapp/webhook?token=<BLIP_WEBHOOK_TOKEN>

export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get('token')
  const esperado = process.env.BLIP_WEBHOOK_TOKEN
  if (!esperado || token !== esperado) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })

  let corpo: unknown
  try { corpo = await request.json() } catch { return NextResponse.json({ ok: true }) }
  const recebidas = lerMensagemRecebida(corpo)
  if (recebidas.length === 0) return NextResponse.json({ ok: true }) // notificação de entrega etc.

  const sb = createAdminClient()
  for (const r of recebidas) {
    const msg: Mensagem = {
      id: `wa-${r.idExterno}`, autor: 'cliente', texto: r.texto, em: new Date().toISOString(),
      por: r.nome ? `${r.nome} (WhatsApp)` : 'WhatsApp', canal: 'whatsapp', idExterno: r.idExterno,
    }

    // Atendimento mais recente desse número que ainda não terminou.
    const { data: existentes, error } = await sb.from('assistente_atendimentos')
      .select('id, status, mensagens').eq('estado->>whatsapp', r.numero)
      .order('updated_at', { ascending: false }).limit(1)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const atual = existentes?.[0]

    if (atual && atual.status !== 'fechado' && atual.status !== 'perdido') {
      const msgs = (atual.mensagens ?? []) as Mensagem[]
      if (msgs.some(m => m.id === msg.id)) continue // o Blip reenviou a mesma mensagem
      const { error: e2 } = await sb.from('assistente_atendimentos')
        .update({ mensagens: [...msgs, msg], updated_at: new Date().toISOString(), updated_by_nome: 'WhatsApp' })
        .eq('id', atual.id)
      if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
      continue
    }

    const saudacao: Mensagem = { id: crypto.randomUUID(), autor: 'assistente', texto: mensagemInicial(), em: new Date(Date.now() + 1000).toISOString(), por: 'Assistente' }
    const { error: e3 } = await sb.from('assistente_atendimentos').insert({
      numero: `${novoNumero()}-${r.numero.slice(-4)}`, // final do telefone: dois números novos no mesmo minuto não colidem
      titulo: r.nome ? `${r.nome} (WhatsApp)` : numeroParaExibir(r.numero),
      estado: { whatsapp: r.numero, dados: { ...DADOS_VAZIOS, cliente: r.nome ?? '', telefone: numeroParaExibir(r.numero) } },
      mensagens: [msg, saudacao],
      created_by_nome: 'WhatsApp',
      updated_by_nome: 'WhatsApp',
    })
    if (e3) return NextResponse.json({ error: e3.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
