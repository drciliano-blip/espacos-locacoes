// Parser de extrato bancário OFX — puro, sem dependências. Bancos brasileiros
// tipicamente exportam OFX 1.x (SGML), não XML bem formado: tags podem não
// ser fechadas (ex: <TRNAMT>-150.00 sem </TRNAMT>). Por isso não usamos um
// parser de XML "de verdade" — extraímos tag por tag via regex, tolerante a
// isso.

export type TipoMovimentacao = 'entrada' | 'saida'
export type TipoTransacao = 'pix' | 'ted' | 'doc' | 'boleto' | 'cartao' | 'transferencia' | 'tarifa' | 'outro'

export interface MovimentacaoExtraida {
  data: string // YYYY-MM-DD
  hora?: string // HH:MM
  descricao: string
  valor: number // sempre positivo — o sinal já foi convertido em `tipo`
  tipo: TipoMovimentacao
  tipoTransacao?: TipoTransacao
  identificadorTransacao?: string
  favorecidoPagador?: string
}

export interface ExtratoParseado {
  banco?: string
  conta?: string
  periodoInicio?: string
  periodoFim?: string
  saldoInicial?: number
  saldoFinal?: number
  movimentacoes: MovimentacaoExtraida[]
}

// Lê o conteúdo de uma tag folha (<TAG>valor), tolerante a tag não fechada —
// para no próximo '<' ou quebra de linha, o que vier primeiro.
function getTag(source: string, tag: string): string | undefined {
  const match = source.match(new RegExp(`<${tag}>([^<\r\n]*)`, 'i'))
  return match ? match[1].trim() : undefined
}

function getNumber(source: string, tag: string): number | undefined {
  const raw = getTag(source, tag)
  if (!raw) return undefined
  const n = parseFloat(raw.replace(',', '.'))
  return Number.isFinite(n) ? n : undefined
}

// Extrai todos os blocos <TAG>...</TAG>. Se a tag vier fechada (comum em
// extratos de banco brasileiro para STMTTRN, mesmo em OFX 1.x), usa isso.
// Caso contrário, cai para dividir pelo próximo <TAG> de abertura.
function getBlocks(source: string, tag: string): string[] {
  const closed = source.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'gi'))
  if (closed && closed.length > 0) {
    return closed.map(block => block.replace(new RegExp(`^<${tag}>|<\\/${tag}>$`, 'gi'), ''))
  }
  const openTagRe = new RegExp(`<${tag}>`, 'gi')
  const starts: number[] = []
  let m: RegExpExecArray | null
  while ((m = openTagRe.exec(source))) starts.push(m.index + m[0].length)
  return starts.map((start, i) => source.slice(start, i + 1 < starts.length ? starts[i + 1] : source.length))
}

// OFX: YYYYMMDD[HHMMSS][.xxx][[+-]TZ[:TZNAME]]
function parseOfxDate(raw: string | undefined): { data?: string; hora?: string } {
  if (!raw) return {}
  const digits = raw.trim()
  if (digits.length < 8) return {}
  const ano = digits.slice(0, 4)
  const mes = digits.slice(4, 6)
  const dia = digits.slice(6, 8)
  const data = `${ano}-${mes}-${dia}`
  if (digits.length >= 12) {
    const h = digits.slice(8, 10)
    const min = digits.slice(10, 12)
    return { data, hora: `${h}:${min}` }
  }
  return { data }
}

function mapTipoTransacao(trntype: string | undefined, texto: string): TipoTransacao {
  const t = texto.toLowerCase()
  if (t.includes('pix')) return 'pix'
  if (t.includes('ted')) return 'ted'
  if (t.includes('doc') && /\bdoc\b/.test(t)) return 'doc'
  if (t.includes('boleto')) return 'boleto'
  if (t.includes('cart')) return 'cartao'
  if (t.includes('transf')) return 'transferencia'
  if (t.includes('tarifa') || t.includes('taxa') || t.includes('anuidade')) return 'tarifa'

  const tt = (trntype ?? '').toUpperCase()
  if (tt === 'FEE' || tt === 'SRVCHG') return 'tarifa'
  if (tt === 'XFER') return 'transferencia'
  if (tt === 'CHECK') return 'boleto'
  if (tt === 'POS' || tt === 'CASH') return 'cartao'
  return 'outro'
}

export function parseOfx(content: string): ExtratoParseado {
  const bankAcct = content.match(/<BANKACCTFROM>([\s\S]*?)(?=<BANKTRANLIST>|<\/BANKACCTFROM>)/i)?.[1]
    ?? content.match(/<CCACCTFROM>([\s\S]*?)(?=<BANKTRANLIST>|<\/CCACCTFROM>)/i)?.[1]
    ?? ''
  const banco = getTag(bankAcct, 'BANKID')
  const conta = getTag(bankAcct, 'ACCTID')

  const tranList = content.match(/<BANKTRANLIST>([\s\S]*?)<\/BANKTRANLIST>/i)?.[1] ?? content
  const periodoInicio = parseOfxDate(getTag(tranList, 'DTSTART')).data
  const periodoFim = parseOfxDate(getTag(tranList, 'DTEND')).data

  const ledgerBal = content.match(/<LEDGERBAL>([\s\S]*?)(?:<\/LEDGERBAL>|<AVAILBAL>)/i)?.[1] ?? ''
  const saldoFinal = getNumber(ledgerBal, 'BALAMT')

  const blocks = getBlocks(content, 'STMTTRN')
  const movimentacoes: MovimentacaoExtraida[] = blocks.map((block): MovimentacaoExtraida => {
    const trnamt = getNumber(block, 'TRNAMT') ?? 0
    const { data, hora } = parseOfxDate(getTag(block, 'DTPOSTED'))
    const name = getTag(block, 'NAME')
    const memo = getTag(block, 'MEMO')
    const descricao = [name, memo].filter((v, i, arr) => v && arr.indexOf(v) === i).join(' — ') || 'Movimentação sem descrição'
    const trntype = getTag(block, 'TRNTYPE')

    return {
      data: data ?? '',
      hora,
      descricao,
      valor: Math.abs(trnamt),
      tipo: trnamt < 0 ? 'saida' : 'entrada',
      tipoTransacao: mapTipoTransacao(trntype, `${name ?? ''} ${memo ?? ''}`),
      identificadorTransacao: getTag(block, 'FITID') || getTag(block, 'CHECKNUM') || undefined,
      favorecidoPagador: name,
    }
  }).filter(mov => mov.data && mov.valor > 0)

  return {
    banco,
    conta,
    periodoInicio,
    periodoFim,
    saldoFinal,
    movimentacoes,
  }
}
