import type { BaixaReceitaInput, Receita } from '@/contexts/ReceitasContext'
import type { NovoRepasseInput, RepasseSocio } from '@/contexts/RepassesContext'

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

  const pagoViaRepasse = patch.status === 'pago' && patch.metodoPagamento === 'Repasse Sócio' && !!patch.socioRepasse
  const jaGerouRepasse = repassesExistentes.some(r => r.receitaId === parcela.id)
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
