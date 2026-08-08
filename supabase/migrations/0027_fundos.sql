-- Fundos/Reservas genéricos — diferente do Fundo de Caixa (contas_pagar
-- categoria 'fundo_caixa' / receitas tipo_entrada 'retorno_fundo_caixa', que
-- continua exatamente como está). Aqui o usuário cria quantos fundos nomeados
-- quiser (Reserva Impostos, Reserva Obra, etc.) sem precisar de código novo a
-- cada fundo. Transferir dinheiro pra um fundo não é despesa nem receita — é
-- só uma separação de saldo que continua pertencendo à empresa.

create table public.fundos (
  id          uuid primary key default gen_random_uuid(),
  espaco_id   uuid references public.espacos(id) on delete cascade, -- null = fundo da empresa toda
  nome        text not null,
  descricao   text,
  meta        numeric(12,2),
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table public.movimentacoes_fundo (
  id           uuid primary key default gen_random_uuid(),
  fundo_id     uuid not null references public.fundos(id) on delete cascade,
  tipo         text not null check (tipo in ('entrada', 'saida')),
  valor        numeric(12,2) not null,
  data         date not null,
  descricao    text,
  responsavel  text,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

alter table public.fundos enable row level security;
alter table public.movimentacoes_fundo enable row level security;

create policy "fundos_select" on public.fundos
  for select to authenticated using (espaco_id is null or public.pode_ver_espaco(espaco_id));
create policy "fundos_insert_financeiro" on public.fundos
  for insert to authenticated with check (public.get_my_role() in ('admin', 'financeiro'));
create policy "fundos_update_financeiro" on public.fundos
  for update to authenticated using (public.get_my_role() in ('admin', 'financeiro'))
  with check (public.get_my_role() in ('admin', 'financeiro'));
create policy "fundos_delete_financeiro" on public.fundos
  for delete to authenticated using (public.get_my_role() in ('admin', 'financeiro'));

create policy "movimentacoes_fundo_select" on public.movimentacoes_fundo
  for select to authenticated using (
    exists (
      select 1 from public.fundos f
      where f.id = movimentacoes_fundo.fundo_id
        and (f.espaco_id is null or public.pode_ver_espaco(f.espaco_id))
    )
  );
create policy "movimentacoes_fundo_insert_financeiro" on public.movimentacoes_fundo
  for insert to authenticated with check (public.get_my_role() in ('admin', 'financeiro'));
create policy "movimentacoes_fundo_update_financeiro" on public.movimentacoes_fundo
  for update to authenticated using (public.get_my_role() in ('admin', 'financeiro'))
  with check (public.get_my_role() in ('admin', 'financeiro'));
create policy "movimentacoes_fundo_delete_financeiro" on public.movimentacoes_fundo
  for delete to authenticated using (public.get_my_role() in ('admin', 'financeiro'));
