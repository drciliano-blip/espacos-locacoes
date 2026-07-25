-- Campo único de texto livre para as condições comerciais de eventos do tipo "Parceria",
-- substituindo a seção de Forma de Pagamento nesse caso.

alter table public.eventos
  add column if not exists condicoes_parceria text;
