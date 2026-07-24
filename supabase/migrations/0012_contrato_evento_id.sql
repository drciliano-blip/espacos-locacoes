-- Vincula o contrato ao evento que o originou, pra permitir gerar o contrato
-- direto a partir dos dados já cadastrados no evento (sem redigitar) e evitar
-- criar mais de um contrato pro mesmo evento sem querer.

alter table public.contratos
  add column if not exists evento_id uuid references public.eventos(id) on delete set null;
