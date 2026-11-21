-- Assistente de IA: um atendimento (chat) por cliente/orçamento.
-- Guarda a conversa (mensagens do cliente, respostas da IA, notas da equipe)
-- e o estado do orçamento (dados do evento, espaço, serviços) para a equipe
-- retomar depois. Tabela nova: não altera nenhuma tabela existente.

create table if not exists public.assistente_atendimentos (
  id              uuid primary key default gen_random_uuid(),
  numero          text not null unique,
  titulo          text not null default 'Novo atendimento',
  status          text not null default 'aberto'
                    check (status in ('aberto', 'enviado', 'fechado', 'perdido')),
  espaco_slug     text,
  data_evento     date,
  total_locacao   numeric(12,2),
  total_servicos  numeric(12,2),
  estado          jsonb not null default '{}'::jsonb,
  mensagens       jsonb not null default '[]'::jsonb,
  created_by      uuid references public.profiles(id) on delete set null,
  created_by_nome text,
  updated_by_nome text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists assistente_atendimentos_updated_idx on public.assistente_atendimentos (updated_at desc);

alter table public.assistente_atendimentos enable row level security;

-- Mesmo acesso da aba: administrador e operacional. Excluir só o administrador.
drop policy if exists "assistente_atendimentos_select" on public.assistente_atendimentos;
create policy "assistente_atendimentos_select" on public.assistente_atendimentos
  for select to authenticated using (public.get_my_role() in ('admin', 'operacional'));
drop policy if exists "assistente_atendimentos_insert" on public.assistente_atendimentos;
create policy "assistente_atendimentos_insert" on public.assistente_atendimentos
  for insert to authenticated with check (public.get_my_role() in ('admin', 'operacional'));
drop policy if exists "assistente_atendimentos_update" on public.assistente_atendimentos;
create policy "assistente_atendimentos_update" on public.assistente_atendimentos
  for update to authenticated
  using (public.get_my_role() in ('admin', 'operacional'))
  with check (public.get_my_role() in ('admin', 'operacional'));
drop policy if exists "assistente_atendimentos_delete" on public.assistente_atendimentos;
create policy "assistente_atendimentos_delete" on public.assistente_atendimentos
  for delete to authenticated using (public.get_my_role() = 'admin');
