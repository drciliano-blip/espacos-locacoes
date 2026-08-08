-- Distingue receitas operacionais (de evento) de aportes societários e outras
-- entradas manuais — aportes/outras entradas aumentam o caixa mas NÃO contam
-- como faturamento/receita operacional em nenhum relatório.
alter table public.receitas add column tipo_entrada text not null default 'evento'
  check (tipo_entrada in ('evento', 'aporte_societario', 'outras_entradas'));

-- Sócio responsável pelo aporte (só se aplica quando tipo_entrada = 'aporte_societario').
alter table public.receitas add column socio_responsavel text;
