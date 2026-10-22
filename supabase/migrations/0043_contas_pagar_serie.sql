-- Contas fixas (programadas): lançar uma conta que se repete todo mês gera
-- as contas dos meses seguintes já como pendentes, ligadas pela mesma série.
-- Assim dá para alterar ou excluir "esta e as próximas" de uma vez, e o
-- Calendário Financeiro (Contas a Pagar) mostra o que vem pela frente.
--
-- Só colunas novas e opcionais — lançamentos existentes ficam com null
-- (contas avulsas), nada muda neles. Rodar no SQL Editor do Supabase ou via
-- scripts/run-sql.mjs.

alter table public.contas_pagar
  add column if not exists serie_id     uuid,
  add column if not exists serie_numero integer,
  add column if not exists serie_total  integer;

create index if not exists contas_pagar_serie_id_idx on public.contas_pagar (serie_id);
