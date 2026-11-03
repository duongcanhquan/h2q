-- Cho admin sửa và xóa hạng mục, công việc khối lượng.
grant update on public.tasks, public.boq_items to authenticated;
grant delete on public.tasks, public.boq_items to authenticated;

drop policy if exists tasks_update on public.tasks;
create policy tasks_update on public.tasks
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete on public.tasks
  for delete to authenticated
  using (public.is_admin());

drop policy if exists boq_update on public.boq_items;
create policy boq_update on public.boq_items
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists boq_delete on public.boq_items;
create policy boq_delete on public.boq_items
  for delete to authenticated
  using (public.is_admin());
