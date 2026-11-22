import { NextResponse } from 'next/server'

// A IA pode levar mais de 10 s (várias consultas seguidas): sem isto a conexão cai ("Load failed").
export const maxDuration = 60
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { canAccess } from '@/lib/auth'
import { MANUAL_SISTEMA } from '@/lib/assistente/manual-sistema'
import { mensagemErroIA } from '@/lib/assistente/ao-vivo'
import type { NivelAcesso } from '@/types'

// Lê um arquivo anexado no chat do assistente (print de tela, foto, PDF) e
// devolve uma descrição fiel em texto, que segue para o assistente junto com a
// pergunta. Assim a conversa guardada fica só em texto (sem imagens pesadas).

const MODEL = 'claude-opus-5-5'

const INSTRUCAO = `Um funcionário do sistema da Espaços & Locações anexou este arquivo no chat do assistente interno. Descreva o conteúdo para o assistente, que NÃO vê o arquivo.
- Print de tela do sistema: diga qual tela parece ser (use o MANUAL acima para reconhecer), transcreva os textos visíveis relevantes (títulos, campos preenchidos, valores, datas, nomes, botões), mensagens de erro ou aviso exatamente como aparecem, e o que parece estar destacado ou selecionado.
- Documento (ficha de cliente, comprovante, boleto, nota, contrato, conversa de WhatsApp): transcreva todos os dados úteis (nomes, CPF/CNPJ, telefone, e-mail, endereço, datas, horários, valores, espaço, forma de pagamento, códigos).
- Outra imagem: descreva objetivamente.
Seja fiel: não invente nem complete o que não está legível (diga "ilegível"). Responda em português, em texto corrido ou lista curta, sem markdown.`

export async function POST(request: Request) {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  const { data: perfil } = await sb.from('profiles').select('role').eq('id', user.id).single()
  if (!perfil || !canAccess(perfil.role as NivelAcesso, 'assistente')) return NextResponse.json({ error: 'Sem permissão para o Assistente de IA.' }, { status: 403 })
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada no servidor.' }, { status: 500 })

  const form = await request.formData()
  const file = form.get('file')
  const pergunta = String(form.get('pergunta') ?? '').slice(0, 2000)
  if (!(file instanceof File)) return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 })
  const tipo = file.type || 'application/octet-stream'
  if (tipo === 'image/heic' || tipo === 'image/heif') return NextResponse.json({ error: 'Foto em HEIC não é lida: tire um print ou use "Tirar foto" (gera JPEG).' }, { status: 400 })
  const dados = Buffer.from(await file.arrayBuffer()).toString('base64')

  let bloco: Anthropic.Beta.BetaContentBlockParam
  if (tipo === 'application/pdf') bloco = { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: dados } }
  else if (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(tipo)) bloco = { type: 'image', source: { type: 'base64', media_type: tipo as 'image/jpeg', data: dados } }
  else return NextResponse.json({ error: 'Envie imagem (JPG, PNG, WEBP) ou PDF.' }, { status: 400 })

  try {
    const msg = await new Anthropic({ apiKey }).beta.messages.create({
      model: MODEL,
      max_tokens: 3000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: [{ model: 'claude-opus-4-8' }],
      system: [{ type: 'text', text: MANUAL_SISTEMA, cache_control: { type: 'ephemeral' } }, { type: 'text', text: INSTRUCAO }],
      output_config: { effort: 'low' },
      messages: [{ role: 'user', content: [bloco, { type: 'text', text: `Arquivo: ${file.name}${pergunta ? `\nPergunta do funcionário: ${pergunta}` : ''}\n\nDescreva o arquivo.` }] }],
    })
    if (msg.stop_reason === 'refusal') return NextResponse.json({ error: 'A IA não conseguiu ler este arquivo.' }, { status: 422 })
    const descricao = msg.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text').map(b => b.text).join('\n').trim()
    return NextResponse.json({ descricao })
  } catch (err) {
    console.error('[assistente/anexo]', err)
    return NextResponse.json({ error: mensagemErroIA(err) }, { status: err instanceof Anthropic.RateLimitError ? 429 : 502 })
  }
}
