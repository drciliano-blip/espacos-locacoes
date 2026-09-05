import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Domínio de produção fixo (em vez de `url.origin`) — o sistema é acessível
// tanto pelo domínio próprio quanto pelo alias `*.vercel.app`, mas só o
// domínio próprio está registrado como redirect URI confiável no Google
// Cloud Console e não sofre do 404 esporádico que o alias apresenta ao
// receber o redirect de volta do Google. Iniciar a conexão a partir do
// alias sem isso levava a esse 404 mesmo com a conexão concluída com sucesso.
const DOMINIO_PRODUCAO = 'https://sistema.espacoselocacoes.com.br'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const origin = url.hostname === 'localhost' ? url.origin : DOMINIO_PRODUCAO

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${origin}/login`)

  const espacoId = url.searchParams.get('espacoId')
  if (!espacoId) {
    return NextResponse.json({ error: 'espacoId é obrigatório.' }, { status: 400 })
  }

  const redirectUri = `${origin}/api/google-calendar/callback`

  const params = new URLSearchParams({
    client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar',
    access_type: 'offline',
    prompt: 'consent',
    state: espacoId,
  })

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`)
}
