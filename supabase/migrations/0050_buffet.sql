-- Buffet EL — módulo separado dos espaços.
--
-- O buffet é outra empresa (quadro societário próprio, CNPJ a definir) e a
-- receita dele nunca pode cair nos números dos espaços. Por isso nada aqui
-- usa receitas/contas_pagar/espacos: tabelas próprias, prefixo buffet_.
-- Nenhuma tela dos espaços lê estas tabelas.
--
-- Etapa 1: cadastros (opções e tabelas de preço) e orçamentos.

create table if not exists public.buffet_opcoes (
  id uuid primary key default gen_random_uuid(),
  grupo text not null check (grupo in ('tipo_evento', 'comida', 'bebida', 'extra')),
  nome text not null,
  descricao text,
  ativo boolean not null default true,
  ordem integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.buffet_tabelas_preco (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  inclusos text,
  observacao text,
  ativo boolean not null default true,
  ordem integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.buffet_tabela_faixas (
  id uuid primary key default gen_random_uuid(),
  tabela_id uuid not null references public.buffet_tabelas_preco(id) on delete cascade,
  ate_convidados integer not null check (ate_convidados > 0),
  opcao text not null,
  valor numeric(12, 2) not null check (valor >= 0),
  created_at timestamptz not null default now(),
  unique (tabela_id, ate_convidados, opcao)
);

create table if not exists public.buffet_orcamentos (
  id uuid primary key default gen_random_uuid(),
  numero integer generated always as identity unique,
  status text not null default 'rascunho' check (status in ('rascunho', 'enviado', 'aprovado', 'perdido')),
  cliente_nome text not null,
  cliente_telefone text,
  cliente_email text,
  cliente_documento text,
  tipo_evento text,
  data_evento date,
  horario_inicio text,
  duracao_horas numeric(4, 1),
  local text,
  convidados integer,
  comidas text[] not null default '{}',
  bebidas text[] not null default '{}',
  extras text[] not null default '{}',
  tabela_id uuid references public.buffet_tabelas_preco(id) on delete set null,
  opcao_preco text,
  valor_tabela numeric(12, 2),
  valor_final numeric(12, 2),
  condicoes_pagamento text,
  validade date,
  restricoes text,
  observacoes text,
  motivo_perda text,
  enviado_em timestamptz,
  created_by uuid default auth.uid(),
  created_by_nome text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Acesso ─────────────────────────────────────────────────────────────────
-- Admin, financeiro e operacional (os operadores montam e enviam orçamentos).
-- Excluir: só admin — orçamento perdido fica registrado como "perdido".
do $$
declare t text;
begin
  foreach t in array array['buffet_opcoes', 'buffet_tabelas_preco', 'buffet_tabela_faixas', 'buffet_orcamentos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%1$s_select" on public.%1$I', t);
    execute format('create policy "%1$s_select" on public.%1$I for select to authenticated using (public.get_my_role() in (''admin'',''financeiro'',''operacional''))', t);
    execute format('drop policy if exists "%1$s_insert" on public.%1$I', t);
    execute format('create policy "%1$s_insert" on public.%1$I for insert to authenticated with check (public.get_my_role() in (''admin'',''financeiro'',''operacional''))', t);
    execute format('drop policy if exists "%1$s_update" on public.%1$I', t);
    execute format('create policy "%1$s_update" on public.%1$I for update to authenticated using (public.get_my_role() in (''admin'',''financeiro'',''operacional'')) with check (public.get_my_role() in (''admin'',''financeiro'',''operacional''))', t);
    execute format('drop policy if exists "%1$s_delete" on public.%1$I', t);
    execute format('create policy "%1$s_delete" on public.%1$I for delete to authenticated using (public.get_my_role() = ''admin'')', t);
    -- Perfil credenciamento nunca enxerga nada fora do cadastro dele (ver 0042).
    execute format('drop policy if exists "%1$s_sem_credenciamento" on public.%1$I', t);
    execute format('create policy "%1$s_sem_credenciamento" on public.%1$I as restrictive for all to authenticated using (public.get_my_role() <> ''credenciamento'') with check (public.get_my_role() <> ''credenciamento'')', t);
  end loop;
end $$;

-- ── Dados iniciais (dos modelos de proposta usados hoje) ───────────────────
insert into public.buffet_opcoes (grupo, nome, descricao, ordem)
select * from (values
  ('tipo_evento', 'Aniversário', null, 1),
  ('tipo_evento', 'Festa de fim de ano de empresa', null, 2),
  ('comida', 'Salgadinhos e petiscos variados', null, 1),
  ('comida', 'Espetinhos de churrasco', 'Seleção de carne, frango e linguiça', 2),
  ('bebida', 'Cerveja Amstel', null, 1),
  ('bebida', 'Cerveja Heineken', null, 2),
  ('bebida', 'Refrigerantes', null, 3),
  ('bebida', 'Água', null, 4),
  ('bebida', 'Opções não alcoólicas', null, 5),
  ('extra', 'Estação de caipirinha', 'Caipirinhas preparadas na hora durante a comemoração', 1),
  ('extra', 'Equipe completa de bar e atendimento', null, 2),
  ('extra', 'Estrutura e utensílios', null, 3)
) v(grupo, nome, descricao, ordem)
where not exists (select 1 from public.buffet_opcoes);

do $$
declare aniv uuid; fimano uuid;
begin
  if exists (select 1 from public.buffet_tabelas_preco) then return; end if;

  insert into public.buffet_tabelas_preco (nome, descricao, inclusos, observacao, ordem)
  values ('Aniversário', 'Pacotes para comemorações de 50 a 600 convidados',
    E'Alimentação: salgadinhos OU espetinhos de churrasco\nCerveja Amstel ou Heineken\nRefrigerantes e água\nEstação de caipirinha preparada na hora\nEquipe completa de bar e atendimento\nEstrutura e utensílios',
    'Valores referentes aos serviços de alimentação, bebidas, estação de caipirinha e equipe de serviço. Locação do espaço não inclusa.', 1)
  returning id into aniv;

  insert into public.buffet_tabelas_preco (nome, descricao, inclusos, observacao, ordem)
  values ('Fim de ano de empresa', 'Pacotes de 100 a 1.500 convidados',
    E'Alimentação: salgados e petiscos variados OU espetinhos de churrasco\nCerveja Amstel ou Heineken\nRefrigerantes, água e opções não alcoólicas\nEquipe completa de bar e atendimento\nEstrutura e utensílios',
    'Valores referentes exclusivamente aos serviços de alimentação, bebidas e equipe de serviço. Locação do espaço não inclusa.', 2)
  returning id into fimano;

  insert into public.buffet_tabela_faixas (tabela_id, ate_convidados, opcao, valor)
  select aniv, f.ate, f.opcao, f.valor from (values
    (50, 'Amstel', 6500), (50, 'Heineken', 7500),
    (100, 'Amstel', 9500), (100, 'Heineken', 11500),
    (200, 'Amstel', 15500), (200, 'Heineken', 18000),
    (300, 'Amstel', 21500), (300, 'Heineken', 24500),
    (400, 'Amstel', 27500), (400, 'Heineken', 31000),
    (500, 'Amstel', 33500), (500, 'Heineken', 37500),
    (600, 'Amstel', 39500), (600, 'Heineken', 44000)
  ) f(ate, opcao, valor);

  -- 700, 800 e 1.500 corrigidos pela sequência regular (aprovado em 05/11/2026;
  -- o modelo impresso tinha 700 = 49.500/50.500, 800 = 45.500/61.500 e
  -- 1.500 = 85.500/94.500, igual a 1.400).
  insert into public.buffet_tabela_faixas (tabela_id, ate_convidados, opcao, valor)
  select fimano, f.ate, f.opcao, f.valor from (values
    (100, 'Amstel', 9500), (100, 'Heineken', 11500),
    (200, 'Amstel', 15500), (200, 'Heineken', 18000),
    (300, 'Amstel', 21500), (300, 'Heineken', 24500),
    (400, 'Amstel', 27500), (400, 'Heineken', 31000),
    (500, 'Amstel', 33500), (500, 'Heineken', 37500),
    (600, 'Amstel', 39500), (600, 'Heineken', 44000),
    (700, 'Amstel', 50500), (700, 'Heineken', 56000),
    (800, 'Amstel', 55500), (800, 'Heineken', 61500),
    (900, 'Amstel', 60500), (900, 'Heineken', 67000),
    (1000, 'Amstel', 65500), (1000, 'Heineken', 72500),
    (1100, 'Amstel', 70500), (1100, 'Heineken', 78000),
    (1200, 'Amstel', 75500), (1200, 'Heineken', 83500),
    (1300, 'Amstel', 80500), (1300, 'Heineken', 89000),
    (1400, 'Amstel', 85500), (1400, 'Heineken', 94500),
    (1500, 'Amstel', 90500), (1500, 'Heineken', 100000)
  ) f(ate, opcao, valor);
end $$;
