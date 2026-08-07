-- Hora do pagamento (complementa data_pagamento, que já existia) — usada tanto
-- pra ordenar "Contas Pagas" pelo momento real do pagamento quanto pra exibição.
-- Extraída automaticamente do comprovante anexado quando possível, editável pelo
-- usuário quando a IA não identificar com segurança.
alter table public.contas_pagar add column hora_pagamento text;
