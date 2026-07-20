-- Migração inicial: Espaços & Locações
--
-- COMO RODAR:
-- 1. Abra o painel do seu projeto em https://supabase.com/dashboard
-- 2. Vá em "SQL Editor" → "New query"
-- 3. Cole o conteúdo deste arquivo inteiro e clique em "Run"
-- 4. Depois de rodar sem erro, crie o primeiro usuário admin:
--    a. Authentication → Users → Add user (email + senha)
--    b. No SQL Editor, rode:
--       update public.profiles set role = 'admin' where email = 'SEU_EMAIL_AQUI';
--
-- Este script é idempotente o suficiente para reexecução em caso de erro parcial
-- (usa "if not exists"/"on conflict do nothing" nos pontos que importam), mas o
-- ideal é rodar uma vez só, do início ao fim, em um banco novo.

begin;

-- =========================================================================
-- 1. PROFILES (perfil de cada usuário autenticado, espelha auth.users)
-- =========================================================================

create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  nome          text not null,
  email         text not null,
  role          text not null default 'visualizador'
                  check (role in ('admin','financeiro','operacional','visualizador')),
  ativo         boolean not null default true,
  ultimo_acesso timestamptz,
  created_at    timestamptz not null default now()
);

-- Funções auxiliares SECURITY DEFINER — evitam recursão de RLS ao ler o
-- próprio profiles dentro de policies de outras tabelas.
create or replace function public.get_my_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- Cria automaticamente a linha em profiles quando um novo usuário se registra
-- no Supabase Auth (Dashboard → Add User, ou signUp futuro).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nome, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================================
-- 2. ESPACOS (substitui a união hardcoded 'Usine'|'Fabrique'|... )
-- =========================================================================

create table public.espacos (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  nome        text unique not null,
  endereco    text,
  capacidade  int not null default 0,
  descricao   text,
  status      text not null default 'ativo' check (status in ('ativo','inativo')),
  created_at  timestamptz not null default now()
);

-- =========================================================================
-- 3. FILES (metadados de todo upload; bytes ficam no Storage)
-- =========================================================================

create table public.files (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  mime_type     text not null,
  size          bigint not null,
  module        text not null
                  check (module in ('contas','contratos','agenda','pagamentos','espacos','funcionarios','fichas')),
  entity_id     text not null, -- id do registro pai (evento/conta/contrato/...); não é FK real (referência polimórfica entre módulos)
  entity_name   text not null,
  espaco        text,
  categoria     text,
  storage_path  text not null unique,
  uploaded_by   uuid references public.profiles(id) on delete set null,
  uploaded_at   timestamptz not null default now()
);

-- espacos.foto_file_id só pode ser criado agora que files existe (dependência circular)
alter table public.espacos
  add column foto_file_id uuid references public.files(id) on delete set null;

-- =========================================================================
-- 4. CATEGORIAS_RECEITA + RECEITAS (aluguel, bebidas, ingressos, outros...)
-- =========================================================================

create table public.categorias_receita (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  nome        text unique not null,
  ordem       int not null default 0,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now()
);

-- =========================================================================
-- 5. EVENTOS
-- =========================================================================

create table public.eventos (
  id                     uuid primary key default gen_random_uuid(),
  cliente                text not null,
  espaco_id              uuid not null references public.espacos(id),
  data                   date not null,
  hora_inicio            time not null,
  hora_fim               time not null,
  tipo                   text not null,
  tipo_evento            text check (tipo_evento in ('Festivo','Corporativo','Audiovisual')),
  status                 text not null default 'em_negociacao'
                           check (status in ('confirmado','em_negociacao','cancelado')),
  valor                  numeric(12,2) not null,
  observacoes            text,
  numero_pessoas         int,
  capacidade_utilizada   int,
  faturamento_bruto      numeric(12,2),
  faturamento_liquido    numeric(12,2),
  forma_pagamento        text check (forma_pagamento in
                           ('PIX','Transferência','Dinheiro','Cartão de Crédito','Cartão de Débito','Cheque')),
  data_vencimento_saldo  date,
  responsavel            text,
  telefone_contato       text,
  decoracao              text check (decoracao in ('própria','terceirizada','não aplicável')),
  observacoes_tecnicas   text,
  status_vistoria        text check (status_vistoria in
                           ('pendente','aprovada','aprovada com ressalvas','reprovada','não realizada')),
  created_by             uuid references public.profiles(id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger eventos_set_updated_at
  before update on public.eventos
  for each row execute function public.set_updated_at();

-- =========================================================================
-- 6. RECEITAS (generaliza o antigo conceito de "pagamentos" — qualquer
--    categoria de receita, não só aluguel)
-- =========================================================================

create table public.receitas (
  id                uuid primary key default gen_random_uuid(),
  categoria_id      uuid not null references public.categorias_receita(id),
  evento_id         uuid references public.eventos(id) on delete set null,
  espaco_id         uuid references public.espacos(id) on delete set null,
  cliente           text,
  descricao         text not null,
  data              date not null,
  data_recebimento  date,
  valor             numeric(12,2) not null,
  status            text not null default 'pendente' check (status in ('pago','pendente','atrasado')),
  metodo_pagamento  text,
  observacoes       text,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now()
);

-- =========================================================================
-- 7. CONTRATOS
-- =========================================================================

create table public.contratos (
  id               uuid primary key default gen_random_uuid(),
  numero_contrato  text unique not null,
  cliente          text not null,
  cpf_cnpj         text not null,
  espaco_id        uuid references public.espacos(id),
  data_evento      date not null,
  hora_inicio      time not null,
  hora_fim         time not null,
  valor_total      numeric(12,2) not null,
  valor_entrada    numeric(12,2) not null default 0,
  data_assinatura  date not null,
  status           text not null check (status in ('confirmado','em_negociacao','cancelado')),
  observacoes      text,
  responsavel      text,
  tipo             text not null,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now()
);

-- =========================================================================
-- 8. CONTAS_PAGAR
-- =========================================================================

create table public.contas_pagar (
  id               uuid primary key default gen_random_uuid(),
  descricao        text not null,
  espaco_id        uuid references public.espacos(id) on delete set null, -- null = "Todos"
  categoria        text not null check (categoria in ('fixa','variavel')),
  subcategoria     text not null,
  valor            numeric(12,2) not null,
  status           text not null default 'pendente' check (status in ('pendente','pago','atrasado')),
  data_vencimento  date not null,
  data_pagamento   date,
  fornecedor       text,
  observacoes      text,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now()
);

-- =========================================================================
-- 9. FUNCIONARIOS
-- =========================================================================

create table public.funcionarios (
  id             uuid primary key default gen_random_uuid(),
  nome_completo  text not null,
  cargo          text not null,
  espaco_id      uuid references public.espacos(id) on delete set null,
  telefone       text,
  created_at     timestamptz not null default now()
);

-- =========================================================================
-- 10. FICHAS_CLIENTES (recebidas via formulário público /ficha-cliente)
-- =========================================================================

create table public.fichas_clientes (
  id                     uuid primary key default gen_random_uuid(),
  criado_em              timestamptz not null default now(),
  nome_completo          text not null,
  cpf                    text not null,
  rg                     text,
  data_nascimento        date,
  email                  text not null,
  telefone_celular       text not null,
  endereco               jsonb,
  pessoa_juridica        boolean not null default false,
  razao_social           text,
  nome_fantasia          text,
  cnpj                   text,
  endereco_empresa       jsonb,
  nome_evento            text not null,
  espaco_desejado        text not null,
  tipo_evento            text not null,
  data_evento            date not null,
  hora_inicio_montagem   time,
  hora_inicio_evento     time,
  hora_termino_evento    time,
  valor_locacao          text,
  forma_pagamento        text,
  documento_file_id      uuid references public.files(id) on delete set null
);

-- =========================================================================
-- 11. ROW LEVEL SECURITY
-- =========================================================================

alter table public.profiles          enable row level security;
alter table public.espacos           enable row level security;
alter table public.files             enable row level security;
alter table public.categorias_receita enable row level security;
alter table public.eventos           enable row level security;
alter table public.receitas          enable row level security;
alter table public.contratos         enable row level security;
alter table public.contas_pagar      enable row level security;
alter table public.funcionarios      enable row level security;
alter table public.fichas_clientes   enable row level security;

-- profiles: todo autenticado lê; só admin edita/remove; insert só via trigger
create policy "profiles_select" on public.profiles
  for select to authenticated using (true);
create policy "profiles_update_admin" on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "profiles_delete_admin" on public.profiles
  for delete to authenticated using (public.is_admin());

-- espacos: autenticado lê/escreve tudo; anon só lê os ativos (form público)
create policy "espacos_select_authenticated" on public.espacos
  for select to authenticated using (true);
create policy "espacos_select_anon_ativos" on public.espacos
  for select to anon using (status = 'ativo');
create policy "espacos_insert" on public.espacos
  for insert to authenticated with check (true);
create policy "espacos_update" on public.espacos
  for update to authenticated using (true) with check (true);
create policy "espacos_delete" on public.espacos
  for delete to authenticated using (true);

-- files: autenticado lê/escreve tudo; anon só insere sob module='fichas'
create policy "files_select_authenticated" on public.files
  for select to authenticated using (true);
create policy "files_insert_authenticated" on public.files
  for insert to authenticated with check (true);
create policy "files_insert_anon_fichas" on public.files
  for insert to anon with check (module = 'fichas');
create policy "files_update_authenticated" on public.files
  for update to authenticated using (true);
create policy "files_delete_authenticated" on public.files
  for delete to authenticated using (true);

-- categorias_receita: autenticado lê; só admin gerencia (cria novas categorias)
create policy "categorias_receita_select" on public.categorias_receita
  for select to authenticated using (true);
create policy "categorias_receita_manage_admin" on public.categorias_receita
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- eventos: qualquer autenticado lê/escreve (agenda é operacional por natureza)
create policy "eventos_select" on public.eventos
  for select to authenticated using (true);
create policy "eventos_insert" on public.eventos
  for insert to authenticated with check (true);
create policy "eventos_update" on public.eventos
  for update to authenticated using (true) with check (true);
create policy "eventos_delete" on public.eventos
  for delete to authenticated using (true);

-- receitas: todo autenticado lê (dashboard precisa); só admin/financeiro escreve
create policy "receitas_select" on public.receitas
  for select to authenticated using (true);
create policy "receitas_insert_financeiro" on public.receitas
  for insert to authenticated with check (public.get_my_role() in ('admin','financeiro'));
create policy "receitas_update_financeiro" on public.receitas
  for update to authenticated using (public.get_my_role() in ('admin','financeiro'))
  with check (public.get_my_role() in ('admin','financeiro'));
create policy "receitas_delete_financeiro" on public.receitas
  for delete to authenticated using (public.get_my_role() in ('admin','financeiro'));

-- contratos: qualquer autenticado lê/escreve
create policy "contratos_select" on public.contratos
  for select to authenticated using (true);
create policy "contratos_insert" on public.contratos
  for insert to authenticated with check (true);
create policy "contratos_update" on public.contratos
  for update to authenticated using (true) with check (true);
create policy "contratos_delete" on public.contratos
  for delete to authenticated using (true);

-- contas_pagar: todo autenticado lê; só admin/financeiro escreve (financeiro sensível)
create policy "contas_pagar_select" on public.contas_pagar
  for select to authenticated using (true);
create policy "contas_pagar_insert_financeiro" on public.contas_pagar
  for insert to authenticated with check (public.get_my_role() in ('admin','financeiro'));
create policy "contas_pagar_update_financeiro" on public.contas_pagar
  for update to authenticated using (public.get_my_role() in ('admin','financeiro'))
  with check (public.get_my_role() in ('admin','financeiro'));
create policy "contas_pagar_delete_financeiro" on public.contas_pagar
  for delete to authenticated using (public.get_my_role() in ('admin','financeiro'));

-- funcionarios: qualquer autenticado lê/escreve
create policy "funcionarios_select" on public.funcionarios
  for select to authenticated using (true);
create policy "funcionarios_insert" on public.funcionarios
  for insert to authenticated with check (true);
create policy "funcionarios_update" on public.funcionarios
  for update to authenticated using (true) with check (true);
create policy "funcionarios_delete" on public.funcionarios
  for delete to authenticated using (true);

-- fichas_clientes: ANON só insere (form público); só autenticado lê/edita/remove
create policy "fichas_insert_anon" on public.fichas_clientes
  for insert to anon with check (true);
create policy "fichas_insert_authenticated" on public.fichas_clientes
  for insert to authenticated with check (true);
create policy "fichas_select_authenticated" on public.fichas_clientes
  for select to authenticated using (true);
create policy "fichas_update_authenticated" on public.fichas_clientes
  for update to authenticated using (true);
create policy "fichas_delete_authenticated" on public.fichas_clientes
  for delete to authenticated using (true);

-- =========================================================================
-- 12. STORAGE (bucket privado 'arquivos' + policies)
-- =========================================================================

insert into storage.buckets (id, name, public)
values ('arquivos', 'arquivos', false)
on conflict (id) do nothing;

create policy "storage_insert_authenticated" on storage.objects
  for insert to authenticated with check (bucket_id = 'arquivos');
create policy "storage_insert_anon_fichas" on storage.objects
  for insert to anon with check (
    bucket_id = 'arquivos' and (storage.foldername(name))[1] = 'fichas'
  );
create policy "storage_select_authenticated" on storage.objects
  for select to authenticated using (bucket_id = 'arquivos');
create policy "storage_update_authenticated" on storage.objects
  for update to authenticated using (bucket_id = 'arquivos');
create policy "storage_delete_authenticated" on storage.objects
  for delete to authenticated using (bucket_id = 'arquivos');

-- =========================================================================
-- 13. SEEDS
-- =========================================================================

insert into public.espacos (slug, nome, capacidade, status) values
  ('usine',            'Usine',            400, 'ativo'),
  ('fabrique',         'Fabrique',         250, 'ativo'),
  ('house-pacaembu',   'House Pacaembu',   150, 'ativo'),
  ('complexo-jussara', 'Complexo Jussara', 600, 'ativo'),
  ('espaco-solon',     'Espaço Solon',      80, 'ativo')
on conflict (slug) do nothing;

insert into public.categorias_receita (slug, nome, ordem) values
  ('aluguel',   'Aluguel',   1),
  ('bebidas',   'Bebidas',   2),
  ('ingressos', 'Ingressos', 3),
  ('outros',    'Outros',    4)
on conflict (slug) do nothing;

commit;
