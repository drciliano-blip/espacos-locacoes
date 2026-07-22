import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const espacoId = url.searchParams.get('state')
  const errorParam = url.searchParams.get('error')

  const supabase = createAdminClient()

  // Busca o slug antes de mais nada, pra sempre voltar pra página certa do espaço
  // (sucesso ou erro) — antes redirecionava pra /espacos genérico, onde o aviso
  // de erro nunca aparecia porque esse componente só existe na página do espaço.
  let slug: string | null = null
  if (espacoId) {
    const { data: espaco } = await supabase.from('espacos').select('slug').eq('id', espacoId).maybeSingle()
    slug = espaco?.slug ?? null
  }
  const voltarPara = slug ? `/espacos/${slug}` : '/espacos'

  if (errorParam || !code || !espacoId) {
    return NextResponse.redirect(`${url.origin}${voltarPara}?google_error=${encodeURIComponent(errorParam ?? 'faltou código de autorização')}`)
  }

  const redirectUri = `${url.origin}/api/google-calendar/callback`

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })
    const tokenData = await tokenRes.json()
    if (!tokenRes.ok || !tokenData.refresh_token) {
      throw new Error(tokenData.error_description ?? tokenData.error ?? 'Google não retornou um refresh_token. Tente desconectar e conectar novamente.')
    }

    let email: string | null = null
    try {
      const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      })
      if (userRes.ok) {
        const userData = await userRes.json()
        email = userData.email ?? null
      }
    } catch {
      // e-mail é só para exibição — não deve impedir a conexão do calendário
    }

    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString()

    const { error: upsertError } = await supabase.from('espacos_google_calendar').upsert({
      espaco_id: espacoId,
      google_email: email,
      refresh_token: tokenData.refresh_token,
      access_token: tokenData.access_token,
      access_token_expires_at: expiresAt,
      connected_at: new Date().toISOString(),
    })
    if (upsertError) throw new Error(upsertError.message)

    return NextResponse.redirect(`${url.origin}${voltarPara}?google=connected`)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido ao conectar com o Google.'
    return NextResponse.redirect(`${url.origin}${voltarPara}?google_error=${encodeURIComponent(message)}`)
  }
}
