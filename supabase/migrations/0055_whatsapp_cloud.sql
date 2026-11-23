-- WhatsApp direto pela Cloud API da Meta (campanhas com modelo aprovado,
-- status e respostas por webhook, caixa de entrada). Módulo separado do
-- WhatsApp pelo Blip (assistente_atendimentos): tabelas novas, nada existente
-- é alterado.
--
-- Escrita só pelas rotas de servidor (service role). O front só lê, e só
-- administrador e operacional.

create table if not exists public.wa_contacts (
  id                 uuid primary key default gen_random_uuid(),
  telefone           text not null unique check (telefone ~ '^[0-9]{10,15}$'), -- E.164 sem "+"
  nome               text,
  segmento           text,
  opt_out            boolean not null default false,
  opt_out_at         timestamptz,
  origem             text,
  ultima_entrada_at  timestamptz, -- última mensagem do cliente (janela de 24 h)
  ultima_saida_at    timestamptz,
  created_at         timestamptz not null default now()
);
create index if not exists wa_contacts_segmento_idx on public.wa_contacts (segmento);
create index if not exists wa_contacts_conversa_idx on public.wa_contacts (greatest(ultima_entrada_at, ultima_saida_at) desc nulls last);

create table if not exists public.wa_campaigns (
  id               uuid primary key default gen_random_uuid(),
  nome             text not null,
  template_name    text not null,
  template_lang    text not null default 'pt_BR',
  segmento         text, -- null = todos os segmentos
  status           text not null default 'rascunho'
                     check (status in ('rascunho', 'enviando', 'pausada', 'concluida')),
  total            integer not null default 0,
  enviados         integer not null default 0,
  entregues        integer not null default 0,
  lidos            integer not null default 0,
  falhas           integer not null default 0,
  respostas        integer not null default 0,
  created_by_nome  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.wa_messages (
  id               uuid primary key default gen_random_uuid(),
  campaign_id      uuid references public.wa_campaigns(id) on delete set null,
  contact_id       uuid not null references public.wa_contacts(id) on delete cascade,
  direction        text not null check (direction in ('out', 'in')),
  wa_message_id    text unique,
  tipo             text not null,
  conteudo         jsonb not null default '{}'::jsonb,
  status           text not null default 'pendente'
                     check (status in ('pendente', 'accepted', 'sent', 'delivered', 'read', 'failed', 'received')),
  erro             jsonb,
  enviado_por_nome text,
  created_at       timestamptz not null default now(),
  sent_at          timestamptz,
  delivered_at     timestamptz,
  read_at          timestamptz,
  failed_at        timestamptz
);
create index if not exists wa_messages_contact_idx on public.wa_messages (contact_id, created_at desc);
create index if not exists wa_messages_campaign_idx on public.wa_messages (campaign_id);
create index if not exists wa_messages_saida_24h_idx on public.wa_messages (created_at) where direction = 'out' and tipo = 'template';
-- Um contato recebe cada campanha uma vez só (trava contra disparo duplicado).
create unique index if not exists wa_messages_campanha_contato_uq
  on public.wa_messages (campaign_id, contact_id) where direction = 'out' and campaign_id is not null;

create table if not exists public.wa_webhook_events (
  id             bigint generated always as identity primary key,
  payload        jsonb not null,
  assinatura_ok  boolean not null default false,
  recebido_em    timestamptz not null default now()
);
create index if not exists wa_webhook_events_recebido_idx on public.wa_webhook_events (recebido_em desc);

-- RLS ---------------------------------------------------------------------
alter table public.wa_contacts       enable row level security;
alter table public.wa_campaigns      enable row level security;
alter table public.wa_messages       enable row level security;
alter table public.wa_webhook_events enable row level security;

do $$
declare t text;
begin
  foreach t in array array['wa_contacts', 'wa_campaigns', 'wa_messages'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select to authenticated
         using (public.get_my_role() in (''admin'', ''operacional''))', t || '_select', t);
  end loop;
  foreach t in array array['wa_contacts', 'wa_campaigns', 'wa_messages', 'wa_webhook_events'] loop
    execute format('drop policy if exists %I on public.%I', t || '_sem_credenciamento', t);
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated
         using (public.get_my_role() <> ''credenciamento'')
         with check (public.get_my_role() <> ''credenciamento'')', t || '_sem_credenciamento', t);
  end loop;
end $$;

drop policy if exists "wa_webhook_events_select" on public.wa_webhook_events;
create policy "wa_webhook_events_select" on public.wa_webhook_events
  for select to authenticated using (public.get_my_role() = 'admin');

-- Funções (só service role) ---------------------------------------------------

-- Recalcula os contadores de uma campanha a partir das mensagens.
create or replace function public.wa_recontar_campanha(p_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.wa_campaigns c set
    enviados  = s.enviados,
    entregues = s.entregues,
    lidos     = s.lidos,
    falhas    = s.falhas,
    respostas = s.respostas,
    updated_at = now()
  from (
    select
      count(*) filter (where direction = 'out' and status in ('accepted', 'sent', 'delivered', 'read')) as enviados,
      count(*) filter (where direction = 'out' and status in ('delivered', 'read')) as entregues,
      count(*) filter (where direction = 'out' and status = 'read') as lidos,
      count(*) filter (where direction = 'out' and status = 'failed') as falhas,
      count(distinct contact_id) filter (where direction = 'in') as respostas
    from public.wa_messages where campaign_id = p_id
  ) s
  where c.id = p_id;
$$;

-- Aplica um status vindo do webhook sem andar para trás (os eventos podem
-- chegar fora de ordem: "read" antes de "delivered"). Devolve a campanha.
create or replace function public.wa_aplicar_status(p_wa_id text, p_status text, p_ts timestamptz, p_erro jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  ordem constant text[] := array['pendente', 'accepted', 'sent', 'delivered', 'read'];
  m record;
begin
  select id, campaign_id, status into m from public.wa_messages where wa_message_id = p_wa_id for update;
  if not found then return null; end if;

  if p_status = 'failed' then
    update public.wa_messages set status = 'failed', erro = coalesce(p_erro, erro), failed_at = p_ts where id = m.id;
  elsif m.status <> 'failed' and array_position(ordem, p_status) > coalesce(array_position(ordem, m.status), 0) then
    update public.wa_messages set
      status       = p_status,
      sent_at      = case when p_status in ('sent', 'delivered', 'read') then coalesce(sent_at, p_ts) else sent_at end,
      delivered_at = case when p_status in ('delivered', 'read') then coalesce(delivered_at, p_ts) else delivered_at end,
      read_at      = case when p_status = 'read' then p_ts else read_at end
    where id = m.id;
  end if;
  return m.campaign_id;
end $$;

revoke all on function public.wa_recontar_campanha(uuid) from public, anon, authenticated;
revoke all on function public.wa_aplicar_status(text, text, timestamptz, jsonb) from public, anon, authenticated;
