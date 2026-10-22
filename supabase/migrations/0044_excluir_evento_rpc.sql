-- Exclusão de evento de uma vez só, no banco: parcelas (receitas), despesas
-- ligadas (reembolso etc.), contratos e escala saem junto com o evento — ou
-- nada sai. Antes, a tela apagava item por item; quando o usuário não era
-- admin, o RLS barrava sem erro e a tela mostrava "excluído" enquanto evento
-- e faturamento continuavam no banco (aparecendo no Financeiro).
--
-- Regras:
--  - só administrador;
--  - não exclui se houver lançamento PAGO dentro de um período já fechado
--    (mudaria um fechamento emitido). Lançamento não pago em período fechado
--    pode sair: não entra em nenhum relatório.
--
-- Repasses a sócios gerados a partir das parcelas NÃO são apagados (podem já
-- ter sido pagos) — ficam como estão, só perdem o vínculo (FK on delete set null).

create or replace function public.excluir_evento(p_evento_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receitas int;
  v_contas int;
  v_contratos int;
begin
  if public.get_my_role() <> 'admin' then
    raise exception 'Somente administradores podem excluir eventos.';
  end if;

  if not exists (select 1 from eventos where id = p_evento_id) then
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

revoke all on function public.excluir_evento(uuid) from public;
grant execute on function public.excluir_evento(uuid) to authenticated;
