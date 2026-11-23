import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { exigirPerfil } from '@/lib/whatsapp/acesso'

// Cria a campanha (rascunho). Disparo e pausa em ./[id].
export async function POST(request: Request) {
  const quem = await exigirPerfil(['admin'])
  if (quem instanceof NextResponse) return quem
  let b: { nome?: string; template_name?: string; template_lang?: string; segmento?: string | null }
  try { b = await request.json() } catch { return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 }) }
  const nome = b.nome?.trim(), template = b.template_name?.trim()
  if (!nome || !template) return NextResponse.json({ error: 'Informe o nome e o modelo.' }, { status: 400 })
  const { data, error } = await createAdminClient().from('wa_campaigns').insert({
    nome, template_name: template, template_lang: b.template_lang?.trim() || 'pt_BR',
    segmento: b.segmento?.trim() || null, created_by_nome: quem.nome,
  }).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, campanha: data })
}
