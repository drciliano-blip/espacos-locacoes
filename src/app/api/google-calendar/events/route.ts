import { NextResponse } from 'next/server'
import { getValidAccessToken } from '@/lib/google-calendar-tokens'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const espacoId = url.searchParams.get('espacoId')
  if (!espacoId) return NextResponse.json({ error: 'espacoId é obrigatório.' }, { status: 400 })

  try {
    const accessToken = await getValidAccessToken(espacoId)

    const now = new Date()
    const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now.toISOString()}&timeMax=${future.toISOString()}&orderBy=startTime&singleEvents=true&maxResults=25`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
    if (!res.ok) throw new Error('Erro HTTP ' + res.status)
    const data = await res.json()
    return NextResponse.json({ events: data.items ?? [] })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido ao consultar o Google Calendar.'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

export async function POST(request: Request) {
  const { espacoId, summary, date, startTime, endTime, location } = await request.json()
  if (!espacoId || !summary || !date) {
    return NextResponse.json({ error: 'espacoId, summary e date são obrigatórios.' }, { status: 400 })
  }

  try {
    const accessToken = await getValidAccessToken(espacoId)

    const body: Record<string, unknown> = {
      summary,
      start: startTime ? { dateTime: `${date}T${startTime}:00`, timeZone: 'America/Sao_Paulo' } : { date },
      end: endTime ? { dateTime: `${date}T${endTime}:00`, timeZone: 'America/Sao_Paulo' } : { date },
    }
    if (location) body.location = location

    const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error('Erro HTTP ' + res.status)
    const created = await res.json()
    return NextResponse.json({ event: created })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido ao criar evento no Google Calendar.'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
