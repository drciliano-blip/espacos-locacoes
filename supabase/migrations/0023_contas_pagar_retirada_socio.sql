-- Adiciona "Retirada Sócio" como 4ª opção de Tipo de Despesa, ao lado de
-- Operacional/Obra/Financeiro. Puramente aditivo — sem necessidade de migrar
-- dados existentes.
alter table public.contas_pagar drop constraint if exists contas_pagar_categoria_check;

alter table public.contas_pagar add constraint contas_pagar_categoria_check
  check (categoria in ('operacional', 'obra', 'financeiro', 'retirada_socio'));
