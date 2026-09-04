import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabaseAuth = await createClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const url = new URL(request.url)
  const espacoId = url.searchParams.get('espacoId')
  if (!espacoId) return NextResponse.json({ error: 'espacoId é obrigatório.' }, { status: 400 })

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('espacos_google_calendar')
    .select('google_email, connected_at')
    .eq('espaco_id', espacoId)
    .maybeSingle()

  // Diagnóstico temporário: quando não acha a conexão, devolve junto todo
  // dado bruto da consulta (sem depender de gravar em nenhuma outra tabela,
  // que já se mostrou não confiável pra esse fim) — a tela mostra isso
  // direto, sem precisar de SQL nem print da Vercel.
  let debug: Record<string, unknown> | undefined
  if (!data) {
    const { count } = await supabase.from('espacos_google_calendar').select('*', { count: 'exact', head: true })
    debug = {
      espacoIdConsultado: espacoId,
      erroSupabase: error ? { message: error.message, code: error.code, details: error.details, hint: error.hint } : null,
      totalLinhasNaTabela: count,
    }
  }

  return NextResponse.json({
    connected: !!data,
    email: data?.google_email ?? null,
    connectedAt: data?.connected_at ?? null,
    debug,
  })
}
