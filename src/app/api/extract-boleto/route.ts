import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const CATEGORIAS = ['operacional', 'obra', 'financeiro']
const SUBCATEGORIAS = ['aluguel', 'energia', 'internet', 'funcionários', 'manutenção', 'fornecedores', 'extras', 'outros']

function buildPrompt(espacosNomes: string[]): string {
  const espacosLista = espacosNomes.length > 0 ? espacosNomes.map(e => `"${e}"`).join(', ') : '(nenhum espaço cadastrado)'
  return `Analise este boleto/comprovante de pagamento OU uma mensagem de WhatsApp contendo uma Ordem de Serviço / Ordem de Pagamento, e extraia os dados em JSON no formato abaixo. Use null para qualquer campo que não aparecer com segurança no conteúdo — não invente valores. Datas sempre no formato DD/MM/AAAA. Retorne APENAS o JSON, sem texto adicional.

{
  "descricao": string | null,
  "fornecedor": string | null,
  "valor": "R$ 0,00" | null,
  "vencimento": "DD/MM/AAAA" | null,
  "dataPagamento": "DD/MM/AAAA" | null,
  "formaPagamento": string | null,
  "chavePagamento": string | null,
  "espaco": string | null,
  "categoria": "operacional" | "obra" | "financeiro" | null,
  "subcategoria": "aluguel" | "energia" | "internet" | "funcionários" | "manutenção" | "fornecedores" | "extras" | "outros" | null,
  "observacoes": string | null,
  "cnpj": "XX.XXX.XXX/XXXX-XX" | null
}

Dicas:
- "descricao": um resumo curto do que é a despesa (ex: "Manutenção elétrica — Complexo Jussara").
- "fornecedor": nome de quem vai receber o pagamento (pessoa ou empresa).
- "formaPagamento": ex: PIX, transferência, boleto, dinheiro.
- "chavePagamento": chave PIX, dados bancários (banco/agência/conta) ou qualquer identificador de pagamento mencionado.
- "espaco": só use um destes nomes exatos, se o texto claramente se referir a um deles: ${espacosLista}. Caso contrário, null.
- "categoria" e "subcategoria": só use um dos valores exatos listados acima; se não tiver certeza, null.
- "observacoes": qualquer informação adicional relevante que não se encaixe nos outros campos.`
}

interface BoletoExtraido {
  descricao?: string | null
  fornecedor?: string | null
  valor?: string | null
  vencimento?: string | null
  dataPagamento?: string | null
  formaPagamento?: string | null
  chavePagamento?: string | null
  espaco?: string | null
  categoria?: string | null
  subcategoria?: string | null
  observacoes?: string | null
  cnpj?: string | null
}

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
  const texto = formData.get('text')
  const espacosRaw = formData.get('espacos')
  let espacosNomes: string[] = []
  if (typeof espacosRaw === 'string') {
    try {
      const parsed = JSON.parse(espacosRaw)
      if (Array.isArray(parsed)) espacosNomes = parsed.filter((e): e is string => typeof e === 'string')
    } catch {
      // lista de espaços é só uma dica pro prompt — segue sem ela se vier malformada
    }
  }

  let contentBlock: Anthropic.Messages.ContentBlockParam

  if (typeof texto === 'string' && texto.trim()) {
    contentBlock = { type: 'text', text: `Conteúdo colado pelo usuário (ex: conversa de WhatsApp com uma Ordem de Serviço/Pagamento):\n\n${texto.trim()}` }
  } else if (file instanceof File) {
    const ext = file.name.split('.').pop()?.toLowerCase()
    const isPdf = file.type === 'application/pdf' || ext === 'pdf'
    const isImage = file.type.startsWith('image/')

    if (file.type === 'image/heic' || file.type === 'image/heif') {
      return NextResponse.json(
        { error: 'Fotos em formato HEIC não são lidas pela IA — use o botão "Tirar foto" (gera JPEG) ou converta o arquivo antes de anexar.' },
        { status: 400 },
      )
    }
    if (!isPdf && !isImage) {
      return NextResponse.json({ error: 'Formato de arquivo não suportado para leitura por IA. Envie um PDF ou imagem.' }, { status: 400 })
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
      max_tokens: 1024,
      output_config: { effort: 'low' },
      messages: [
        {
          role: 'user',
          content: [contentBlock, { type: 'text', text: buildPrompt(espacosNomes) }],
        },
      ],
    })

    const textBlock = message.content.find((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
    const raw = textBlock?.text ?? '{}'
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '')

    let parsed: BoletoExtraido
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      parsed = {}
    }

    return NextResponse.json({
      descricao: parsed.descricao ?? null,
      fornecedor: parsed.fornecedor ?? null,
      valor: parsed.valor ?? null,
      vencimento: parsed.vencimento ?? null,
      dataPagamento: parsed.dataPagamento ?? null,
      formaPagamento: parsed.formaPagamento ?? null,
      chavePagamento: parsed.chavePagamento ?? null,
      espaco: parsed.espaco && espacosNomes.includes(parsed.espaco) ? parsed.espaco : null,
      categoria: parsed.categoria && CATEGORIAS.includes(parsed.categoria) ? parsed.categoria : null,
      subcategoria: parsed.subcategoria && SUBCATEGORIAS.includes(parsed.subcategoria) ? parsed.subcategoria : null,
      observacoes: parsed.observacoes ?? null,
      cnpj: parsed.cnpj ?? null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido ao consultar a IA.'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
