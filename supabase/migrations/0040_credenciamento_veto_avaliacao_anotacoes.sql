-- Credenciamento, terceira parte — o que falta pra avaliar o histórico de
-- quem presta serviço:
--
-- 1) Situação "vetado" (com o motivo) para pessoa e para empresa: staff que
--    deu problema não pode voltar a ser escalado por engano. Empresa não
--    tinha situação nenhuma até aqui.
--
-- 2) Avaliação (ótimo, bom, regular) de pessoa e de empresa.
--
-- 3) Anotações: um histórico datado e assinado por pessoa ou por empresa, em
--    vez de um campo de observações que cada edição sobrescreve. O autor é
--    preenchido pelo banco (auth.uid()), não pela tela, e o nome fica
--    copiado na linha pra continuar legível se o usuário for removido.

begin;

alter table public.terceirizados drop constraint if exists terceirizados_status_check;
alter table public.terceirizados add constraint terceirizados_status_check
  check (status in ('ativo', 'inativo', 'vetado'));
alter table public.terceirizados
  add column motivo_veto text,
  add column avaliacao   text check (avaliacao in ('otimo', 'bom', 'regular'));

alter table public.empresas_terceirizadas
  add column status      text not null default 'ativo' check (status in ('ativo', 'inativo', 'vetado')),
  add column motivo_veto text,
  add column avaliacao   text check (avaliacao in ('otimo', 'bom', 'regular'));

create or replace function public.meu_nome()
returns text
language sql security definer stable set search_path = public
as $$
  select nome from public.profiles where id = auth.uid()
$$;

create table public.credenciamento_anotacoes (
  id               uuid primary key default gen_random_uuid(),
  terceirizado_id  uuid references public.terceirizados(id) on delete cascade,
  empresa_id       uuid references public.empresas_terceirizadas(id) on delete cascade,
  texto            text not null,
  autor_id         uuid default auth.uid() references public.profiles(id) on delete set null,
  autor_nome       text default public.meu_nome(),
  created_at       timestamptz not null default now(),
  -- cada anotação é de uma pessoa ou de uma empresa, nunca das duas
  check ((terceirizado_id is null) <> (empresa_id is null))
);

create index credenciamento_anotacoes_terceirizado_idx on public.credenciamento_anotacoes (terceirizado_id);
create index credenciamento_anotacoes_empresa_idx on public.credenciamento_anotacoes (empresa_id);

alter table public.credenciamento_anotacoes enable row level security;

create policy "credenciamento_anotacoes_all" on public.credenciamento_anotacoes
  for all to authenticated
  using (public.get_my_role() in ('admin', 'operacional'))
  with check (public.get_my_role() in ('admin', 'operacional'));

commit;
