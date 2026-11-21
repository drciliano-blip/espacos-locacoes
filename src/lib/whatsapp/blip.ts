// Conexão com o WhatsApp oficial pelo Blip (Take Blip). Tudo que depende do
// formato da API do Blip fica SÓ aqui: se o Blip mudar algo, ajusta-se este
// arquivo. Uso exclusivo no servidor (rotas /api/whatsapp/*).
//
// Variáveis de ambiente (Vercel → Settings → Environment Variables):
//   BLIP_API_KEY        chave do robô/contrato no Blip (vai no cabeçalho "Authorization: Key ...")
//   BLIP_API_URL        endereço da API HTTP do Blip (padrão https://http.msging.net;
//                       alguns contratos usam https://<contrato>.http.msging.net)
//   BLIP_WEBHOOK_TOKEN  senha que vai no fim do endereço cadastrado no Blip para
//                       receber mensagens (?token=...), para ninguém mais postar ali

const DOMINIO_WA = '@wa.gateway.server'

export function whatsappConfigurado(): boolean {
  return !!process.env.BLIP_API_KEY
}

// "(11) 98888-7777", "+55 11 988887777", "5511988887777@wa.gateway.server/x" → "5511988887777"
export function normalizarNumero(v: string | null | undefined): string | null {
  if (!v) return null
  const digitos = v.split('@')[0].replace(/\D/g, '')
  if (digitos.length < 10) return null
  return digitos.length <= 11 ? `55${digitos}` : digitos
}

export function numeroParaExibir(n: string): string {
  const d = n.startsWith('55') ? n.slice(2) : n
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : n
}

function autorizacao(): string {
  const k = (process.env.BLIP_API_KEY ?? '').trim()
  return k.toLowerCase().startsWith('key ') ? k : `Key ${k}`
}

async function enviar(corpo: Record<string, unknown>): Promise<void> {
  if (!whatsappConfigurado()) throw new Error('WhatsApp ainda não configurado (falta a chave do Blip).')
  const base = (process.env.BLIP_API_URL || 'https://http.msging.net').replace(/\/+$/, '')
  const res = await fetch(`${base}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: autorizacao() },
    body: JSON.stringify({ id: crypto.randomUUID(), ...corpo }),
  })
  if (!res.ok) {
    const detalhe = (await res.text().catch(() => '')).slice(0, 300)
    throw new Error(`O Blip recusou o envio (${res.status})${detalhe ? `: ${detalhe}` : ''}`)
  }
}

export async function enviarTexto(numero: string, texto: string): Promise<void> {
  await enviar({ to: `${numero}${DOMINIO_WA}`, type: 'text/plain', content: texto })
}

// PDF ou imagem por link público.
export async function enviarArquivo(numero: string, url: string, nome: string, mime = 'application/pdf'): Promise<void> {
  await enviar({ to: `${numero}${DOMINIO_WA}`, type: 'application/vnd.lime.media-link+json', content: { title: nome, uri: url, type: mime } })
}

export interface MensagemRecebida {
  idExterno: string
  numero: string
  texto: string
  nome?: string
}

// Lê o que o Blip manda para o nosso endereço. Ignora notificações de entrega,
// mensagens nossas e tipos sem texto. Aceita também o formato da Cloud API da
// Meta, caso um dia o número seja ligado direto.
export function lerMensagemRecebida(corpo: unknown): MensagemRecebida[] {
  const out: MensagemRecebida[] = []
  const b = corpo as Record<string, unknown> | null
  if (!b || typeof b !== 'object') return out

  // Blip: { id, from: "55...@wa.gateway.server", to, type, content }
  if (typeof b.from === 'string' && 'content' in b && !('event' in b)) {
    const numero = normalizarNumero(b.from)
    const c = b.content as unknown
    let texto = ''
    if (typeof c === 'string') texto = c
    else if (c && typeof c === 'object') {
      const o = c as Record<string, unknown>
      texto = String(o.text ?? o.title ?? o.caption ?? (o.uri ? `[arquivo recebido: ${o.uri}]` : ''))
    }
    const meta = (b.metadata ?? {}) as Record<string, unknown>
    if (numero && texto.trim()) out.push({ idExterno: String(b.id ?? crypto.randomUUID()), numero, texto: texto.trim(), nome: typeof meta['#wa.profile.name'] === 'string' ? meta['#wa.profile.name'] as string : undefined })
    return out
  }

  // Cloud API da Meta: entry[].changes[].value.messages[]
  const entry = Array.isArray(b.entry) ? b.entry : []
  for (const e of entry as Record<string, unknown>[]) {
    for (const ch of (Array.isArray(e.changes) ? e.changes : []) as Record<string, unknown>[]) {
      const v = (ch.value ?? {}) as Record<string, unknown>
      const contatos = (Array.isArray(v.contacts) ? v.contacts : []) as { profile?: { name?: string } }[]
      for (const m of (Array.isArray(v.messages) ? v.messages : []) as Record<string, unknown>[]) {
        const numero = normalizarNumero(String(m.from ?? ''))
        const texto = (m.text as { body?: string } | undefined)?.body ?? ''
        if (numero && texto.trim()) out.push({ idExterno: String(m.id), numero, texto: texto.trim(), nome: contatos[0]?.profile?.name })
      }
    }
  }
  return out
}
