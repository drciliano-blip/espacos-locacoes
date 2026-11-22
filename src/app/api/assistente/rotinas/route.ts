import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { gerarRotinas, hojeSP, rotinasDoDia } from '@/lib/assistente/rotinas'

// Etapa 4 do assistente: rotinas automáticas.
//  - GET: chamado pelo agendador da Vercel todo dia às 8h de Brasília
//    (vercel.json), com o segredo CRON_SECRET no cabeçalho.
//  - POST: "Gerar agora", só para o administrador (refaz as rotinas de hoje).
// Lê os dados com a chave de serviço (o resumo da operação sai sem valores)
// e grava só na tabela assistente_rotinas.

export const maxDuration = 300

export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET
  if (!segredo || request.headers.get('authorization') !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada.' }, { status: 500 })
  const feitos = await gerarRotinas(createAdminClient(), apiKey)
  return NextResponse.json({ ok: true, feitos })
}

export async function POST(request: Request) {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const { data: perfil } = await sb.from('profiles').select('role').eq('id', user.id).single()
  if (perfil?.role !== 'admin') return NextResponse.json({ error: 'Só o administrador gera as rotinas manualmente.' }, { status: 403 })
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada.' }, { status: 500 })
  let body: { tipos?: string[] } = {}
  try { body = await request.json() } catch { /* sem corpo: rotinas de hoje */ }
  const hoje = hojeSP()
  const validos = ['manha', 'semanal', 'fechamento', 'vendas'] as const
  const tipos = body.tipos?.length ? validos.filter(t => body.tipos!.includes(t)) : rotinasDoDia(hoje)
  const feitos = await gerarRotinas(createAdminClient(), apiKey, hoje, tipos)
  return NextResponse.json({ ok: true, feitos })
}
