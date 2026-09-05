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
  const { data } = await supabase
    .from('espacos_google_calendar')
    .select('google_email, connected_at')
    .eq('espaco_id', espacoId)
    .maybeSingle()

  return NextResponse.json({
    connected: !!data,
    email: data?.google_email ?? null,
    connectedAt: data?.connected_at ?? null,
  })
}
