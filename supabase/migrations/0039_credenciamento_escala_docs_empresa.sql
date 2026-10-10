-- Credenciamento, segunda parte:
--
-- 1) Documentos da empresa terceirizada (ex: autorização de funcionamento da
--    empresa de segurança), no mesmo formato dos documentos da pessoa —
--    arquivo, número e validade.
--
-- 2) Escala por evento: quem trabalhou em qual evento. É o que permite
--    localizar depois, pela data ou pelo cliente, a equipe de um evento, e
--    conferir se cada um estava com a documentação em dia naquela data. A
--    função fica gravada na escala porque a ficha da pessoa pode mudar depois.
--
-- Mesma restrição de acesso de 0038: admin e operacional.

begin;

create table public.empresa_documentos (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas_terceirizadas(id) on delete cascade,
  tipo        text not null,
  numero      text,
  validade    date,
  file_id     uuid references public.files(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table public.evento_escala (
  id               uuid primary key default gen_random_uuid(),
  evento_id        uuid not null references public.eventos(id) on delete cascade,
  terceirizado_id  uuid not null references public.terceirizados(id) on delete cascade,
  funcao           text not null,
  created_at       timestamptz not null default now(),
  unique (evento_id, terceirizado_id)
);

create index empresa_documentos_empresa_idx on public.empresa_documentos (empresa_id);
create index evento_escala_terceirizado_idx on public.evento_escala (terceirizado_id);

alter table public.empresa_documentos enable row level security;
alter table public.evento_escala      enable row level security;

create policy "empresa_documentos_all" on public.empresa_documentos
  for all to authenticated
  using (public.get_my_role() in ('admin', 'operacional'))
  with check (public.get_my_role() in ('admin', 'operacional'));

create policy "evento_escala_all" on public.evento_escala
  for all to authenticated
  using (public.get_my_role() in ('admin', 'operacional'))
  with check (public.get_my_role() in ('admin', 'operacional'));

commit;
