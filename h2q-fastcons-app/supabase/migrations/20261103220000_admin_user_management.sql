-- Run this if 20261103180000_standalone_app.sql was already applied.
-- Lets an admin update people and assign them to projects from the app.

grant update on public.profiles, public.project_members to authenticated;
grant delete on public.project_members to authenticated;

drop policy if exists members_update on public.project_members;
create policy members_update on public.project_members
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists members_delete on public.project_members;
create policy members_delete on public.project_members
  for delete to authenticated
  using (public.is_admin());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());
