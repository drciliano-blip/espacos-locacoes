-- Vincula automaticamente o modelo de contrato ao tipo do evento, desde o cadastro.

alter table public.eventos
  add column if not exists tipo_contrato text
  check (tipo_contrato in ('locacao', 'locacao_bilheteria', 'parceria'));
