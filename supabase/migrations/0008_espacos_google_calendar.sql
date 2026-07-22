-- Vincula cada espaço a uma conta Google específica (refresh token OAuth com acesso offline),
-- para sincronizar com a agenda daquele e-mail em vez de depender de quem está logado no navegador.
--
-- Nenhuma policy é criada para "authenticated" de propósito: só o backend (service role key,
-- usado nas rotas /api/google-calendar/*) acessa esta tabela. O client nunca lê o token direto.

create table public.espacos_google_calendar (
  espaco_id                uuid primary key references public.espacos(id) on delete cascade,
  google_email             text,
  refresh_token            text not null,
  access_token             text,
  access_token_expires_at  timestamptz,
  connected_at             timestamptz not null default now()
);

alter table public.espacos_google_calendar enable row level security;
