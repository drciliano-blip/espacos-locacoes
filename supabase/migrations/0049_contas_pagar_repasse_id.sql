-- Retirada de sócio (Conta Paga) que só materializa um repasse já registrado
-- num fechamento anterior. Ex.: Usine/Gruppo — repasse de 13.532,34 em
-- 30/09 ("valor reservado para pagamento da data 24/10") zerou o pendente de
-- setembro; em 23/10 o mesmo valor entrou como Conta Paga "Retirada gruppo".
-- Com o vínculo, a conta continua registrada (nada é apagado), mas não é
-- descontada de novo do sócio no repasse/fechamento.
alter table public.contas_pagar
  add column if not exists repasse_id uuid references public.repasses_socios(id) on delete set null;

comment on column public.contas_pagar.repasse_id is
  'Repasse (repasses_socios) que esta retirada quita. Quando preenchido, a conta não conta de novo como retirada do sócio.';
