import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { exigirPerfil } from '@/lib/whatsapp/acesso'
import { normalizarTelefone, segmentoDoNome } from '@/lib/whatsapp/cloud'

// POST: importa contatos (CSV lido na tela). Quem já existe fica como está
//       (não sobrescreve nome nem opt-out).
// PATCH: marca que o contato saiu (pediu por outro canal).
export async function POST(request: Request) {
  const quem = await exigirPerfil(['admin'])
  if (quem instanceof NextResponse) return quem
  let body: { contatos?: { telefone?: string; nome?: string; segmento?: string }[]; origem?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 }) }
  const origem = (body.origem || 'importacao').slice(0, 80)

  const porTelefone = new Map<string, { telefone: string; nome: string | null; segmento: string | null; origem: string }>()
  let invalidos = 0
  for (const c of body.contatos ?? []) {
    const telefone = normalizarTelefone(c.telefone)
    if (!telefone) { invalidos++; continue }
    const nome = c.nome?.replace(/[‎‏﻿]/g, '').trim() || null
    porTelefone.set(telefone, { telefone, nome, segmento: c.segmento?.trim() || segmentoDoNome(nome), origem })
  }
  const linhas = [...porTelefone.values()]
  if (linhas.length > 20000) return NextResponse.json({ error: 'Arquivo grande demais (máx. 20 mil contatos por vez).' }, { status: 400 })

  const sb = createAdminClient()
  let novos = 0
  for (let i = 0; i < linhas.length; i += 500) {
    const { data, error } = await sb.from('wa_contacts')
      .upsert(linhas.slice(i, i + 500), { onConflict: 'telefone', ignoreDuplicates: true }).select('id')
    if (error) return NextResponse.json({ error: error.message, novos }, { status: 500 })
    novos += data?.length ?? 0
  }
  return NextResponse.json({ ok: true, lidos: linhas.length, novos, existentes: linhas.length - novos, invalidos })
}

export async function PATCH(request: Request) {
  const quem = await exigirPerfil(['admin', 'operacional'])
  if (quem instanceof NextResponse) return quem
  let body: { id?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 }) }
  const { error } = await createAdminClient().from('wa_contacts')
    .update({ opt_out: true, opt_out_at: new Date().toISOString() }).eq('id', body.id ?? '').eq('opt_out', false)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
