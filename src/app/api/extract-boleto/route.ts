import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const PROMPT = `Analise este documento e extraia em JSON: { vencimento: 'DD/MM/AAAA', valor: 'R$ 0,00', fornecedor: 'nome', cnpj: 'XX.XXX.XXX/XXXX-XX' }. Retorne APENAS o JSON, sem texto adicional.`

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY não configurada no servidor. Adicione a chave no arquivo .env.local para usar a leitura automática de boletos.' },
      { status: 500 },
    )
  }

  const formData = await request.formData()
  const file = formData.get('file')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 })
  }

  const arrayBuffer = await file.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString('base64')
  const mimeType = file.type || 'application/octet-stream'

  let contentBlock: Anthropic.Messages.ContentBlockParam
  if (mimeType === 'application/pdf') {
    contentBlock = {
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: base64 },
    }
  } else if (mimeType.startsWith('image/')) {
    contentBlock = {
      type: 'image',
      source: { type: 'base64', media_type: mimeType as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif', data: base64 },
    }
  } else {
    return NextResponse.json({ error: 'Formato de arquivo não suportado para leitura por IA. Envie um PDF ou imagem.' }, { status: 400 })
  }

  try {
    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      output_config: { effort: 'low' },
      messages: [
        {
          role: 'user',
          content: [contentBlock, { type: 'text', text: PROMPT }],
        },
      ],
    })

    const textBlock = message.content.find((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
    const raw = textBlock?.text ?? '{}'
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '')

    let parsed: { vencimento?: string | null; valor?: string | null; fornecedor?: string | null; cnpj?: string | null }
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      parsed = {}
    }

    return NextResponse.json({
      vencimento: parsed.vencimento ?? null,
      valor: parsed.valor ?? null,
      fornecedor: parsed.fornecedor ?? null,
      cnpj: parsed.cnpj ?? null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido ao consultar a IA.'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
