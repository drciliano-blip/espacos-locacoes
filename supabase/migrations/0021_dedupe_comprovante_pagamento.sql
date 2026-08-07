-- Hash do conteúdo do arquivo (SHA-256, calculado no navegador) — usado pra
-- detectar quando o mesmo comprovante é reenviado pra dar baixa em outra conta,
-- mesmo que o arquivo tenha sido salvo com outro nome.
alter table public.files add column file_hash text;
create index if not exists files_file_hash_idx on public.files (file_hash) where file_hash is not null;

-- Metadados extraídos do comprovante (além de valor/data/hora, que já existiam)
-- pra reforçar a detecção de duplicidade quando o hash não bate (ex: comprovante
-- reexportado/rescaneado, mas representando a mesma transação).
alter table public.contas_pagar add column comprovante_instituicao text;
alter table public.contas_pagar add column comprovante_identificador text;
