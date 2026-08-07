-- Registra separadamente QUANDO o usuário deu baixa no sistema (data_baixa,
-- só uso interno/auditoria) de QUANDO o pagamento realmente aconteceu
-- (data_pagamento/hora_pagamento, extraído do comprovante). O "Pago em"
-- exibido pro usuário usa sempre data_pagamento — nunca data_baixa.
alter table public.contas_pagar add column data_baixa timestamptz;
