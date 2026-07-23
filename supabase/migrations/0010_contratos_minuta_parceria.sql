-- Dados legais do espaço (usados como CEDENTE/LOCADORA no texto do contrato gerado por IA) —
-- hoje só existiam hardcoded no texto dos modelos de Usine e Fabrique.
alter table public.espacos
  add column if not exists cnpj text,
  add column if not exists responsavel_nome text,
  add column if not exists responsavel_rg text,
  add column if not exists responsavel_cpf text;

-- Tipo de minuta (Locação valor fixo vs Parceria por %) deixa de ser travado por espaço
-- e vira uma escolha explícita por contrato, com os termos negociados guardados junto.
alter table public.contratos
  add column if not exists tipo_minuta text check (tipo_minuta in ('locacao','parceria')),
  add column if not exists valor_negociado numeric(12,2),
  add column if not exists observacao_negociacao text,
  add column if not exists observacao_parceria text;
