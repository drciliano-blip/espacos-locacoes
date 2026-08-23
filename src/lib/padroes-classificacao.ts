// Aprendizado de padrão de classificação — puro (sem React/Supabase). Nunca
// aplica sozinho: só sugere, sempre exige confirmação do usuário (ver
// PadroesClassificacaoContext e a tela de Classificação em Lote).

import { normalizarTexto } from '@/lib/conciliacao-bancaria'

export type ClassificacaoPadrao = 'lancamento' | 'transferencia' | 'ignorar'

export interface PadraoClassificacao {
  id: string
  padraoTexto: string
  tipo: 'entrada' | 'saida'
  classificacao: ClassificacaoPadrao
  espaco?: string
  categoriaReceitaId?: string
  tipoEntrada?: string
  categoriaConta?: string
  subcategoriaConta?: string
  vezesUsado: number
}

const TAMANHO_MINIMO_PALAVRA = 4

// Palavras curtas ou genéricas demais pra virar um padrão sozinhas — sem
// isso, quase toda movimentação de PIX/transferência geraria um padrão
// inútil (ex: "PIX" → sugere o mesmo pra qualquer PIX, o que não ajuda).
const PALAVRAS_IGNORADAS = new Set(['pix', 'ted', 'doc', 'pagto', 'pagamento', 'transferencia', 'recebimento', 'deposito', 'boleto'])

export function extrairPalavrasChave(descricao: string): string[] {
  const palavras = normalizarTexto(descricao).split(' ')
    .filter(w => w.length >= TAMANHO_MINIMO_PALAVRA && !PALAVRAS_IGNORADAS.has(w))
  return Array.from(new Set(palavras))
}

// Entre os padrões cujo texto aparece nas palavras-chave da descrição,
// devolve o mais usado (maior vezesUsado) — nunca aplica sozinho, só sugere.
export function sugerirPadrao(descricao: string, tipo: 'entrada' | 'saida', padroes: PadraoClassificacao[]): PadraoClassificacao | null {
  const palavras = new Set(extrairPalavrasChave(descricao))
  if (palavras.size === 0) return null

  const candidatos = padroes.filter(p => p.tipo === tipo && palavras.has(p.padraoTexto))
  if (candidatos.length === 0) return null

  return candidatos.reduce((melhor, atual) => atual.vezesUsado > melhor.vezesUsado ? atual : melhor)
}
