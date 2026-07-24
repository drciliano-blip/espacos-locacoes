-- Cadastro de evento passa a coletar os mesmos dados solicitados ao cliente pra
-- elaborar o contrato (pessoa física, pessoa jurídica e detalhes do evento),
-- evitando duplicar cadastro entre ficha/evento/contrato.

alter table public.eventos
  add column if not exists nome_evento            text,
  add column if not exists hora_inicio_montagem    time,
  add column if not exists cpf                     text,
  add column if not exists rg                      text,
  add column if not exists data_nascimento         date,
  add column if not exists email                   text,
  add column if not exists endereco                jsonb,
  add column if not exists pessoa_juridica          boolean not null default false,
  add column if not exists razao_social            text,
  add column if not exists nome_fantasia            text,
  add column if not exists cnpj                     text,
  add column if not exists endereco_empresa        jsonb;
