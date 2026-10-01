-- Nenhum repasse jamais foi gravado: a tabela repasses_socios está vazia
-- desde que foi criada em 0013, em todos os espaços. O caminho do banco
-- funciona — insert com a service role (que ignora RLS) passa, o schema tem
-- todas as colunas e a busca do espaço resolve. O que a service role NÃO
-- exercita é justamente a RLS, e é o único ponto que sobra: sem a policy de
-- insert, o RLS nega por padrão e todo registro falha igual, para qualquer
-- usuário — exatamente o sintoma observado.
--
-- Recria as três policies de forma idempotente. Se já existiam, isto é um
-- no-op; se alguma se perdeu (as migrations são aplicadas à mão aqui), volta
-- ao estado que 0013 descreve. Mesmo critério de contas_pagar: todo
-- autenticado lê, só admin/financeiro escreve.

alter table public.repasses_socios enable row level security;

drop policy if exists "repasses_socios_select" on public.repasses_socios;
create policy "repasses_socios_select" on public.repasses_socios
  for select to authenticated using (true);

drop policy if exists "repasses_socios_insert_financeiro" on public.repasses_socios;
create policy "repasses_socios_insert_financeiro" on public.repasses_socios
  for insert to authenticated with check (public.get_my_role() in ('admin','financeiro'));

drop policy if exists "repasses_socios_delete_financeiro" on public.repasses_socios;
create policy "repasses_socios_delete_financeiro" on public.repasses_socios
  for delete to authenticated using (public.get_my_role() in ('admin','financeiro'));
