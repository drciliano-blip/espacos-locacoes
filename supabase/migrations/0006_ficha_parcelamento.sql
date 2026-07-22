-- Permite que o cliente já indique na ficha pública que deseja pagamento parcelado,
-- informando o valor do sinal e o vencimento do saldo desejados.

alter table public.fichas_clientes
  add column if not exists valor_sinal numeric,
  add column if not exists data_vencimento_saldo date;
