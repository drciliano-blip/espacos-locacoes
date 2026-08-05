-- Permissão por espaço + novo papel "socio" (somente leitura, restrito aos
-- espaços vinculados a ele). A trava é aplicada aqui, via RLS — a interface
-- só reflete isso, nunca é a única barreira.

-- 1) Papel "socio" na constraint de profiles.role -------------------------
-- A constraint original foi criada inline (sem nome explícito), então o
-- Postgres gerou um nome automático — busca dinamicamente em vez de supor.
do $$
declare
  v_constraint text;
begin
  select con.conname into v_constraint
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public' and rel.relname = 'profiles' and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%role%';

  if v_constraint is not null then
    execute format('alter table public.profiles drop constraint %I', v_constraint);
  end if;
end $$;

alter table public.profiles add constraint profiles_role_check
  check (role in ('admin', 'financeiro', 'operacional', 'visualizador', 'socio'));

-- 2) Vínculo usuário ↔ espaços ----------------------------------------------
create table public.usuario_espacos (
  usuario_id uuid not null references public.profiles(id) on delete cascade,
  espaco_id  uuid not null references public.espacos(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (usuario_id, espaco_id)
);

alter table public.usuario_espacos enable row level security;

-- só admin gerencia/consulta os vínculos (tela Usuários); as funções helper
-- abaixo rodam como security definer e enxergam a tabela independente disso.
create policy "usuario_espacos_select_admin" on public.usuario_espacos
  for select to authenticated using (public.is_admin());
create policy "usuario_espacos_insert_admin" on public.usuario_espacos
  for insert to authenticated with check (public.is_admin());
create policy "usuario_espacos_delete_admin" on public.usuario_espacos
  for delete to authenticated using (public.is_admin());

-- 3) Funções helper de RLS ---------------------------------------------------
-- Qualquer papel que não seja "socio" mantém o acesso global de hoje.
-- "socio" só enxerga o que estiver vinculado em usuario_espacos — inclusive
-- bloqueia registros "gerais" (espaco_id nulo, ex. contas "Todos").
create or replace function public.pode_ver_espaco(alvo_espaco_id uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select
    public.get_my_role() <> 'socio'
    or (
      alvo_espaco_id is not null
      and exists (
        select 1 from public.usuario_espacos ue
        where ue.usuario_id = auth.uid() and ue.espaco_id = alvo_espaco_id
      )
    )
$$;

-- variante para tabelas que guardam o nome do espaço em vez do id (ex: files).
create or replace function public.pode_ver_espaco_nome(nome_espaco text)
returns boolean
language sql security definer stable set search_path = public
as $$
  select
    public.get_my_role() <> 'socio'
    or (
      nome_espaco is not null
      and exists (
        select 1 from public.usuario_espacos ue
        join public.espacos e on e.id = ue.espaco_id
        where ue.usuario_id = auth.uid() and e.nome = nome_espaco
      )
    )
$$;

-- 4) Reescreve as policies de SELECT que hoje são "using (true)" -----------
drop policy if exists "espacos_select_authenticated" on public.espacos;
create policy "espacos_select_authenticated" on public.espacos
  for select to authenticated using (public.pode_ver_espaco(id));

drop policy if exists "eventos_select" on public.eventos;
create policy "eventos_select" on public.eventos
  for select to authenticated using (public.pode_ver_espaco(espaco_id));

drop policy if exists "receitas_select" on public.receitas;
create policy "receitas_select" on public.receitas
  for select to authenticated using (public.pode_ver_espaco(espaco_id));

drop policy if exists "contas_pagar_select" on public.contas_pagar;
create policy "contas_pagar_select" on public.contas_pagar
  for select to authenticated using (public.pode_ver_espaco(espaco_id));

drop policy if exists "contratos_select" on public.contratos;
create policy "contratos_select" on public.contratos
  for select to authenticated using (public.pode_ver_espaco(espaco_id));

drop policy if exists "atividades_select" on public.atividades;
create policy "atividades_select" on public.atividades
  for select to authenticated using (public.pode_ver_espaco(espaco_id));

drop policy if exists "repasses_socios_select" on public.repasses_socios;
create policy "repasses_socios_select" on public.repasses_socios
  for select to authenticated using (public.pode_ver_espaco(espaco_id));

drop policy if exists "funcionarios_select" on public.funcionarios;
create policy "funcionarios_select" on public.funcionarios
  for select to authenticated using (public.pode_ver_espaco(espaco_id));

drop policy if exists "files_select_authenticated" on public.files;
create policy "files_select_authenticated" on public.files
  for select to authenticated using (public.pode_ver_espaco_nome(espaco));

-- 5) "socio" é somente leitura: exclui de todo insert/update/delete hoje
--    aberto pra qualquer authenticated (as tabelas já restritas a
--    admin/financeiro — receitas, contas_pagar, repasses_socios — não
--    precisam de ajuste, "socio" já não se encaixa nelas).
drop policy if exists "espacos_insert" on public.espacos;
create policy "espacos_insert" on public.espacos
  for insert to authenticated with check (public.get_my_role() <> 'socio');
drop policy if exists "espacos_update" on public.espacos;
create policy "espacos_update" on public.espacos
  for update to authenticated using (public.get_my_role() <> 'socio') with check (public.get_my_role() <> 'socio');
drop policy if exists "espacos_delete" on public.espacos;
create policy "espacos_delete" on public.espacos
  for delete to authenticated using (public.get_my_role() <> 'socio');

drop policy if exists "eventos_insert" on public.eventos;
create policy "eventos_insert" on public.eventos
  for insert to authenticated with check (public.get_my_role() <> 'socio');
drop policy if exists "eventos_update" on public.eventos;
create policy "eventos_update" on public.eventos
  for update to authenticated using (public.get_my_role() <> 'socio') with check (public.get_my_role() <> 'socio');

drop policy if exists "contratos_insert" on public.contratos;
create policy "contratos_insert" on public.contratos
  for insert to authenticated with check (public.get_my_role() <> 'socio');
drop policy if exists "contratos_update" on public.contratos;
create policy "contratos_update" on public.contratos
  for update to authenticated using (public.get_my_role() <> 'socio') with check (public.get_my_role() <> 'socio');
drop policy if exists "contratos_delete" on public.contratos;
create policy "contratos_delete" on public.contratos
  for delete to authenticated using (public.get_my_role() <> 'socio');

drop policy if exists "files_insert_authenticated" on public.files;
create policy "files_insert_authenticated" on public.files
  for insert to authenticated with check (public.get_my_role() <> 'socio');
drop policy if exists "files_update_authenticated" on public.files;
create policy "files_update_authenticated" on public.files
  for update to authenticated using (public.get_my_role() <> 'socio');
drop policy if exists "files_delete_authenticated" on public.files;
create policy "files_delete_authenticated" on public.files
  for delete to authenticated using (public.get_my_role() <> 'socio');

drop policy if exists "atividades_insert" on public.atividades;
create policy "atividades_insert" on public.atividades
  for insert to authenticated with check (public.get_my_role() <> 'socio');

drop policy if exists "funcionarios_insert" on public.funcionarios;
create policy "funcionarios_insert" on public.funcionarios
  for insert to authenticated with check (public.get_my_role() <> 'socio');
drop policy if exists "funcionarios_update" on public.funcionarios;
create policy "funcionarios_update" on public.funcionarios
  for update to authenticated using (public.get_my_role() <> 'socio') with check (public.get_my_role() <> 'socio');
drop policy if exists "funcionarios_delete" on public.funcionarios;
create policy "funcionarios_delete" on public.funcionarios
  for delete to authenticated using (public.get_my_role() <> 'socio');
