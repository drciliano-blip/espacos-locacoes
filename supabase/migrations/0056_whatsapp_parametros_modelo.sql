-- WhatsApp Campanhas: modelos com variáveis no corpo.
-- parametros = o que vai em cada {{n}} do corpo, em ordem. Hoje só existe
-- 'primeiro_nome' (tirado do nome salvo do contato). Coluna nova, com padrão
-- vazio: campanhas existentes continuam iguais.
alter table public.wa_campaigns add column if not exists parametros text[] not null default '{}';
alter table public.wa_campaigns add column if not exists template_texto text;
