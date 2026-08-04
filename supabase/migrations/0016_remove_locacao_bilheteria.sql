-- Remove a modalidade "Locação Bilheteria" — ficam só Locação e Parceria.

-- Eventos que porventura já estejam marcados com o tipo removido caem para
-- "locacao" (padrão), evitando violar a nova constraint.
update public.eventos set tipo_contrato = 'locacao' where tipo_contrato = 'locacao_bilheteria';

alter table public.eventos drop constraint if exists eventos_tipo_contrato_check;
alter table public.eventos add constraint eventos_tipo_contrato_check
  check (tipo_contrato in ('locacao', 'parceria'));

alter table public.eventos alter column tipo_contrato set default 'locacao';
