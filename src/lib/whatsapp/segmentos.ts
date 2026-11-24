// Nomes, segmentos e telefones dos contatos do WhatsApp Campanhas.
// Funções puras, sem dependências: usadas na tela e no servidor.

// Segmentos (espaço de origem). "Geral" = cliente sem espaço específico.
export const SEGMENTOS = ['Fabrique', 'Usine', 'Triplex', 'Aurea', 'House', 'Club A', 'Spotz', 'Geral'] as const

function semAcento(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

// "Fulano Cliente Fabrique Clipe" → "Fabrique"; "06/04 Áurea Daniel - HYPE Cliente Aurea" → "Aurea".
// Procura primeiro depois do último "cliente", depois no nome todo.
export function segmentoDoNome(nome: string | null | undefined): string | null {
  if (!nome) return null
  const n = semAcento(nome).replace(/\btrilplex\b/g, 'triplex') // erros de digitação vistos na lista
  const i = n.lastIndexOf('cliente')
  const trechos = i >= 0 ? [n.slice(i + 7), n] : [n]
  for (const t of trechos) {
    if (/\bclub\s*a\b/.test(t)) return 'Club A'
    for (const s of SEGMENTOS) if (s !== 'Club A' && s !== 'Geral' && new RegExp(`\\b${semAcento(s)}\\b`).test(t)) return s
  }
  // "Cliente 33" / "Club 33": cliente normal, sem espaço específico.
  if (i >= 0 && /^\s*(club\s*)?33\b/.test(n.slice(i + 7))) return 'Geral'
  return null
}

// Primeiro nome para o {{1}} do modelo, a partir do nome salvo no celular
// ("Isabela gracacao Cliente Fabrique" → "Isabela"). Sem nome aproveitável
// (". Cliente Fabrique", "@perfil Cliente Triplex") → "tudo bem", que deixa
// "Olá, tudo bem! ..." natural.
const NAO_E_NOME = new Set(['cliente', 'clientes', 'cliete', 'sr', 'sra', 'dr', 'dra', 'fabrique', 'usine', 'triplex', 'aurea', 'house', 'club', 'casa', 'spotz', 'locacao', 'evento', 'eventos'])
export const SEM_NOME = 'tudo bem'

export function primeiroNome(nome: string | null | undefined): string {
  if (!nome) return SEM_NOME
  let n = nome.normalize('NFC').replace(/[\u200e\u200f\ufeff]/g, ' ')
  const i = semAcento(n).search(/\bclient/)
  if (i >= 0) n = n.slice(0, i)
  for (const w of n.split(/[\s\-_.,/|()]+/)) {
    if (w.startsWith('@') || /\d/.test(w)) continue
    const p = w.replace(/[^\p{L}]/gu, '')
    if (p.length < 2 || NAO_E_NOME.has(semAcento(p))) continue
    return p[0].toLocaleUpperCase('pt-BR') + p.slice(1).toLocaleLowerCase('pt-BR')
  }
  return SEM_NOME
}

// Valor de cada parâmetro de campanha (wa_campaigns.parametros).
export function valorParametro(param: string, contato: { nome: string | null }): string {
  if (param === 'primeiro_nome') return primeiroNome(contato.nome)
  return SEM_NOME
}

// Telefone para E.164 sem "+" (Brasil por padrão). null se não der para usar.
export function normalizarTelefone(v: string | null | undefined): string | null {
  if (!v) return null
  const d = v.replace(/\D/g, '')
  if (d.length === 10 || d.length === 11) return `55${d}` // DDD + número, sem país
  if (d.length >= 12 && d.length <= 15) return d
  return null
}

// Pedido de saída: botão "Não tenho interesse" ou texto SAIR/PARAR etc.
export function pedeSaida(texto: string | null | undefined): boolean {
  if (!texto) return false
  const t = semAcento(texto).trim().replace(/[.!]+$/, '')
  return t === 'nao tenho interesse' || ['sair', 'parar', 'pare', 'stop', 'cancelar', 'descadastrar'].includes(t)
}
