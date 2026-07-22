-- "Parcelado" foi adicionado como forma de pagamento no app (itens de sinal/parcelamento),
-- mas o check constraint de eventos.forma_pagamento ainda só aceitava as 6 opções antigas —
-- toda tentativa de salvar um evento com "Parcelado" era recusada pelo próprio banco.

alter table public.eventos
  drop constraint if exists eventos_forma_pagamento_check;

alter table public.eventos
  add constraint eventos_forma_pagamento_check
  check (forma_pagamento in ('PIX','Transferência','Dinheiro','Cartão de Crédito','Cartão de Débito','Cheque','Parcelado'));
