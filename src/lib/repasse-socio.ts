import type { BaixaReceitaInput, Receita } from '@/contexts/ReceitasContext'
import type { NovoRepasseInput, RepasseSocio } from '@/contexts/RepassesContext'

export const METODO_LUCRO_SOCIO = 'Lucro de Sócio'

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
// 'YYYY-MM' → 'outubro/2026'
export function mesReferenciaLabel(ym: string): string {
  const [a, m] = ym.split('-').map(Number)
  return m ? `${MESES[m - 1]}/${a}` : ym
}

// Só cria o repasse automático na transição real pra "pago via Repasse Sócio"
// — nunca de novo se a parcela for reaberta/reeditada depois (checa se já
// existe um repasse com esse receita_id). Corrigir valor/sócio de um repasse
// já criado continua manual — RepassesContext não tem editar/excluir hoje,
// mesma limitação que já existe pra repasses registrados à mão.
export async function aplicarBaixaComRepasseAutomatico(
  parcela: Receita,
  patch: BaixaReceitaInput,
  updateReceita: (id: string, patch: BaixaReceitaInput) => Promise<void>,
  addRepasse: (input: NovoRepasseInput) => Promise<void>,
  repassesExistentes: RepasseSocio[],
): Promise<void> {
  await updateReceita(parcela.id, patch)

  const jaGerouRepasse = repassesExistentes.some(r => r.receitaId === parcela.id)

  // Pago com a parte do lucro do sócio (pode ser de outro espaço): o repasse
  // sai do espaço de ORIGEM do lucro, datado no mês de referência (ou na data
  // do pagamento, se aquele mês já estiver fechado — aí abate o "Saldo
  // anterior" do sócio no fechamento seguinte, sem virar retirada do mês).
  if (patch.status === 'pago' && patch.metodoPagamento === METODO_LUCRO_SOCIO && patch.lucroSocio) {
    if (jaGerouRepasse) return
    const o = patch.lucroSocio
    await addRepasse({
      espaco: o.espaco,
      socioNome: o.socio,
      valor: patch.valor ?? parcela.valor,
      data: o.dataRepasse,
      observacoes: `Parte do lucro de ${mesReferenciaLabel(o.mesReferencia)} (${o.espaco}) usada para pagar ${parcela.cliente ?? parcela.descricao}${patch.parcelaLabel ? ` — ${patch.parcelaLabel}` : ''}${parcela.espaco && parcela.espaco !== o.espaco ? ` no ${parcela.espaco}` : ''}.`,
      receitaId: parcela.id,
    })
    return
  }

  const pagoViaRepasse = patch.status === 'pago' && patch.metodoPagamento === 'Repasse Sócio' && !!patch.socioRepasse
  if (!pagoViaRepasse || jaGerouRepasse || !parcela.espaco) return

  await addRepasse({
    espaco: parcela.espaco,
    socioNome: patch.socioRepasse!,
    valor: patch.valor ?? parcela.valor,
    data: patch.dataRecebimento || patch.data || parcela.data,
    observacoes: `Repasse aplicado automaticamente ao pagamento de ${parcela.cliente ?? parcela.descricao}${patch.parcelaLabel ? ` — ${patch.parcelaLabel}` : ''}.`,
    receitaId: parcela.id,
  })
}
