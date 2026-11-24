// WhatsApp direto pela Cloud API da Meta (campanhas + caixa de entrada).
// Tudo que depende do formato da Graph API fica aqui. Uso exclusivo no
// servidor. Separado do Blip (src/lib/whatsapp/blip.ts), que continua
// alimentando o Assistente de IA.
//
// Variáveis de ambiente (Vercel → Settings → Environment Variables):
//   WHATSAPP_TOKEN            token de acesso (temporário de 24 h ou permanente do System User)
//   WHATSAPP_PHONE_NUMBER_ID  id do número que envia
//   WHATSAPP_WABA_ID          id da conta do WhatsApp Business (lista de modelos)
//   WHATSAPP_APP_SECRET       chave secreta do app (assinatura do webhook)
//   WHATSAPP_VERIFY_TOKEN     senha nossa para a Meta verificar o webhook
//   WHATSAPP_GRAPH_VERSION    versão da Graph API (ex.: v23.0)
//   WHATSAPP_DAILY_LIMIT      contatos únicos por 24 h (250 hoje; 2000 após verificar a empresa)

import { createHmac, timingSafeEqual } from 'node:crypto'

export const JANELA_24H_MS = 24 * 60 * 60 * 1000

export function cloudConfigurado(): boolean {
  return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID)
}

export function limiteDiario(): number {
  const n = Number(process.env.WHATSAPP_DAILY_LIMIT)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 250
}

function versao(): string {
  const v = (process.env.WHATSAPP_GRAPH_VERSION || 'v23.0').trim()
  return v.startsWith('v') ? v : `v${v}`
}

// --- Assinatura do webhook (X-Hub-Signature-256: sha256=<hex>) --------------
export function assinaturaValida(corpoBruto: string, cabecalho: string | null): boolean {
  const segredo = process.env.WHATSAPP_APP_SECRET
  if (!segredo || !cabecalho?.startsWith('sha256=')) return false
  const esperado = createHmac('sha256', segredo).update(corpoBruto, 'utf8').digest()
  let recebido: Buffer
  try { recebido = Buffer.from(cabecalho.slice(7), 'hex') } catch { return false }
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado)
}

// --- Envio --------------------------------------------------------------------
export class ErroMeta extends Error {
  constructor(message: string, public http: number, public detalhe: unknown, public codigo?: number) { super(message) }
  // Token vencido/inválido ou sem permissão: não adianta seguir o lote.
  get bloqueiaTudo(): boolean { return this.http === 401 || this.codigo === 190 || this.codigo === 10 || this.codigo === 200 }
}

async function postarMensagem(corpo: Record<string, unknown>): Promise<string> {
  if (!cloudConfigurado()) throw new ErroMeta('WhatsApp (Meta) ainda não configurado: faltam WHATSAPP_TOKEN e WHATSAPP_PHONE_NUMBER_ID.', 503, null)
  const res = await fetch(`https://graph.facebook.com/${versao()}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...corpo }),
  })
  const json = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string; code?: number; error_data?: { details?: string } } }
  if (!res.ok || !json.messages?.[0]?.id) {
    const e = json.error
    const texto = e?.error_data?.details || e?.message || `HTTP ${res.status}`
    throw new ErroMeta(`A Meta recusou o envio: ${texto}${e?.code ? ` (código ${e.code})` : ''}`, res.status, json.error ?? json, e?.code)
  }
  return json.messages[0].id
}

// corpo: valores de {{1}}, {{2}}... do corpo do modelo, em ordem.
export function enviarTemplate(telefone: string, nome: string, idioma: string, corpo: string[] = []): Promise<string> {
  const template: Record<string, unknown> = { name: nome, language: { code: idioma } }
  if (corpo.length) template.components = [{ type: 'body', parameters: corpo.map(text => ({ type: 'text', text })) }]
  return postarMensagem({ to: telefone, type: 'template', template })
}

export function enviarTextoCloud(telefone: string, texto: string): Promise<string> {
  return postarMensagem({ to: telefone, type: 'text', text: { preview_url: false, body: texto } })
}

export interface ModeloMeta {
  name: string; language: string; status: string; category: string
  texto: string          // corpo, com {{1}}...
  variaveis: number      // quantos {{n}} no corpo
  suportado: boolean     // o sistema sabe preencher (só corpo; até 1 variável = primeiro nome; sem cabeçalho de mídia)
}

interface ComponenteMeta { type: string; text?: string; format?: string }

// Modelos da conta (para escolher na campanha).
export async function listarModelos(): Promise<ModeloMeta[]> {
  const waba = process.env.WHATSAPP_WABA_ID
  if (!waba || !process.env.WHATSAPP_TOKEN) return []
  const res = await fetch(`https://graph.facebook.com/${versao()}/${waba}/message_templates?fields=name,language,status,category,components&limit=200`, {
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` },
    cache: 'no-store',
  })
  if (!res.ok) throw new ErroMeta(`Não consegui ler os modelos na Meta (HTTP ${res.status}).`, res.status, await res.text().catch(() => ''))
  const json = (await res.json()) as { data?: (Omit<ModeloMeta, 'texto' | 'variaveis' | 'suportado'> & { components?: ComponenteMeta[] })[] }
  return (json.data ?? []).map(({ components = [], ...m }) => {
    const corpo = components.find(c => c.type === 'BODY')?.text ?? ''
    const cabecalho = components.find(c => c.type === 'HEADER')
    const variaveis = new Set(corpo.match(/\{\{\s*\d+\s*\}\}/g) ?? []).size
    const cabecalhoOk = !cabecalho || (cabecalho.format === 'TEXT' && !/\{\{/.test(cabecalho.text ?? ''))
    return { ...m, texto: corpo, variaveis, suportado: variaveis <= 1 && cabecalhoOk }
  })
}

// Nomes, segmentos e telefones: funções puras em ./segmentos (a tela também usa).
export { SEGMENTOS, SEM_NOME, normalizarTelefone, pedeSaida, primeiroNome, segmentoDoNome, valorParametro } from './segmentos'
