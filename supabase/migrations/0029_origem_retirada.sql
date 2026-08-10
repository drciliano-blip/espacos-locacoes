-- Rastreia por onde uma conta a pagar foi lançada — hoje só usado pra
-- Retirada Sócio, pra mostrar "Origem: Retirada Manual" (via Financeiro →
-- Sócios) ou "Origem: Conta Paga" (via Contas a Pagar) no histórico do
-- sócio. Lançamentos antigos ficam null (origem não identificada).
alter table public.contas_pagar
  add column if not exists origem_lancamento text;

alter table public.contas_pagar drop constraint if exists contas_pagar_origem_lancamento_check;
alter table public.contas_pagar add constraint contas_pagar_origem_lancamento_check
  check (origem_lancamento is null or origem_lancamento in ('retirada_manual', 'contas_a_pagar'));
