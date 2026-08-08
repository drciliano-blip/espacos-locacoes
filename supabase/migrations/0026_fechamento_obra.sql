-- Aporte para Obra é uma entrada financeira exclusiva do Fechamento da Obra —
-- não conta como receita operacional nem como aporte societário genérico
-- (Movimentações Societárias). A despesa de obra já existe (categoria "obra"
-- em contas_pagar, desde a migration 0017); o que muda agora é que ela deixa
-- de ser contada como despesa operacional (ver isDespesaOperacional no código).
alter table public.receitas drop constraint if exists receitas_tipo_entrada_check;
alter table public.receitas add constraint receitas_tipo_entrada_check
  check (tipo_entrada in ('evento', 'aporte_societario', 'outras_entradas', 'retorno_fundo_caixa', 'aporte_obra'));
