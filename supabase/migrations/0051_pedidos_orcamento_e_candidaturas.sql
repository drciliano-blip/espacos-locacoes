-- Plano 2027 (plataforma multiespaços) — porta de entrada pelo site.
--
-- pedidos_orcamento: todo contato de quem quer alugar um espaço. O registro
-- com data e hora é o que prova que o cliente foi apresentado pela
-- plataforma (art. 726 do Código Civil) e é de onde sai o tempo de resposta.
--
-- espacos_candidatos: dono de espaço que quer entrar na plataforma ("Anuncie
-- seu espaço"). Ainda NÃO é um espaço: vira espaço só depois do checklist de
-- documentos e da aprovação da equipe.
--
-- Os dois formulários são públicos (embutidos no WordPress): o visitante sem
-- login só pode INSERIR, e só como 'novo'. Ler, mudar status e anotar é da
-- equipe (admin e operacional). Excluir: só admin.

create table if not exists public.pedidos_orcamento (
  id uuid primary key default gen_random_uuid(),
  numero integer generated always as identity unique,
  created_at timestamptz not null default now(),
  origem text not null default 'site' check (origem in ('site', 'whatsapp', 'indicacao', 'instagram', 'outro')),
  pagina_origem text,
  espaco_id uuid references public.espacos(id) on delete set null,
  espaco_nome text,
  nome text not null,
  telefone text not null,
  email text,
  data_evento date,
  data_flexivel boolean not null default false,
  numero_pessoas integer check (numero_pessoas is null or numero_pessoas > 0),
  tipo_evento text,
  servicos text[] not null default '{}',
  mensagem text,
  status text not null default 'novo' check (status in ('novo', 'em_atendimento', 'proposta_enviada', 'ganho', 'perdido')),
  primeiro_contato_em timestamptz,
  observacoes text,
  motivo_perda text,
  updated_at timestamptz not null default now()
);

create table if not exists public.espacos_candidatos (
  id uuid primary key default gen_random_uuid(),
  numero integer generated always as identity unique,
  created_at timestamptz not null default now(),
  pagina_origem text,
  nome_espaco text not null,
  responsavel_nome text not null,
  telefone text not null,
  email text not null,
  cnpj text,
  bairro text not null,
  cidade text not null default 'São Paulo',
  capacidade integer check (capacidade is null or capacidade > 0),
  estilos text[] not null default '{}',
  plano_interesse text check (plano_interesse in ('vitrine', 'destaque', 'exclusivo', 'nao_sei')),
  documentos text[] not null default '{}',
  site_instagram text,
  mensagem text,
  status text not null default 'novo' check (status in ('novo', 'em_analise', 'documentacao', 'aprovado', 'recusado')),
  primeiro_contato_em timestamptz,
  observacoes text,
  updated_at timestamptz not null default now()
);

create index if not exists pedidos_orcamento_status_idx on public.pedidos_orcamento (status, created_at desc);
create index if not exists espacos_candidatos_status_idx on public.espacos_candidatos (status, created_at desc);

-- ── Acesso ─────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['pedidos_orcamento', 'espacos_candidatos'] loop
    execute format('alter table public.%I enable row level security', t);

    -- Formulário público: só cria, e só como 'novo', sem anotações da equipe.
    execute format('drop policy if exists "%1$s_insert_anon" on public.%1$I', t);
    execute format('create policy "%1$s_insert_anon" on public.%1$I for insert to anon with check (status = ''novo'' and primeiro_contato_em is null and observacoes is null)', t);

    execute format('drop policy if exists "%1$s_select" on public.%1$I', t);
    execute format('create policy "%1$s_select" on public.%1$I for select to authenticated using (public.get_my_role() in (''admin'',''operacional''))', t);
    execute format('drop policy if exists "%1$s_insert" on public.%1$I', t);
    execute format('create policy "%1$s_insert" on public.%1$I for insert to authenticated with check (public.get_my_role() in (''admin'',''operacional''))', t);
    execute format('drop policy if exists "%1$s_update" on public.%1$I', t);
    execute format('create policy "%1$s_update" on public.%1$I for update to authenticated using (public.get_my_role() in (''admin'',''operacional'')) with check (public.get_my_role() in (''admin'',''operacional''))', t);
    execute format('drop policy if exists "%1$s_delete" on public.%1$I', t);
    execute format('create policy "%1$s_delete" on public.%1$I for delete to authenticated using (public.get_my_role() = ''admin'')', t);
    -- Perfil credenciamento nunca enxerga nada fora do cadastro dele (ver 0042).
    execute format('drop policy if exists "%1$s_sem_credenciamento" on public.%1$I', t);
    execute format('create policy "%1$s_sem_credenciamento" on public.%1$I as restrictive for all to authenticated using (public.get_my_role() <> ''credenciamento'') with check (public.get_my_role() <> ''credenciamento'')', t);
  end loop;
end $$;

grant insert on public.pedidos_orcamento to anon;
grant insert on public.espacos_candidatos to anon;
grant select, insert, update, delete on public.pedidos_orcamento to authenticated;
grant select, insert, update, delete on public.espacos_candidatos to authenticated;
