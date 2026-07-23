import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'

const BUCKET = 'arquivos'

function buildPrompt(variaveis: Record<string, string>): string {
  const linhas = Object.entries(variaveis)
    .filter(([, v]) => v)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n')

  return `Este documento é uma minuta real de contrato usada pela empresa. Gere a versão final do contrato, preenchendo os dados abaixo nos campos correspondentes, MANTENDO integralmente a estrutura, cláusulas e linguagem jurídica original do documento — não invente cláusulas novas nem resuma o texto original.

Dados para preencher:
${linhas}

Se algum dado não tiver correspondência clara no documento, deixe o campo original como estava (ex: um espaço em branco ou placeholder). Retorne APENAS o texto final do contrato, sem comentários adicionais.`
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada no servidor.' }, { status: 500 })
  }

  const { fileId, variaveis } = await request.json() as { fileId?: string; variaveis?: Record<string, string> }
  if (!fileId) {
    return NextResponse.json({ error: 'fileId é obrigatório.' }, { status: 400 })
  }

  try {
    const supabase = createAdminClient()
    const { data: fileRow, error: fileError } = await supabase
      .from('files')
      .select('storage_path, mime_type, name')
      .eq('id', fileId)
      .single()

    if (fileError || !fileRow) {
      return NextResponse.json({ error: 'Minuta não encontrada.' }, { status: 404 })
    }

    const { data: blob, error: downloadError } = await supabase.storage.from(BUCKET).download(fileRow.storage_path)
    if (downloadError || !blob) {
      return NextResponse.json({ error: 'Não foi possível ler o arquivo da minuta.' }, { status: 502 })
    }

    const arrayBuffer = await blob.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    const mimeType = fileRow.mime_type || 'application/pdf'

    if (mimeType !== 'application/pdf') {
      return NextResponse.json({ error: 'A minuta anexada precisa estar em PDF para a IA conseguir ler.' }, { status: 400 })
    }

    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      output_config: { effort: 'low' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
            { type: 'text', text: buildPrompt(variaveis ?? {}) },
          ],
        },
      ],
    })

    const textBlock = message.content.find((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
    const contractText = textBlock?.text ?? ''
    if (!contractText) {
      return NextResponse.json({ error: 'A IA não retornou nenhum texto.' }, { status: 502 })
    }

    return NextResponse.json({ contractText })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido ao gerar contrato a partir da minuta.'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
