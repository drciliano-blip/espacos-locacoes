import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const espacoId = url.searchParams.get('state')
  const errorParam = url.searchParams.get('error')

  if (errorParam || !code || !espacoId) {
    return NextResponse.redirect(`${url.origin}/espacos?google_error=${encodeURIComponent(errorParam ?? 'faltou código de autorização')}`)
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

    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    const userData = await userRes.json()

    const supabase = createAdminClient()
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString()

    await supabase.from('espacos_google_calendar').upsert({
      espaco_id: espacoId,
      google_email: userData.email ?? null,
      refresh_token: tokenData.refresh_token,
      access_token: tokenData.access_token,
      access_token_expires_at: expiresAt,
      connected_at: new Date().toISOString(),
    })

    const { data: espaco } = await supabase.from('espacos').select('slug').eq('id', espacoId).single()
    const slug = espaco?.slug
    return NextResponse.redirect(`${url.origin}${slug ? `/espacos/${slug}` : '/espacos'}?google=connected`)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido ao conectar com o Google.'
    return NextResponse.redirect(`${url.origin}/espacos?google_error=${encodeURIComponent(message)}`)
  }
}
