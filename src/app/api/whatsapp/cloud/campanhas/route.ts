import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { exigirPerfil } from '@/lib/whatsapp/acesso'
import { listarModelos } from '@/lib/whatsapp/cloud'

// Cria a campanha (rascunho). Disparo e pausa em ./[id].
// Confere o modelo na Meta: precisa estar aprovado e ser de um formato que o
// sistema sabe preencher ({{1}} = primeiro nome do contato).
export async function POST(request: Request) {
  const quem = await exigirPerfil(['admin'])
  if (quem instanceof NextResponse) return quem
  let b: { nome?: string; template_name?: string; template_lang?: string; segmento?: string | null }
  try { b = await request.json() } catch { return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 }) }
  const nome = b.nome?.trim(), template = b.template_name?.trim(), idioma = b.template_lang?.trim() || 'pt_BR'
  if (!nome || !template) return NextResponse.json({ error: 'Informe o nome e o modelo.' }, { status: 400 })

  let modelo
  try { modelo = (await listarModelos()).find(m => m.name === template && m.language === idioma) } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Não consegui ler os modelos na Meta.' }, { status: 502 })
  }
  if (!modelo) return NextResponse.json({ error: 'Modelo não encontrado nesta conta do WhatsApp.' }, { status: 400 })
  if (modelo.status !== 'APPROVED') return NextResponse.json({ error: `O modelo ainda não foi aprovado pela Meta (situação: ${modelo.status}).` }, { status: 400 })
  if (!modelo.suportado) return NextResponse.json({ error: 'Este modelo tem mais de uma variável ou cabeçalho com imagem/variável, que o sistema ainda não preenche.' }, { status: 400 })

  const { data, error } = await createAdminClient().from('wa_campaigns').insert({
    nome, template_name: template, template_lang: idioma, template_texto: modelo.texto,
    parametros: modelo.variaveis === 1 ? ['primeiro_nome'] : [],
    segmento: b.segmento?.trim() || null, created_by_nome: quem.nome,
  }).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, campanha: data })
}
