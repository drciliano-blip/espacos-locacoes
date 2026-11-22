-- Assistente de IA, etapa 4: rotinas automáticas (resumo da manhã, conferência
-- semanal, pré-fechamento do mês). O servidor gera um resumo por rotina e por
-- público (perfis) e grava aqui; cada pessoa vê só os do seu perfil.
-- Tabela nova: não altera nenhuma tabela existente. Só o servidor grava
-- (chave de serviço); ninguém edita pelo app.

create table if not exists public.assistente_rotinas (
  id         uuid primary key default gen_random_uuid(),
  tipo       text not null,            -- manha | semanal | fechamento
  publico    text not null,            -- gestao (admin/financeiro) | operacao (operacional)
  data       date not null,            -- dia a que o resumo se refere
  titulo     text not null,
  texto      text not null,            -- o resumo escrito pela IA
  dados      jsonb not null default '{}'::jsonb, -- os números que a IA recebeu
  perfis     text[] not null,          -- quem pode ver
  created_at timestamptz not null default now(),
  unique (tipo, publico, data)
);

create index if not exists assistente_rotinas_data_idx on public.assistente_rotinas (data desc);

alter table public.assistente_rotinas enable row level security;

drop policy if exists "assistente_rotinas_select" on public.assistente_rotinas;
create policy "assistente_rotinas_select" on public.assistente_rotinas
  for select to authenticated using (public.get_my_role() = any (perfis));
