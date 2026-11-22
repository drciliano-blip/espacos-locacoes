-- Assistente de IA: o que cada pessoa quer ver no resumo do assistente
-- (seções do resumo da manhã, rotinas da semana e recomendações). Guarda só o
-- que a pessoa escondeu: seção nova aparece para todos até alguém esconder.
-- Tabela nova: não altera nenhuma tabela existente. Cada um vê e muda só a sua.

create table if not exists public.assistente_preferencias (
  usuario_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  ocultas    text[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.assistente_preferencias enable row level security;

drop policy if exists "assistente_preferencias_select" on public.assistente_preferencias;
create policy "assistente_preferencias_select" on public.assistente_preferencias
  for select to authenticated using (usuario_id = auth.uid());
drop policy if exists "assistente_preferencias_insert" on public.assistente_preferencias;
create policy "assistente_preferencias_insert" on public.assistente_preferencias
  for insert to authenticated with check (usuario_id = auth.uid());
drop policy if exists "assistente_preferencias_update" on public.assistente_preferencias;
create policy "assistente_preferencias_update" on public.assistente_preferencias
  for update to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
