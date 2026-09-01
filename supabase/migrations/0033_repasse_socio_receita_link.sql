-- Vincula um repasse de sócio à receita/parcela que o gerou automaticamente
-- (pagamento de evento via forma de pagamento "Repasse Sócio") — nulo pra
-- repasses registrados manualmente, como sempre foi.
-- Aditivo aos anteriores (0001..0032).

alter table public.repasses_socios
  add column receita_id uuid references public.receitas(id) on delete set null;
