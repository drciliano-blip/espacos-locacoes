-- Base da Classificação em Lote (Importação Histórica): permite marcar uma
-- movimentação bancária como resolvida sem virar uma receita/conta_pagar
-- ("Transferência entre contas" / "Ignorar"), e guarda os padrões de
-- classificação aprendidos (ex: "ENEL" → Energia) pra sugerir da próxima vez.
--
-- COMO RODAR: Supabase Dashboard → SQL Editor → New query → colar → Run.
-- Aditivo aos anteriores (0001..0031).

alter table public.movimentacoes_bancarias add column classificacao_especial text
  check (classificacao_especial in ('transferencia','ignorado'));

create table public.padroes_classificacao (
  id                    uuid primary key default gen_random_uuid(),
  padrao_texto          text not null, -- palavra normalizada (sem acento, minúscula), ex: "enel"
  tipo                  text not null check (tipo in ('entrada','saida')),
  classificacao         text not null check (classificacao in ('lancamento','transferencia','ignorar')),
  espaco_id             uuid references public.espacos(id) on delete set null,
  categoria_receita_id  uuid references public.categorias_receita(id) on delete set null,
  tipo_entrada          text,
  categoria_conta       text,
  subcategoria_conta    text,
  vezes_usado           integer not null default 1,
  created_by            uuid references public.profiles(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (padrao_texto, tipo)
);

alter table public.padroes_classificacao enable row level security;

-- Mesma restrição de movimentacoes_bancarias — dado derivado de extrato
-- bancário, admin/financeiro só.
create policy "padroes_classificacao_select" on public.padroes_classificacao
  for select to authenticated using (public.get_my_role() in ('admin','financeiro'));
create policy "padroes_classificacao_insert" on public.padroes_classificacao
  for insert to authenticated with check (public.get_my_role() in ('admin','financeiro'));
create policy "padroes_classificacao_update" on public.padroes_classificacao
  for update to authenticated using (public.get_my_role() in ('admin','financeiro'))
  with check (public.get_my_role() in ('admin','financeiro'));
create policy "padroes_classificacao_delete" on public.padroes_classificacao
  for delete to authenticated using (public.get_my_role() in ('admin','financeiro'));
