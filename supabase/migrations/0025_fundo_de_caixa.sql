-- Fundo de Caixa é uma movimentação de saldo (transferência entre caixa
-- disponível e reserva), não é despesa nem receita. Modelado com o mesmo
-- padrão dual já usado no sistema: saída via contas_pagar (nova categoria
-- "fundo_caixa", junto de operacional/obra/financeiro/retirada_socio) e
-- retorno via receitas (novo tipo_entrada "retorno_fundo_caixa", junto de
-- evento/aporte_societario/outras_entradas).

alter table public.contas_pagar drop constraint if exists contas_pagar_categoria_check;
alter table public.contas_pagar add constraint contas_pagar_categoria_check
  check (categoria in ('operacional', 'obra', 'financeiro', 'retirada_socio', 'fundo_caixa'));

-- receitas.tipo_entrada foi criada inline (sem nome explícito) na migration
-- 0024 — busca dinamicamente o nome gerado pelo Postgres em vez de supor.
do $$
declare
  v_constraint text;
begin
  select con.conname into v_constraint
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public' and rel.relname = 'receitas' and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%tipo_entrada%';

  if v_constraint is not null then
    execute format('alter table public.receitas drop constraint %I', v_constraint);
  end if;
end $$;

alter table public.receitas add constraint receitas_tipo_entrada_check
  check (tipo_entrada in ('evento', 'aporte_societario', 'outras_entradas', 'retorno_fundo_caixa'));
