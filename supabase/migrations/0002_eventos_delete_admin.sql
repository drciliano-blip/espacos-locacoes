-- Restringe exclusão de eventos a usuários admin
--
-- COMO RODAR: Supabase Dashboard → SQL Editor → New query → colar → Run.
-- Aditivo ao 0001_init.sql (que já foi executado).

drop policy if exists "eventos_delete" on public.eventos;

create policy "eventos_delete_admin" on public.eventos
  for delete to authenticated using (public.get_my_role() = 'admin');
