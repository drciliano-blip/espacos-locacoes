-- Conciliação Bancária: importar extrato do banco (OFX/CSV/XLS/PDF) e
-- comparar contra o que já foi lançado no sistema (receitas/contas_pagar).
-- Status de conciliação nunca é persistido aqui — é sempre recalculado em
-- memória (ver src/lib/conciliacao-bancaria.ts). Só o vínculo explícito
-- (lancamento_tipo/lancamento_id), quando o usuário liga uma movimentação a
-- um lançamento, é dado real de banco.
--
-- COMO RODAR: Supabase Dashboard → SQL Editor → New query → colar → Run.
-- Aditivo aos anteriores (0001..0029).

create table public.extratos_bancarios (
  id                  uuid primary key default gen_random_uuid(),
  espaco_id           uuid references public.espacos(id) on delete set null, -- null = conta da empresa toda
  banco               text,
  conta               text,
  nome_arquivo        text not null,
  formato             text not null check (formato in ('ofx','csv','xlsx','xls','pdf')),
  periodo_inicio      date,
  periodo_fim         date,
  saldo_inicial       numeric(12,2),
  saldo_final         numeric(12,2),
  file_hash           text not null,
  arquivo_file_id     uuid references public.files(id) on delete set null,
  total_movimentacoes integer not null default 0,
  created_by          uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now()
);
create unique index extratos_bancarios_file_hash_uidx on public.extratos_bancarios (file_hash);

create table public.movimentacoes_bancarias (
  id                      uuid primary key default gen_random_uuid(),
  extrato_id              uuid not null references public.extratos_bancarios(id) on delete cascade,
  espaco_id               uuid references public.espacos(id) on delete set null,
  data                    date not null,
  hora                    text,
  descricao               text not null,
  valor                   numeric(12,2) not null,
  tipo                    text not null check (tipo in ('entrada','saida')),
  tipo_transacao          text check (tipo_transacao in ('pix','ted','doc','boleto','cartao','transferencia','tarifa','outro')),
  identificador_transacao text,
  favorecido_pagador      text,
  dedupe_hash             text not null,
  lancamento_tipo         text check (lancamento_tipo in ('receita','conta_pagar')),
  lancamento_id           uuid,
  created_by              uuid references public.profiles(id) on delete set null,
  created_at              timestamptz not null default now(),
  constraint movimentacoes_bancarias_lancamento_par check ((lancamento_tipo is null) = (lancamento_id is null))
);
create index on public.movimentacoes_bancarias (extrato_id);
create index on public.movimentacoes_bancarias (data);
create index on public.movimentacoes_bancarias (dedupe_hash);
create index on public.movimentacoes_bancarias (lancamento_tipo, lancamento_id) where lancamento_id is not null;

-- receitas ganha os mesmos campos que contas_pagar já tem (migrations 0020/0021)
-- — sem isso, conciliar entradas seria mais fraco que conciliar saídas.
alter table public.receitas add column comprovante_instituicao text;
alter table public.receitas add column comprovante_identificador text;
alter table public.receitas add column hora_recebimento text;

alter table public.files drop constraint if exists files_module_check;
alter table public.files add constraint files_module_check
  check (module in ('contas','contratos','agenda','pagamentos','espacos','funcionarios','fichas','receitas','extratos'));

alter table public.extratos_bancarios enable row level security;
alter table public.movimentacoes_bancarias enable row level security;

-- Dado bancário bruto é sensível — restrito a admin/financeiro (nem sócio vê),
-- diferente de receitas/contas_pagar que sócio enxerga com escopo por espaço.
create policy "extratos_bancarios_select" on public.extratos_bancarios
  for select to authenticated using (public.get_my_role() in ('admin','financeiro'));
create policy "extratos_bancarios_insert" on public.extratos_bancarios
  for insert to authenticated with check (public.get_my_role() in ('admin','financeiro'));
create policy "extratos_bancarios_delete" on public.extratos_bancarios
  for delete to authenticated using (public.get_my_role() in ('admin','financeiro'));

create policy "movimentacoes_bancarias_select" on public.movimentacoes_bancarias
  for select to authenticated using (public.get_my_role() in ('admin','financeiro'));
create policy "movimentacoes_bancarias_insert" on public.movimentacoes_bancarias
  for insert to authenticated with check (public.get_my_role() in ('admin','financeiro'));
create policy "movimentacoes_bancarias_update" on public.movimentacoes_bancarias
  for update to authenticated using (public.get_my_role() in ('admin','financeiro'))
  with check (public.get_my_role() in ('admin','financeiro'));
create policy "movimentacoes_bancarias_delete" on public.movimentacoes_bancarias
  for delete to authenticated using (public.get_my_role() in ('admin','financeiro'));
