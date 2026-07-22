-- Espelha na tabela eventos o mesmo campo já existente na ficha pública:
-- valor do sinal negociado (usado para semear o plano de pagamento na criação do evento).

alter table public.eventos
  add column if not exists valor_sinal numeric;
