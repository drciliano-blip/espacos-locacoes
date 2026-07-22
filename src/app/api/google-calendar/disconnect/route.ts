import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const { espacoId } = await request.json()
  if (!espacoId) return NextResponse.json({ error: 'espacoId é obrigatório.' }, { status: 400 })

  const supabase = createAdminClient()

  const { data } = await supabase
    .from('espacos_google_calendar')
    .select('refresh_token')
    .eq('espaco_id', espacoId)
    .maybeSingle()

  if (data?.refresh_token) {
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(data.refresh_token)}`, { method: 'POST' })
    } catch {
      // revogação no Google é best-effort — mesmo se falhar, removemos o registro local
    }
  }

  await supabase.from('espacos_google_calendar').delete().eq('espaco_id', espacoId)

  return NextResponse.json({ ok: true })
}
