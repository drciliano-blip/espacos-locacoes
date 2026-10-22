-- Auditoria de exclusão de eventos (prevenção de fraude): toda exclusão feita
-- pela função excluir_evento grava aqui, na mesma transação, quem excluiu,
-- quando, o motivo informado e uma cópia completa do evento e de tudo que saiu
-- junto (parcelas, despesas, contratos).
--
-- A tabela é só de inserção: não há policy de update nem de delete, então
-- nenhum usuário do sistema — nem administrador — consegue alterar ou apagar
-- um registro pela aplicação. A inserção acontece só dentro de
-- excluir_evento (security definer); o app também não tem policy de insert.
-- Leitura: apenas admin.

create table if not exists public.eventos_excluidos (
  id                  uuid primary key default gen_random_uuid(),
  evento_id           uuid not null,
  cliente             text,
  data_evento         date,
  espaco              text,
  valor_evento        numeric(12,2),
  total_recebido      numeric(12,2) not null default 0,
  total_parcelas      numeric(12,2) not null default 0,
  motivo              text not null,
  excluido_por        uuid,
  excluido_por_email  text,
  excluido_em         timestamptz not null default now(),
  snapshot            jsonb not null
);

create index if not exists eventos_excluidos_excluido_em_idx on public.eventos_excluidos (excluido_em desc);

alter table public.eventos_excluidos enable row level security;

drop policy if exists eventos_excluidos_select_admin on public.eventos_excluidos;
create policy eventos_excluidos_select_admin on public.eventos_excluidos
  for select to authenticated using (public.get_my_role() = 'admin');

-- Substitui a versão de 0044 (sem motivo/auditoria).
drop function if exists public.excluir_evento(uuid);

create or replace function public.excluir_evento(p_evento_id uuid, p_motivo text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_evento eventos%rowtype;
  v_receitas int;
  v_contas int;
  v_contratos int;
  v_snapshot jsonb;
begin
  if public.get_my_role() <> 'admin' then
    raise exception 'Somente administradores podem excluir eventos.';
  end if;
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'Informe o motivo da exclusão.';
  end if;

  select * into v_evento from eventos where id = p_evento_id;
  if not found then
    raise exception 'Evento não encontrado (pode já ter sido excluído).';
  end if;

  if exists (
    select 1 from receitas r
    join fechamentos_mensais f on f.espaco_id = r.espaco_id
    where r.evento_id = p_evento_id and r.status = 'pago'
      and coalesce(r.data_recebimento, r.data) between f.data_inicio and f.data_fim
  ) or exists (
    select 1 from contas_pagar c
    join fechamentos_mensais f on f.espaco_id = c.espaco_id
    where c.evento_id = p_evento_id and c.status = 'pago'
      and coalesce(c.data_pagamento, c.data_vencimento) between f.data_inicio and f.data_fim
  ) then
    raise exception 'Este evento tem valores já pagos/recebidos num mês já fechado no Financeiro. Use "Cancelar evento" ou reabra o fechamento antes de excluir.';
  end if;

  v_snapshot := jsonb_build_object(
    'evento',    to_jsonb(v_evento),
    'receitas',  coalesce((select jsonb_agg(to_jsonb(r)) from receitas r where r.evento_id = p_evento_id), '[]'::jsonb),
    'contas',    coalesce((select jsonb_agg(to_jsonb(c)) from contas_pagar c where c.evento_id = p_evento_id), '[]'::jsonb),
    'contratos', coalesce((select jsonb_agg(to_jsonb(c)) from contratos c where c.evento_id = p_evento_id), '[]'::jsonb),
    'escala',    coalesce((select jsonb_agg(to_jsonb(x)) from evento_escala x where x.evento_id = p_evento_id), '[]'::jsonb)
  );

  insert into eventos_excluidos (evento_id, cliente, data_evento, espaco, valor_evento, total_recebido, total_parcelas,
                                 motivo, excluido_por, excluido_por_email, snapshot)
  values (
    p_evento_id, v_evento.cliente, v_evento.data,
    (select nome from espacos where id = v_evento.espaco_id), v_evento.valor,
    coalesce((select sum(valor) from receitas where evento_id = p_evento_id and status = 'pago'), 0),
    coalesce((select sum(valor) from receitas where evento_id = p_evento_id), 0),
    trim(p_motivo), auth.uid(), (select email from auth.users where id = auth.uid()), v_snapshot
  );

  delete from contas_pagar where evento_id = p_evento_id;
  get diagnostics v_contas = row_count;
  delete from receitas where evento_id = p_evento_id;
  get diagnostics v_receitas = row_count;
  delete from contratos where evento_id = p_evento_id;
  get diagnostics v_contratos = row_count;
  delete from eventos where id = p_evento_id; -- evento_escala sai em cascata

  return json_build_object('receitas', v_receitas, 'contas', v_contas, 'contratos', v_contratos);
end;
$$;

revoke all on function public.excluir_evento(uuid, text) from public;
grant execute on function public.excluir_evento(uuid, text) to authenticated;
