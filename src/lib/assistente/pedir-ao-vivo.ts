// Lado da tela: chama a rota do assistente pedindo a resposta "ao vivo" e vai
// avisando o texto parcial e a etapa atual. Devolve os dados finais (os mesmos
// de antes: resposta, ações, histórico...). Conexão que cai no meio vira
// TypeError, como uma falha de rede (a tela devolve a mensagem para a caixa).

export interface AoVivo { texto: string; etapa: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function pedirAoVivo(url: string, corpo: Record<string, unknown>, aoMudar: (v: AoVivo) => void): Promise<any> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...corpo, aoVivo: true }) })
  // Erros antes de começar (login, permissão) vêm em JSON comum.
  if (!(res.headers.get('content-type') ?? '').includes('ndjson') || !res.body) {
    const j = await res.json().catch(() => ({ error: `O servidor respondeu ${res.status} sem dados.` }))
    if (!res.ok && !j.error) j.error = `Erro ${res.status}.`
    return j
  }
  const leitor = res.body.getReader()
  const dec = new TextDecoder()
  let resto = ''
  const vivo: AoVivo = { texto: '', etapa: '' }
  for (;;) {
    const { done, value } = await leitor.read()
    if (done) break
    resto += dec.decode(value, { stream: true })
    const linhas = resto.split('\n')
    resto = linhas.pop() ?? ''
    let mudou = false
    for (const l of linhas) {
      if (!l.trim()) continue
      let ev: { t: string; v?: string; dados?: unknown }
      try { ev = JSON.parse(l) } catch { continue }
      if (ev.t === 'fim') return ev.dados ?? { error: 'Resposta vazia do servidor.' }
      // O texto antes de uma ferramenta é só preâmbulo ("vou consultar..."): dá lugar à etapa.
      if (ev.t === 'volta') vivo.texto = ''
      else if (ev.t === 'etapa') { vivo.etapa = ev.v ?? ''; vivo.texto = '' }
      else if (ev.t === 'texto') { vivo.texto += ev.v ?? ''; vivo.etapa = '' }
      mudou = true
    }
    if (mudou) aoMudar({ ...vivo })
  }
  throw new TypeError('A conexão caiu antes do fim da resposta.')
}
