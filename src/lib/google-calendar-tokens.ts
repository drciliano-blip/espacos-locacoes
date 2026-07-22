import { createAdminClient } from '@/lib/supabase/admin'

interface TokenRow {
  espaco_id: string
  google_email: string | null
  refresh_token: string
  access_token: string | null
  access_token_expires_at: string | null
}

async function refreshAccessToken(refreshToken: string) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) throw new Error('Não foi possível renovar o token do Google.')
  return res.json() as Promise<{ access_token: string; expires_in: number }>
}

// Retorna um access_token válido para o Google Calendar daquele espaço, renovando
// via refresh_token quando necessário. Lança erro se o espaço não estiver conectado.
export async function getValidAccessToken(espacoId: string): Promise<string> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('espacos_google_calendar')
    .select('espaco_id, google_email, refresh_token, access_token, access_token_expires_at')
    .eq('espaco_id', espacoId)
    .single()

  if (error || !data) throw new Error('Este espaço ainda não está conectado ao Google Calendar.')
  const row = data as TokenRow

  const expiresAt = row.access_token_expires_at ? new Date(row.access_token_expires_at).getTime() : 0
  const aindaValido = row.access_token && expiresAt - Date.now() > 60_000

  if (aindaValido) return row.access_token!

  const refreshed = await refreshAccessToken(row.refresh_token)
  const expiresAtNovo = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()

  await supabase
    .from('espacos_google_calendar')
    .update({ access_token: refreshed.access_token, access_token_expires_at: expiresAtNovo })
    .eq('espaco_id', espacoId)

  return refreshed.access_token
}
