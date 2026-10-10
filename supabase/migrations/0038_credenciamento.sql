-- Credenciamento de terceirizados: ficha cadastral de quem trabalha nos
-- eventos (segurança, barman, limpeza...) e as autorizações de cada função,
-- com validade — um certificado vencido precisa aparecer como vencido, não só
-- como "arquivo anexado".
--
-- A pessoa pode vir por uma empresa (comum em segurança) ou ser contratada
-- direto (comum em bar e limpeza), então a empresa é opcional. Não há vínculo
-- com espaço: o mesmo profissional trabalha em vários.
--
-- Leitura e escrita ficam restritas a admin e operacional, os mesmos perfis
-- que enxergam a página — a ficha guarda CPF, RG e documentos pessoais.

begin;

create table public.empresas_terceirizadas (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  cnpj          text,
  contato_nome  text,
  telefone      text,
  email         text,
  observacoes   text,
  created_at    timestamptz not null default now()
);

create table public.terceirizados (
  id                uuid primary key default gen_random_uuid(),
  nome_completo     text not null,
  cpf               text,
  rg                text,
  data_nascimento   date,
  telefone          text,
  email             text,
  funcao            text not null,
  tipo_contratacao  text not null default 'direto' check (tipo_contratacao in ('direto', 'empresa')),
  empresa_id        uuid references public.empresas_terceirizadas(id) on delete set null,
  status            text not null default 'ativo' check (status in ('ativo', 'inativo')),
  observacoes       text,
  created_at        timestamptz not null default now()
);

create table public.terceirizado_documentos (
  id               uuid primary key default gen_random_uuid(),
  terceirizado_id  uuid not null references public.terceirizados(id) on delete cascade,
  tipo             text not null,
  numero           text,
  validade         date,
  file_id          uuid references public.files(id) on delete set null,
  created_at       timestamptz not null default now()
);

create index terceirizados_empresa_idx on public.terceirizados (empresa_id);
create index terceirizado_documentos_terceirizado_idx on public.terceirizado_documentos (terceirizado_id);

alter table public.empresas_terceirizadas  enable row level security;
alter table public.terceirizados           enable row level security;
alter table public.terceirizado_documentos enable row level security;

create policy "empresas_terceirizadas_all" on public.empresas_terceirizadas
  for all to authenticated
  using (public.get_my_role() in ('admin', 'operacional'))
  with check (public.get_my_role() in ('admin', 'operacional'));

create policy "terceirizados_all" on public.terceirizados
  for all to authenticated
  using (public.get_my_role() in ('admin', 'operacional'))
  with check (public.get_my_role() in ('admin', 'operacional'));

create policy "terceirizado_documentos_all" on public.terceirizado_documentos
  for all to authenticated
  using (public.get_my_role() in ('admin', 'operacional'))
  with check (public.get_my_role() in ('admin', 'operacional'));

alter table public.files drop constraint if exists files_module_check;
alter table public.files add constraint files_module_check
  check (module in ('contas','contratos','agenda','pagamentos','espacos','funcionarios','fichas','receitas','extratos','credenciamento'));

commit;
