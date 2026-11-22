// "Pedir ao assistente" de qualquer tela: abre o chat de Consultas (o botão
// flutuante, ou a aba na página do Assistente) e manda a frase. Usado pelas
// recomendações do resumo do assistente.

export const EVENTO_PEDIR = 'assistente:pedir'

export function pedirAoAssistente(texto: string) {
  window.dispatchEvent(new CustomEvent<string>(EVENTO_PEDIR, { detail: texto }))
}
