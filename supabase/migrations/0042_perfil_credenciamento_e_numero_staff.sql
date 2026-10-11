-- Perfil "credenciamento": um login que só faz o cadastro de terceirizados e
-- não enxerga mais nada do sistema. Quem monta a escala do evento continua
-- sendo o produtor (admin/operacional), escolhendo entre as fichas pelo
-- número de cada staff — por isso a ficha ganha um número sequencial.
--
-- O isolamento precisa valer no banco, não só no menu. Quase toda leitura
-- aqui é liberada para "quem não é sócio" (pode_ver_espaco), então um perfil
-- novo nasceria enxergando eventos, receitas e contas pela API mesmo sem ter
-- a página. Em vez de reescrever cada policy existente, entra uma policy
-- RESTRICTIVE por tabela: ela se soma (AND) às permissivas e barra o perfil
-- em tudo que não for do cadastro.
--
-- ATENÇÃO: tabela nova criada depois desta migration precisa da mesma policy
-- restritiva, senão o perfil credenciamento volta a enxergá-la.

begin;

-- 1) Novo perfil --------------------------------------------------------------

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin', 'financeiro', 'operacional', 'visualizador', 'socio', 'credenciamento'));

-- 2) Barra o perfil em tudo que não é cadastro --------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'atividades', 'categorias_receita', 'contas_pagar', 'contratos', 'credenciamento_anotacoes',
    'espacos', 'evento_escala', 'eventos', 'extratos_bancarios', 'fechamentos_mensais',
    'fichas_clientes', 'funcionarios', 'fundos', 'movimentacoes_bancarias', 'movimentacoes_fundo',
    'padroes_classificacao', 'receitas', 'repasses_socios', 'usuario_espacos'
  ] loop
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated
         using (public.get_my_role() <> ''credenciamento'')
         with check (public.get_my_role() <> ''credenciamento'')',
      t || '_sem_credenciamento', t
    );
  end loop;
end $$;

-- profiles: só a própria linha (o login precisa ler o próprio perfil).
create policy "profiles_sem_credenciamento" on public.profiles
  as restrictive for all to authenticated
  using (public.get_my_role() <> 'credenciamento' or id = auth.uid())
  with check (public.get_my_role() <> 'credenciamento');

-- files: o perfil só mexe nos arquivos do credenciamento. E, no sentido
-- contrário, documento pessoal de terceirizado deixa de aparecer para
-- financeiro, visualizador e sócio — até aqui qualquer "não sócio" lia.
create policy "files_credenciamento_isolado" on public.files
  as restrictive for all to authenticated
  using (
    case when module = 'credenciamento'
      then public.get_my_role() in ('admin', 'operacional', 'credenciamento')
      else public.get_my_role() <> 'credenciamento'
    end
  )
  with check (
    case when module = 'credenciamento'
      then public.get_my_role() in ('admin', 'operacional', 'credenciamento')
      else public.get_my_role() <> 'credenciamento'
    end
  );

-- Storage: mesma regra, pela pasta — saveFile grava em "<module>/<id>/...".
create policy "storage_credenciamento_isolado" on storage.objects
  as restrictive for all to authenticated
  using (
    bucket_id <> 'arquivos'
    or case when (storage.foldername(name))[1] = 'credenciamento'
      then public.get_my_role() in ('admin', 'operacional', 'credenciamento')
      else public.get_my_role() <> 'credenciamento'
    end
  )
  with check (
    bucket_id <> 'arquivos'
    or case when (storage.foldername(name))[1] = 'credenciamento'
      then public.get_my_role() in ('admin', 'operacional', 'credenciamento')
      else public.get_my_role() <> 'credenciamento'
    end
  );

-- 3) O que o perfil pode no cadastro ------------------------------------------
-- Lê, cria e altera fichas e empresas; não apaga. Documento ele pode apagar,
-- pra corrigir um anexo errado.

drop policy "terceirizados_all" on public.terceirizados;
drop policy "empresas_terceirizadas_all" on public.empresas_terceirizadas;
drop policy "terceirizado_documentos_all" on public.terceirizado_documentos;
drop policy "empresa_documentos_all" on public.empresa_documentos;

do $$
declare
  t text;
begin
  foreach t in array array['terceirizados', 'empresas_terceirizadas'] loop
    execute format('create policy %I on public.%I for select to authenticated
      using (public.get_my_role() in (''admin'', ''operacional'', ''credenciamento''))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated
      with check (public.get_my_role() in (''admin'', ''operacional'', ''credenciamento''))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated
      using (public.get_my_role() in (''admin'', ''operacional'', ''credenciamento''))
      with check (public.get_my_role() in (''admin'', ''operacional'', ''credenciamento''))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated
      using (public.get_my_role() in (''admin'', ''operacional''))', t || '_delete', t);
  end loop;

  foreach t in array array['terceirizado_documentos', 'empresa_documentos'] loop
    execute format('create policy %I on public.%I for all to authenticated
      using (public.get_my_role() in (''admin'', ''operacional'', ''credenciamento''))
      with check (public.get_my_role() in (''admin'', ''operacional'', ''credenciamento''))', t || '_all', t);
  end loop;
end $$;

-- Situação (ativo/inativo/vetado), motivo do veto e avaliação são julgamento
-- do produtor, não dado de cadastro: o perfil credenciamento não define nem
-- altera. Ficha nova dele nasce ativa e sem avaliação; numa edição, esses
-- campos ficam como estavam, venha o que vier da tela.
create or replace function public.credenciamento_protege_avaliacao()
returns trigger
language plpgsql
as $$
begin
  if public.get_my_role() = 'credenciamento' then
    if tg_op = 'INSERT' then
      new.status := 'ativo';
      new.motivo_veto := null;
      new.avaliacao := null;
    else
      new.status := old.status;
      new.motivo_veto := old.motivo_veto;
      new.avaliacao := old.avaliacao;
    end if;
  end if;
  return new;
end;
$$;

create trigger terceirizados_protege_avaliacao
  before insert or update on public.terceirizados
  for each row execute function public.credenciamento_protege_avaliacao();

create trigger empresas_terceirizadas_protege_avaliacao
  before insert or update on public.empresas_terceirizadas
  for each row execute function public.credenciamento_protege_avaliacao();

-- 4) Número do staff ----------------------------------------------------------
-- Sequencial, dado pelo banco e nunca reaproveitado: é por ele que o produtor
-- localiza a ficha na hora de montar a escala.

alter table public.terceirizados
  add column numero integer generated always as identity;
alter table public.terceirizados
  add constraint terceirizados_numero_key unique (numero);

commit;
