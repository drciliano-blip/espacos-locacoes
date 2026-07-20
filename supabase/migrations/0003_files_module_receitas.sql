-- Permite anexar relatórios (bar, alimentação, ingressos, etc.) na aba Eventos > Receitas
--
-- COMO RODAR: Supabase Dashboard → SQL Editor → New query → colar → Run.
-- Aditivo aos anteriores (0001, 0002).

alter table public.files drop constraint if exists files_module_check;

alter table public.files add constraint files_module_check
  check (module in ('contas','contratos','agenda','pagamentos','espacos','funcionarios','fichas','receitas'));
