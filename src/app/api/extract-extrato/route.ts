import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const TIPOS = ['entrada', 'saida']
const TIPOS_TRANSACAO = ['pix', 'ted', 'doc', 'boleto', 'cartao', 'transferencia', 'tarifa', 'outro']

const PROMPT = `Analise este extrato bancário (PDF ou texto tabular de planilha CSV/XLS) e extraia TODAS as movimentações em JSON no formato abaixo. Use null para qualquer campo que não aparecer com segurança — não invente valores. Datas sempre no formato DD/MM/AAAA. Retorne APENAS o JSON, sem texto adicional.

{
  "banco": string | null,
  "conta": string | null,
  "periodoInicio": "DD/MM/AAAA" | null,
  "periodoFim": "DD/MM/AAAA" | null,
  "saldoInicial": "R$ 0,00" | null,
  "saldoFinal": "R$ 0,00" | null,
  "movimentacoes": [
    {
      "data": "DD/MM/AAAA",
      "hora": "HH:MM" | null,
      "descricao": string,
      "valor": "R$ 0,00",
      "tipo": "entrada" | "saida",
      "tipoTransacao": "pix" | "ted" | "doc" | "boleto" | "cartao" | "transferencia" | "tarifa" | "outro" | null,
      "identificadorTransacao": string | null,
      "favorecidoPagador": string | null
    }
  ]
}

Dicas:
- Extraia TODAS as linhas de movimentação do extrato, uma por uma — não resuma, não agrupe, não pule nenhuma.
- "tipo": "entrada" para crédito/depósito/recebimento, "saida" para débito/pagamento/saque. Nunca use o sinal do valor pra decidir — decida pelo sentido real da movimentação (extratos às vezes mostram tudo positivo, com o tipo indicado só na coluna ou texto).
- "valor": sempre positivo (o sinal já está em "tipo").
- "descricao": o texto da movimentação como aparece no extrato (histórico/descrição do banco).
- "tipoTransacao": classifique pelo texto da descrição — "pix", "ted", "doc" (DOC bancário), "boleto", "cartao" (compra/débito em cartão), "transferencia" (TEF/transferência entre contas), "tarifa" (tarifa/taxa bancária), ou "outro" se não der pra identificar.
- "identificadorTransacao": código único da transação, se aparecer (autenticação, ID/E2E do PIX, número do documento).
- "favorecidoPagador": nome de quem recebeu (numa saída) ou de quem pagou (numa entrada), se identificável na descrição.
- "banco"/"conta": nome do banco e número da conta/agência, se aparecerem no cabeçalho do extrato.
- "saldoInicial"/"saldoFinal": saldo no início e no fim do período do extrato, se informados.`

interface MovimentacaoExtraidaIA {
  data?: string | null
  hora?: string | null
  descricao?: string | null
  valor?: string | null
  tipo?: string | null
  tipoTransacao?: string | null
  identificadorTransacao?: string | null
  favorecidoPagador?: string | null
}

interface ExtratoExtraidoIA {
  banco?: string | null
  conta?: string | null
  periodoInicio?: string | null
  periodoFim?: string | null
  saldoInicial?: string | null
  saldoFinal?: string | null
  movimentacoes?: MovimentacaoExtraidaIA[]
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY não configurada no servidor. Adicione a chave no arquivo .env.local para usar a leitura automática de extratos.' },
      { status: 500 },
    )
  }

  const formData = await request.formData()
  const file = formData.get('file')
  const texto = formData.get('text')

  let contentBlock: Anthropic.Messages.ContentBlockParam

  if (typeof texto === 'string' && texto.trim()) {
    contentBlock = { type: 'text', text: `Extrato convertido para texto tabular (planilha CSV/XLS):\n\n${texto.trim()}` }
  } else if (file instanceof File) {
    const ext = file.name.split('.').pop()?.toLowerCase()
    const isPdf = file.type === 'application/pdf' || ext === 'pdf'
    const isImage = file.type.startsWith('image/')

    if (file.type === 'image/heic' || file.type === 'image/heif') {
      return NextResponse.json(
        { error: 'Fotos em formato HEIC não são lidas pela IA — converta o arquivo antes de anexar.' },
        { status: 400 },
      )
    }
    if (!isPdf && !isImage) {
      return NextResponse.json({ error: 'Formato de arquivo não suportado para leitura por IA. Envie um PDF ou imagem do extrato.' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')
    const mimeType = file.type || 'application/octet-stream'

    if (mimeType === 'application/pdf') {
      contentBlock = {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: base64 },
      }
    } else {
      contentBlock = {
        type: 'image',
        source: { type: 'base64', media_type: mimeType as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif', data: base64 },
      }
    }
  } else {
    return NextResponse.json({ error: 'Nenhum arquivo ou texto enviado.' }, { status: 400 })
  }

  try {
    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      // Extrato tem muito mais linhas que um boleto — precisa de mais espaço
      // de saída que o extract-boleto (que lê uma transação só).
      max_tokens: 8192,
      output_config: { effort: 'medium' },
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

    let parsed: ExtratoExtraidoIA
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      // Resposta cortada por limite de tokens costuma quebrar o JSON — sem
      // isso a tela importaria dado parcial sem avisar.
      return NextResponse.json({
        error: message.stop_reason === 'max_tokens'
          ? 'O extrato tem muitas movimentações para uma leitura só — tente um arquivo com período menor.'
          : 'Não foi possível interpretar a resposta da IA para este extrato.',
      }, { status: 502 })
    }

    const movimentacoes = (parsed.movimentacoes ?? [])
      .filter(m => m.data && m.valor && (m.tipo === 'entrada' || m.tipo === 'saida'))
      .map(m => ({
        data: m.data as string,
        hora: m.hora && /^\d{1,2}:\d{2}$/.test(m.hora) ? m.hora : null,
        descricao: m.descricao ?? 'Movimentação sem descrição',
        valor: m.valor as string,
        tipo: m.tipo as 'entrada' | 'saida',
        tipoTransacao: m.tipoTransacao && TIPOS_TRANSACAO.includes(m.tipoTransacao) ? m.tipoTransacao : null,
        identificadorTransacao: m.identificadorTransacao ?? null,
        favorecidoPagador: m.favorecidoPagador ?? null,
      }))
      .filter(m => TIPOS.includes(m.tipo))

    return NextResponse.json({
      banco: parsed.banco ?? null,
      conta: parsed.conta ?? null,
      periodoInicio: parsed.periodoInicio ?? null,
      periodoFim: parsed.periodoFim ?? null,
      saldoInicial: parsed.saldoInicial ?? null,
      saldoFinal: parsed.saldoFinal ?? null,
      movimentacoes,
      truncado: message.stop_reason === 'max_tokens',
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido ao consultar a IA.'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
