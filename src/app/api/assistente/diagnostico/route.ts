import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { canAccess } from '@/lib/auth'
import type { NivelAcesso } from '@/types'

export const maxDuration = 60

// Diagnóstico do Assistente de IA (botão "Testar a IA"): confere a chave, o
// modelo e o tempo de resposta com a MESMA forma de chamada das outras rotas,
// para descobrir por que o assistente não responde.

export async function GET() {
  const passos: { passo: string; ok: boolean; detalhe: string }[] = []
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const { data: perfil } = await sb.from('profiles').select('role').eq('id', user.id).single()
  const role = perfil?.role as NivelAcesso | undefined
  // Teste técnico (faz chamadas pagas): só o administrador.
  if (role !== 'admin') return NextResponse.json({ error: 'Só o administrador pode testar a IA.' }, { status: 403 })
  passos.push({ passo: 'Login e perfil', ok: canAccess(role, 'assistente'), detalhe: role })

  const apiKey = process.env.ANTHROPIC_API_KEY
  passos.push({ passo: 'Chave da IA (ANTHROPIC_API_KEY)', ok: !!apiKey, detalhe: apiKey ? `configurada (termina em …${apiKey.slice(-4)})` : 'não configurada no Vercel' })
  if (!apiKey) return NextResponse.json({ passos })

  const client = new Anthropic({ apiKey })
  for (const [nome, chamar] of [
    ['Modelo do assistente (claude-opus-5-5, chamada simples)', () => client.messages.create({ model: 'claude-opus-5-5', max_tokens: 50, messages: [{ role: 'user', content: 'Responda só: ok' }] })],
    ['Chamada completa (fallback + esforço + ferramenta)', () => client.beta.messages.create({
      model: 'claude-opus-5-5', max_tokens: 200, betas: ['server-side-fallback-2026-07-01'], fallbacks: [{ model: 'claude-opus-4-8' }],
      output_config: { effort: 'low' },
      tools: [{ name: 'teste', description: 'Ferramenta de teste.', input_schema: { type: 'object', properties: {} } }],
      messages: [{ role: 'user', content: 'Responda só: ok' }],
    })],
    ['Modelo de leitura de fichas (claude-sonnet-4-6)', () => client.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 50, messages: [{ role: 'user', content: 'Responda só: ok' }] })],
  ] as const) {
    const t0 = Date.now()
    try {
      const r = await chamar()
      const texto = r.content.filter(b => b.type === 'text').map(b => (b as { text: string }).text).join(' ').trim()
      passos.push({ passo: nome, ok: true, detalhe: `respondeu "${texto.slice(0, 40)}" em ${((Date.now() - t0) / 1000).toFixed(1)} s` })
    } catch (e) {
      const st = e instanceof Anthropic.APIError ? `${e.status} ` : ''
      passos.push({ passo: nome, ok: false, detalhe: `${st}${e instanceof Error ? e.message : String(e)}`.slice(0, 300) })
    }
  }
  console.log('[assistente/diagnostico]', JSON.stringify(passos))
  return NextResponse.json({ passos })
}
