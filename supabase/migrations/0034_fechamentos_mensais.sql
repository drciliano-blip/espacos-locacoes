-- Fechamento formal de período por espaço — registra que um período foi
-- fechado (quem, quando) e guarda a "foto" dos valores calculados naquele
-- momento, pra prestação de contas aos sócios nunca mudar depois, mesmo que
-- a fórmula de cálculo mude no futuro. Sem update: é imutável por natureza —
-- "reabrir" é apagar o registro (a trava aplicada nos contexts de Receitas/
-- Contas a Pagar deixa de valer; o rastro do que existiu fica em `atividades`).

create table public.fechamentos_mensais (
  id                            uuid primary key default gen_random_uuid(),
  espaco_id                     uuid not null references public.espacos(id) on delete cascade,
  data_inicio                   date not null,
  data_fim                      date not null,
  resultado_operacional         numeric(12,2) not null default 0,
  resultado_acumulado           numeric(12,2) not null default 0,
  fundo_reserva_deduzido        numeric(12,2) not null default 0,
  retirada_deduzida             numeric(12,2) not null default 0,
  disponivel_do_espaco          numeric(12,2) not null default 0,
  disponivel_para_distribuicao  numeric(12,2) not null default 0,
  repasse_socios                jsonb not null default '[]'::jsonb,
  fechado_por                   uuid references public.profiles(id) on delete set null,
  fechado_por_nome              text,
  created_at                    timestamptz not null default now(),
  unique (espaco_id, data_inicio, data_fim)
);

create index fechamentos_mensais_espaco_periodo_idx on public.fechamentos_mensais (espaco_id, data_inicio, data_fim);

alter table public.fechamentos_mensais enable row level security;

create policy "fechamentos_mensais_select" on public.fechamentos_mensais
  for select to authenticated using (public.pode_ver_espaco(espaco_id));
create policy "fechamentos_mensais_insert_financeiro" on public.fechamentos_mensais
  for insert to authenticated with check (public.get_my_role() in ('admin','financeiro'));
create policy "fechamentos_mensais_delete_financeiro" on public.fechamentos_mensais
  for delete to authenticated using (public.get_my_role() in ('admin','financeiro'));
