-- Suporte ao fluxo "Cancelar Evento" com 3 opções (manter receita / gerar
-- reembolso / excluir definitivamente). Reembolso é uma saída financeira de
-- verdade — reduz o Resultado Operacional, ao contrário de retirada_socio,
-- fundo_caixa e obra — por isso NÃO entra na lista de exclusões de
-- isDespesaOperacional (ver ContasPagarContext.tsx).

alter table public.contas_pagar
  add column if not exists evento_id uuid references public.eventos(id) on delete set null;

alter table public.contas_pagar drop constraint if exists contas_pagar_categoria_check;
alter table public.contas_pagar add constraint contas_pagar_categoria_check
  check (categoria in ('operacional', 'obra', 'financeiro', 'retirada_socio', 'fundo_caixa', 'reembolso_evento'));
