-- Origem do lançamento: de onde cada receita/conta a pagar veio (Agenda,
-- Manual, Extrato Bancário, Automático), pra filtrar nas listas. Distinto do
-- contas_pagar.origem_lancamento existente (migration 0029), que é um campo
-- estreito só pra Retirada Sócio ("Retirada Manual" x "Conta Paga") — este
-- aqui é geral, vale pra qualquer receita/conta.
--
-- COMO RODAR: Supabase Dashboard → SQL Editor → New query → colar → Run.
-- Aditivo aos anteriores (0001..0030).

alter table public.receitas add column origem text
  check (origem in ('agenda','manual','extrato_bancario','automatico'));

alter table public.contas_pagar add column origem text
  check (origem in ('agenda','manual','extrato_bancario','automatico'));
