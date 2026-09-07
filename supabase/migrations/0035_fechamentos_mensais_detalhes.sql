-- Amplia a "foto" do fechamento com o detalhe linha-a-linha de cada seção
-- (receita operacional, despesa operacional, aportes, despesas de obra,
-- retiradas) — sem isso, "Visualizar" um fechamento passado não tinha como
-- mostrar nada além dos totais agregados já existentes. Fechamentos feitos
-- antes desta coluna existir ficam com o padrão '{}' (a tela trata isso como
-- "sem detalhe disponível", sem quebrar).

alter table public.fechamentos_mensais add column detalhes jsonb not null default '{}'::jsonb;
