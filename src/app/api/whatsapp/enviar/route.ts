import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { enviarTexto, normalizarNumero, whatsappConfigurado } from '@/lib/whatsapp/blip'
import type { EstadoAtendimento, Mensagem } from '@/lib/assistente/atendimentos'
import type { NivelAcesso } from '@/types'

// Envia pelo WhatsApp (Blip) uma resposta que a equipe aprovou na tela do
// atendimento. Roda com a sessão de quem clicou: só quem já pode ver o
// atendimento (admin e operacional) consegue enviar.

const JANELA_MS = 24 * 60 * 60 * 1000

export async function GET() {
  return NextResponse.json({ configurado: whatsappConfigurado() })
}

export async function POST(request: Request) {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const { data: perfil } = await sb.from('profiles').select('role, nome').eq('id', user.id).single()
  const role = perfil?.role as NivelAcesso | undefined
  if (role !== 'admin' && role !== 'operacional') return NextResponse.json({ error: 'Sem permissão para enviar mensagens.' }, { status: 403 })
  if (!whatsappConfigurado()) return NextResponse.json({ error: 'WhatsApp ainda não configurado no sistema.' }, { status: 503 })

  let body: { atendimentoId?: string; mensagemId?: string; texto?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 }) }

  const { data: at, error } = await sb.from('assistente_atendimentos').select('id, status, estado, mensagens').eq('id', body.atendimentoId ?? '').single()
  if (error || !at) return NextResponse.json({ error: 'Atendimento não encontrado.' }, { status: 404 })
  const estado = (at.estado ?? {}) as Partial<EstadoAtendimento>
  const mensagens = (at.mensagens ?? []) as Mensagem[]
  const msg = mensagens.find(m => m.id === body.mensagemId)
  if (!msg) return NextResponse.json({ error: 'Salve a mensagem antes de enviar (saia do campo e tente de novo).' }, { status: 404 })
  if (msg.enviada) return NextResponse.json({ error: 'Esta mensagem já foi enviada.' }, { status: 409 })
  const texto = (body.texto ?? msg.texto).trim()
  if (!texto) return NextResponse.json({ error: 'Mensagem vazia.' }, { status: 400 })

  const numero = estado.whatsapp ?? normalizarNumero(estado.dados?.telefone)
  if (!numero) return NextResponse.json({ error: 'Este atendimento não tem telefone com DDD.' }, { status: 400 })

  // Regra do WhatsApp oficial: fora de 24 h da última mensagem do cliente,
  // só modelo aprovado pela Meta (ainda não cadastrado).
  const ultimaDoCliente = [...mensagens].reverse().find(m => m.autor === 'cliente' && m.canal === 'whatsapp')
  if (!ultimaDoCliente || Date.now() - Date.parse(ultimaDoCliente.em) > JANELA_MS) {
    return NextResponse.json({ error: 'Passaram mais de 24 h desde a última mensagem do cliente pelo WhatsApp (ou ele ainda não escreveu por lá). Pela regra da Meta, aqui só vai modelo aprovado: copie e envie pelo celular por enquanto.' }, { status: 409 })
  }

  try {
    await enviarTexto(numero, texto)
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Falha ao enviar.' }, { status: 502 })
  }

  const agora = new Date().toISOString()
  const atualizadas = mensagens.map(m => (m.id === msg.id ? { ...m, texto, enviada: true, canal: 'whatsapp' as const, por: perfil?.nome ?? m.por } : m))
  const { error: e2 } = await sb.from('assistente_atendimentos').update({
    mensagens: atualizadas, updated_at: agora, updated_by_nome: perfil?.nome ?? null,
    ...(at.status === 'aberto' ? { status: 'enviado' } : {}),
  }).eq('id', at.id)
  if (e2) return NextResponse.json({ error: `Mensagem enviada, mas não consegui marcar no sistema: ${e2.message}` }, { status: 500 })
  return NextResponse.json({ ok: true, mensagens: atualizadas, status: at.status === 'aberto' ? 'enviado' : at.status })
}
