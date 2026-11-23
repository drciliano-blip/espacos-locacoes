import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { processarCampanha } from '@/lib/whatsapp/campanhas'

// Agendador diário da Vercel (vercel.json): retoma as campanhas "enviando"
// que pararam na cota de 24 h. Protegido pelo CRON_SECRET.
export const maxDuration = 300

export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET
  if (!segredo || request.headers.get('authorization') !== `Bearer ${segredo}`) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }
  const sb = createAdminClient()
  const { data: campanhas } = await sb.from('wa_campaigns').select('id').eq('status', 'enviando').order('created_at')
  const inicio = Date.now()
  const resultados = []
  for (const c of campanhas ?? []) {
    // Várias rodadas por campanha até acabar a cota ou o tempo.
    for (let r = 0; r < 20 && Date.now() - inicio < 250_000; r++) {
      const res = await processarCampanha(sb, c.id, 250_000 - (Date.now() - inicio))
      resultados.push({ id: c.id, ...res })
      if (res.enviadas + res.falhas === 0 || res.status !== 'enviando' || res.cotaRestante === 0) break
    }
  }
  return NextResponse.json({ ok: true, resultados })
}
