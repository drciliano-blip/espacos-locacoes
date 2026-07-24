import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const PROMPT = `Analise esta ficha de cadastro de cliente (pode ser um formulário preenchido à mão, digitado, um documento de identidade/contrato social, ou uma conversa de WhatsApp com os dados do cliente) e extraia os dados em JSON no formato abaixo. Use null para qualquer campo que não aparecer no conteúdo. Datas sempre no formato DD/MM/AAAA. Retorne APENAS o JSON, sem texto adicional.

{
  "nomeCompleto": string | null,
  "cpf": string | null,
  "rg": string | null,
  "dataNascimento": "DD/MM/AAAA" | null,
  "email": string | null,
  "telefoneCelular": string | null,
  "endereco": {
    "rua": string | null, "numero": string | null, "complemento": string | null,
    "bairro": string | null, "cidade": string | null, "estado": string | null, "cep": string | null
  },
  "pessoaJuridica": boolean,
  "razaoSocial": string | null,
  "nomeFantasia": string | null,
  "cnpj": string | null,
  "nomeEvento": string | null,
  "espacoDesejado": string | null,
  "tipoEvento": string | null,
  "dataEvento": "DD/MM/AAAA" | null,
  "horaInicioMontagem": "HH:MM" | null,
  "horaInicioEvento": "HH:MM" | null,
  "horaTerminoEvento": "HH:MM" | null,
  "valorLocacao": string | null,
  "formaPagamento": string | null,
  "valorSinal": string | null,
  "dataVencimentoSaldo": "DD/MM/AAAA" | null
}

Dicas para localizar os campos de valor, que podem aparecer com nomes diferentes no documento:
- "valorLocacao": procure por "valor da locação", "valor total", "valor do contrato", "valor combinado", "valor do evento" ou qualquer quantia em R$ que represente o valor total acordado. Retorne só os números (ex: "16.000,00"), sem o "R$".
- "valorSinal": procure por "sinal", "entrada", "adiantamento" ou primeira parcela. Mesmo formato numérico.
- Se o documento tiver uma tabela ou lista de parcelas/pagamentos, some os valores para preencher "valorLocacao" caso não haja um total explícito.`

interface EnderecoExtraido {
  rua?: string | null; numero?: string | null; complemento?: string | null
  bairro?: string | null; cidade?: string | null; estado?: string | null; cep?: string | null
}

interface FichaExtraida {
  nomeCompleto?: string | null
  cpf?: string | null
  rg?: string | null
  dataNascimento?: string | null
  email?: string | null
  telefoneCelular?: string | null
  endereco?: EnderecoExtraido | null
  pessoaJuridica?: boolean | null
  razaoSocial?: string | null
  nomeFantasia?: string | null
  cnpj?: string | null
  nomeEvento?: string | null
  espacoDesejado?: string | null
  tipoEvento?: string | null
  dataEvento?: string | null
  horaInicioMontagem?: string | null
  horaInicioEvento?: string | null
  horaTerminoEvento?: string | null
  valorLocacao?: string | null
  formaPagamento?: string | null
  valorSinal?: string | null
  dataVencimentoSaldo?: string | null
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY não configurada no servidor. Adicione a chave no arquivo .env.local para usar a leitura automática da ficha.' },
      { status: 500 },
    )
  }

  const formData = await request.formData()
  const file = formData.get('file')
  const texto = formData.get('text')

  let contentBlock: Anthropic.Messages.ContentBlockParam

  if (typeof texto === 'string' && texto.trim()) {
    contentBlock = { type: 'text', text: `Conteúdo colado pelo usuário (ex: conversa de WhatsApp):\n\n${texto.trim()}` }
  } else if (file instanceof File) {
    const mimeType = file.type || 'application/octet-stream'
    if (mimeType === 'image/heic' || mimeType === 'image/heif') {
      return NextResponse.json(
        { error: 'Fotos em formato HEIC não são lidas pela IA — use o botão "Tirar foto" (gera JPEG) ou converta o arquivo antes de anexar.' },
        { status: 400 },
      )
    }

    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')

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
  } else {
    return NextResponse.json({ error: 'Nenhum arquivo ou texto enviado.' }, { status: 400 })
  }

  try {
    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1536,
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

    let parsed: FichaExtraida
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      parsed = {}
    }

    return NextResponse.json({
      nomeCompleto: parsed.nomeCompleto ?? null,
      cpf: parsed.cpf ?? null,
      rg: parsed.rg ?? null,
      dataNascimento: parsed.dataNascimento ?? null,
      email: parsed.email ?? null,
      telefoneCelular: parsed.telefoneCelular ?? null,
      endereco: {
        rua: parsed.endereco?.rua ?? null,
        numero: parsed.endereco?.numero ?? null,
        complemento: parsed.endereco?.complemento ?? null,
        bairro: parsed.endereco?.bairro ?? null,
        cidade: parsed.endereco?.cidade ?? null,
        estado: parsed.endereco?.estado ?? null,
        cep: parsed.endereco?.cep ?? null,
      },
      pessoaJuridica: parsed.pessoaJuridica ?? false,
      razaoSocial: parsed.razaoSocial ?? null,
      nomeFantasia: parsed.nomeFantasia ?? null,
      cnpj: parsed.cnpj ?? null,
      nomeEvento: parsed.nomeEvento ?? null,
      espacoDesejado: parsed.espacoDesejado ?? null,
      tipoEvento: parsed.tipoEvento ?? null,
      dataEvento: parsed.dataEvento ?? null,
      horaInicioMontagem: parsed.horaInicioMontagem ?? null,
      horaInicioEvento: parsed.horaInicioEvento ?? null,
      horaTerminoEvento: parsed.horaTerminoEvento ?? null,
      valorLocacao: parsed.valorLocacao ?? null,
      formaPagamento: parsed.formaPagamento ?? null,
      valorSinal: parsed.valorSinal ?? null,
      dataVencimentoSaldo: parsed.dataVencimentoSaldo ?? null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido ao consultar a IA.'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
