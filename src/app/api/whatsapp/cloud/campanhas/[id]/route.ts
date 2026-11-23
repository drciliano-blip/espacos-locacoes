import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { exigirPerfil } from '@/lib/whatsapp/acesso'
import { processarCampanha } from '@/lib/whatsapp/campanhas'

// { acao: 'disparar' } → marca "enviando" e manda um lote (a tela chama de
// novo enquanto houver cota; o agendador diário continua o resto).
// { acao: 'pausar' }   → para no próximo grupo.
export const maxDuration = 60

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const quem = await exigirPerfil(['admin'])
  if (quem instanceof NextResponse) return quem
  const { id } = await ctx.params
  let b: { acao?: string }
  try { b = await request.json() } catch { return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 }) }
  const sb = createAdminClient()

  if (b.acao === 'pausar') {
    const { error } = await sb.from('wa_campaigns').update({ status: 'pausada', updated_at: new Date().toISOString() }).eq('id', id).eq('status', 'enviando')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, status: 'pausada' })
  }
  if (b.acao !== 'disparar') return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })

  const { error } = await sb.from('wa_campaigns').update({ status: 'enviando', updated_at: new Date().toISOString() })
    .eq('id', id).in('status', ['rascunho', 'pausada', 'enviando'])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  try {
    return NextResponse.json({ ok: true, ...(await processarCampanha(sb, id, 45_000)) })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha no disparo.' }, { status: 500 })
  }
}
