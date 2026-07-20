-- Histórico real de atividades (substitui a lista inventada da aba "Atividades" de cada espaço)
--
-- COMO RODAR: Supabase Dashboard → SQL Editor → New query → colar → Run.
-- Aditivo aos anteriores (0001, 0002, 0003).

create table public.atividades (
  id           uuid primary key default gen_random_uuid(),
  tipo         text not null check (tipo in ('evento','contrato','financeiro','funcionario','espaco')),
  acao         text not null,
  detalhes     text,
  espaco_id    uuid references public.espacos(id) on delete set null,
  usuario_id   uuid references public.profiles(id) on delete set null,
  usuario_nome text,
  created_at   timestamptz not null default now()
);

alter table public.atividades enable row level security;

-- Log de auditoria: todo autenticado lê e insere; sem update/delete pela UI
create policy "atividades_select" on public.atividades
  for select to authenticated using (true);
create policy "atividades_insert" on public.atividades
  for insert to authenticated with check (true);
