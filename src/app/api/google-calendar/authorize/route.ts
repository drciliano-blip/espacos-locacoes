import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const espacoId = url.searchParams.get('espacoId')
  if (!espacoId) {
    return NextResponse.json({ error: 'espacoId é obrigatório.' }, { status: 400 })
  }

  const redirectUri = `${url.origin}/api/google-calendar/callback`

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
