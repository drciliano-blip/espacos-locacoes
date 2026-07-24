-- Fluxo de caixa por espaço: saldo inicial de caixa + controle de repasses aos sócios.

alter table public.espacos
  add column if not exists saldo_inicial_caixa numeric(12,2) not null default 0;

create table public.repasses_socios (
  id          uuid primary key default gen_random_uuid(),
  espaco_id   uuid not null references public.espacos(id) on delete cascade,
  socio_nome  text not null,
  valor       numeric(12,2) not null,
  data        date not null,
  observacoes text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

alter table public.repasses_socios enable row level security;

-- mesmo critério de contas_pagar: todo autenticado lê; só admin/financeiro escreve.
create policy "repasses_socios_select" on public.repasses_socios
  for select to authenticated using (true);
create policy "repasses_socios_insert_financeiro" on public.repasses_socios
  for insert to authenticated with check (public.get_my_role() in ('admin','financeiro'));
create policy "repasses_socios_delete_financeiro" on public.repasses_socios
  for delete to authenticated using (public.get_my_role() in ('admin','financeiro'));
