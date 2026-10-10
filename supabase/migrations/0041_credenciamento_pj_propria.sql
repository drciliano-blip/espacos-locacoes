-- A contratação tinha dois casos: pessoa física, ou cedido por uma empresa
-- terceirizada. Falta o terceiro, que o cliente também usa: o profissional
-- que é ele mesmo pessoa jurídica (MEI) e emite a própria nota. Cadastrá-lo
-- como "empresa" obrigaria a criar uma empresa de uma pessoa só pra cada um.
--
-- 'mei' guarda o CNPJ e a razão social na própria ficha.

begin;

alter table public.terceirizados drop constraint if exists terceirizados_tipo_contratacao_check;
alter table public.terceirizados add constraint terceirizados_tipo_contratacao_check
  check (tipo_contratacao in ('direto', 'mei', 'empresa'));

alter table public.terceirizados
  add column cnpj         text,
  add column razao_social text;

commit;
