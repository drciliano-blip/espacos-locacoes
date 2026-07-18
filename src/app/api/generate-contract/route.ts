import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY não configurada no servidor. Adicione a chave no arquivo .env.local para usar o gerador de contratos.' },
      { status: 500 },
    )
  }

  const body = await request.json().catch(() => null) as { templateText?: string; variaveis?: Record<string, string> } | null
  if (!body?.templateText) {
    return NextResponse.json({ error: 'Modelo de contrato ausente.' }, { status: 400 })
  }

  const variaveisTexto = Object.entries(body.variaveis ?? {})
    .map(([chave, valor]) => `${chave}: ${valor || '(não informado)'}`)
    .join('\n')

  const prompt = `Você vai preencher um modelo de contrato. Substitua cada campo no formato {{NOME_DO_CAMPO}} pelo valor correspondente fornecido abaixo. Mantenha o restante do texto exatamente como está, incluindo formatação, cláusulas e quebras de linha. Se um valor não foi informado, escreva "[a preencher]" no lugar do campo. Retorne APENAS o texto final do contrato, sem comentários adicionais.

MODELO:
${body.templateText}

VALORES:
${variaveisTexto}`

  try {
    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      output_config: { effort: 'low' },
      messages: [{ role: 'user', content: prompt }],
    })

    const textBlock = message.content.find((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
    const contractText = textBlock?.text?.trim() ?? ''

    return NextResponse.json({ contractText })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido ao consultar a IA.'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
