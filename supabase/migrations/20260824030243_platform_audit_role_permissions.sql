-- role_permissions is global/non-org-scoped, so it cannot log into the
-- org-scoped public.audit_log. It logs into public.platform_audit_log instead.
-- Also adds the missing owner-tier write policy: role_permissions previously
-- had RLS enabled with only a SELECT policy, so the Permission Matrix's
-- "owner can edit" UI was silently failing at the DB layer.

create or replace function public.log_role_permission_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.platform_audit_log (entity_type, entity_id, action, actor_profile_id, before_data, after_data, metadata)
  values (
    'role_permissions',
    coalesce(new.role, old.role)::text || ':' || coalesce(new.permission_code, old.permission_code),
    tg_op,
    auth.uid(),
    case when tg_op = 'UPDATE' then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end,
    '{}'::jsonb
  );
  return coalesce(new, old);
end;
$function$;

drop trigger if exists role_permissions_audit on public.role_permissions;
create trigger role_permissions_audit
  after insert or update or delete on public.role_permissions
  for each row execute function public.log_role_permission_change();

drop policy if exists "platform owners can write role_permissions" on public.role_permissions;
create policy "platform owners can write role_permissions"
  on public.role_permissions
  for all
  using (exists (
    select 1 from public.organisation_members om
    where om.profile_id = auth.uid() and om.role = 'owner'::organisation_role
  ))
  with check (exists (
    select 1 from public.organisation_members om
    where om.profile_id = auth.uid() and om.role = 'owner'::organisation_role
  ));
