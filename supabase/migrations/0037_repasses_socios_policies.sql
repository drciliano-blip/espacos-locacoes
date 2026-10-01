-- Nenhum repasse jamais foi gravado: repasses_socios está vazia desde que foi
-- criada em 0013, em todos os espaços. A consulta a pg_policies mostrou por
-- quê — a tabela tem UMA policy, só de SELECT. As de insert e delete que 0013
-- descreve nunca chegaram ao banco (as migrations são aplicadas à mão aqui),
-- e sem policy de insert o RLS nega por padrão: todo registro de repasse
-- falhava igual, para qualquer usuário, desde sempre.
--
-- Cria só o que falta. O SELECT fica como está: 0018 o trocou de propósito
-- para pode_ver_espaco(espaco_id), pra que sócio só enxergue repasse do
-- espaço dele — recriá-lo como "using (true)" devolveria a visão de todos os
-- espaços a todo mundo.

alter table public.repasses_socios enable row level security;

-- Mesmo critério de receitas e contas_pagar: só admin/financeiro escreve.
drop policy if exists "repasses_socios_insert_financeiro" on public.repasses_socios;
create policy "repasses_socios_insert_financeiro" on public.repasses_socios
  for insert to authenticated with check (public.get_my_role() in ('admin','financeiro'));

drop policy if exists "repasses_socios_delete_financeiro" on public.repasses_socios;
create policy "repasses_socios_delete_financeiro" on public.repasses_socios
  for delete to authenticated using (public.get_my_role() in ('admin','financeiro'));
