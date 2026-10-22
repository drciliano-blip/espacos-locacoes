-- Exclusão em duas etapas:
--  1. Quem lança eventos (operacional, financeiro, admin) "exclui da agenda":
--     o evento sai da Agenda e a data fica livre para venda, mas NADA é
--     apagado — fica pendente, com quem pediu, quando e o motivo.
--  2. Um administrador aprova (excluir_evento: apaga de vez, com auditoria)
--     ou recusa (o evento volta para a Agenda).
--
-- Enquanto pendente, o faturamento do evento continua no Financeiro como
-- estava — só some se o admin aprovar.

alter table public.eventos
  add column if not exists exclusao_solicitada_em   timestamptz,
  add column if not exists exclusao_solicitada_por  uuid,
  add column if not exists exclusao_motivo          text;

alter table public.eventos_excluidos
  add column if not exists solicitado_por        uuid,
  add column if not exists solicitado_por_email  text,
  add column if not exists solicitado_em         timestamptz,
  add column if not exists motivo_solicitacao    text;

create or replace function public.solicitar_exclusao_evento(p_evento_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.get_my_role() not in ('admin', 'financeiro', 'operacional') then
    raise exception 'Seu perfil não pode excluir eventos da agenda.';
  end if;
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'Informe o motivo da exclusão.';
  end if;
  update eventos
     set exclusao_solicitada_em = now(), exclusao_solicitada_por = auth.uid(), exclusao_motivo = trim(p_motivo)
   where id = p_evento_id;
  if not found then
    raise exception 'Evento não encontrado.';
  end if;
end;
$$;

create or replace function public.recusar_exclusao_evento(p_evento_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.get_my_role() <> 'admin' then
    raise exception 'Somente administradores podem recusar a exclusão.';
  end if;
  update eventos
     set exclusao_solicitada_em = null, exclusao_solicitada_por = null, exclusao_motivo = null
   where id = p_evento_id;
end;
$$;

-- Mesma exclusão de 0045, agora registrando também quem pediu (quando houve pedido).
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
                                 motivo, excluido_por, excluido_por_email, snapshot,
                                 solicitado_por, solicitado_por_email, solicitado_em, motivo_solicitacao)
  values (
    p_evento_id, v_evento.cliente, v_evento.data,
    (select nome from espacos where id = v_evento.espaco_id), v_evento.valor,
    coalesce((select sum(valor) from receitas where evento_id = p_evento_id and status = 'pago'), 0),
    coalesce((select sum(valor) from receitas where evento_id = p_evento_id), 0),
    trim(p_motivo), auth.uid(), (select email from auth.users where id = auth.uid()), v_snapshot,
    v_evento.exclusao_solicitada_por,
    (select email from auth.users where id = v_evento.exclusao_solicitada_por),
    v_evento.exclusao_solicitada_em, v_evento.exclusao_motivo
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

revoke all on function public.solicitar_exclusao_evento(uuid, text) from public;
revoke all on function public.recusar_exclusao_evento(uuid) from public;
revoke all on function public.excluir_evento(uuid, text) from public;
grant execute on function public.solicitar_exclusao_evento(uuid, text) to authenticated;
grant execute on function public.recusar_exclusao_evento(uuid) to authenticated;
grant execute on function public.excluir_evento(uuid, text) to authenticated;
