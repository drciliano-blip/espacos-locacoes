-- Guarda o texto original colado (Ordem de Serviço/Pagamento recebida por
-- WhatsApp) usado para preencher uma conta a pagar via IA, pra consulta
-- posterior dentro do cadastro da conta.
alter table public.contas_pagar add column texto_origem_whatsapp text;
