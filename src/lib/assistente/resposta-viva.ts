// Resposta "viva" para as rotas do assistente: o iPhone (Safari/app da tela de
// início) desiste da requisição ("Load failed") se ficar ~60 s sem receber
// nenhum byte, e a IA às vezes leva isso ao fazer várias consultas. Aqui a
// resposta começa na hora e manda um espaço a cada 5 s enquanto trabalha; no
// fim manda o JSON. Espaços antes do JSON não atrapalham o res.json() da tela.
// Por isso o status é sempre 200: erros vão no campo "error" do JSON.

export function respostaViva(trabalho: () => Promise<unknown>): Response {
  const enc = new TextEncoder()
  const corpo = new ReadableStream<Uint8Array>({
    async start(ctrl) {
      const pulso = setInterval(() => { try { ctrl.enqueue(enc.encode(' ')) } catch { /* fechado */ } }, 5000)
      ctrl.enqueue(enc.encode(' '))
      let saida: unknown
      try {
        saida = await trabalho()
      } catch (e) {
        console.error('[assistente]', e)
        saida = { error: e instanceof Error ? e.message : 'Erro no assistente.' }
      } finally {
        clearInterval(pulso)
      }
      ctrl.enqueue(enc.encode(JSON.stringify(saida)))
      ctrl.close()
    },
  })
  return new Response(corpo, { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' } })
}

// Conversa grande demais pesa e atrasa cada resposta: acima disto, recomeça
// a partir de um resumo (a última resposta), em vez de mandar tudo de novo.
export const LIMITE_HISTORICO = 120_000
