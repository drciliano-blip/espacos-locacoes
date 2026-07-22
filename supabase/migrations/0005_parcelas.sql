-- Item 8+9: suporte a parcelamento flexível (sinal + saldo, ou plano customizado)
-- Cada parcela de uma receita de aluguel vira uma linha própria em `receitas`,
-- identificada por parcela_numero, mantendo status/data_recebimento independentes.

alter table public.receitas
  add column if not exists parcela_numero integer,
  add column if not exists parcela_label text;
