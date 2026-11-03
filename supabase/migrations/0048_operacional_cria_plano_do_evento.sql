-- Operação cadastra eventos, mas a policy de insert em receitas só aceitava
-- admin/financeiro: ao salvar um evento, o plano de pagamento padrão (Sinal +
-- Saldo) era recusado em silêncio e o evento ficava sem parcelas — fora da
-- cobrança, do atraso e do "a receber".
--
-- Libera para operação SÓ o que o cadastro do evento precisa: parcela de
-- evento, pendente, ligada a um evento. Dar baixa (update), mudar valor e
-- apagar continuam só com admin/financeiro.
create policy "receitas_insert_plano_evento_operacional" on public.receitas
  for insert to authenticated
  with check (
    public.get_my_role() = 'operacional'
    and tipo_entrada = 'evento'
    and status = 'pendente'
    and evento_id is not null
  );
