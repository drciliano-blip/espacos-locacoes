-- Mês de competência de um recebimento: o dinheiro entra hoje, mas é
-- contabilizado (Financeiro, fechamento, repasse) no mês escolhido — ex.:
-- pagamento antecipado de um evento de dezembro que deve contar em dezembro.
-- Sempre o 1º dia do mês. Nulo = conta no mês do pagamento, como sempre.
alter table public.receitas
  add column if not exists data_competencia date
    check (data_competencia is null or extract(day from data_competencia) = 1);

comment on column public.receitas.data_competencia is
  'Mês (dia 1) em que o recebimento é contabilizado; nulo = mês do pagamento.';
