-- Contas a Pagar: troca a classificação Fixa/Variável por Operacional/Obra/Financeiro.

-- Não há um mapeamento direto de fixa/variável para o novo esquema — lançamentos
-- existentes caem em "operacional" por padrão; podem ser reclassificados
-- manualmente depois, pela edição de conta (recurso novo).
update public.contas_pagar set categoria = 'operacional' where categoria in ('fixa', 'variavel');

alter table public.contas_pagar drop constraint if exists contas_pagar_categoria_check;
alter table public.contas_pagar add constraint contas_pagar_categoria_check
  check (categoria in ('operacional', 'obra', 'financeiro'));
