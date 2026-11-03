import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'

const BUCKET = 'arquivos'

// Minutas reais têm 5 a 11 páginas: o contrato completo passa de 12 mil tokens
// e leva perto de 1 minuto. Com 4096 tokens o texto saía cortado no meio de
// uma cláusula, e a resposta só chegava inteira no fim — a requisição caía por
// tempo antes. Agora o texto vai sendo enviado conforme é gerado (streaming).
export const maxDuration = 300

// Marca de erro no meio do streaming (o status HTTP já foi enviado como 200).
const MARCA_ERRO = '\u0000ERRO:'

function buildPrompt(variaveis: Record<string, string>): string {
  const linhas = Object.entries(variaveis)
    .filter(([, v]) => v)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n')

  return `Este documento é uma minuta real de contrato usada pela empresa. Gere a versão final do contrato, preenchendo os dados abaixo nos campos correspondentes, MANTENDO integralmente a estrutura, cláusulas e linguagem jurídica original do documento — não invente cláusulas novas nem resuma o texto original.

ATENÇÃO: a minuta pode ser um contrato já preenchido de um evento anterior, servindo de modelo. Nesse caso, TODOS os dados específicos daquele evento (nomes e documentos da contratante/cessionária, endereços, datas, horários de montagem/evento/desmontagem, número de pessoas, valores, parcelas e vencimentos) devem ser trocados pelos dados abaixo — inclusive em tabelas e cronogramas. Os dados da empresa dona do espaço (CEDENTE) permanecem como estão, salvo se informados abaixo.

Dados para preencher:
${linhas}

Se algum dado do contrato não tiver um correspondente abaixo, deixe "[a preencher]" no lugar do dado do evento anterior. Retorne APENAS o texto final e completo do contrato, sem comentários adicionais.`
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

  let base64: string
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
    if ((fileRow.mime_type || 'application/pdf') !== 'application/pdf') {
      return NextResponse.json({ error: 'A minuta anexada precisa estar em PDF para a IA conseguir ler.' }, { status: 400 })
    }

    const { data: blob, error: downloadError } = await supabase.storage.from(BUCKET).download(fileRow.storage_path)
    if (downloadError || !blob) {
      return NextResponse.json({ error: 'Não foi possível ler o arquivo da minuta.' }, { status: 502 })
    }
    base64 = Buffer.from(await blob.arrayBuffer()).toString('base64')
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao ler a minuta.'
    return NextResponse.json({ error: message }, { status: 502 })
  }

  const client = new Anthropic({ apiKey })
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const stream = client.messages.stream({
          model: 'claude-sonnet-5-5',
          max_tokens: 32000,
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
        stream.on('text', texto => controller.enqueue(encoder.encode(texto)))
        const final = await stream.finalMessage()
        if (final.stop_reason === 'max_tokens') {
          controller.enqueue(encoder.encode(`${MARCA_ERRO}O contrato ficou longo demais e saiu incompleto. Tente de novo ou avise o suporte.`))
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro desconhecido ao gerar contrato a partir da minuta.'
        controller.enqueue(encoder.encode(`${MARCA_ERRO}${message}`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } })
}
