-- A tela de evento oferece "Locação Portaria" como categoria desde que o tipo
-- TipoEvento ganhou o quarto valor, mas a trava do banco nunca foi atualizada:
-- continuava só com os três originais. Resultado — selecionar essa categoria
-- derrubava o salvamento inteiro do evento com violação de check constraint,
-- e o usuário não tinha como saber qual campo era o culpado.

alter table public.eventos drop constraint if exists eventos_tipo_evento_check;

alter table public.eventos add constraint eventos_tipo_evento_check
  check (tipo_evento in ('Festivo', 'Corporativo', 'Audiovisual', 'Locação Portaria'));
