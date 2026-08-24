-- Platform-level Super Admin, separate from organisation-level 'admin'/
-- 'owner' roles (which are scoped to a single organisation by design and
-- were confirmed, via this session's RLS audit, to have no way to see
-- across tenants). This is a genuinely new privilege boundary, so it is
-- built deliberately conservatively:
--   - a dedicated table, not a flag on an existing role
--   - starts EMPTY — creating this migration grants nobody access; a
--     human with database access must explicitly INSERT a profile_id
--   - every grant/revoke is audited via platform_audit_log (same table
--     used for role_permissions changes earlier this session)
--   - is_platform_admin() is used ONLY to ADD read (and later, narrowly
--     scoped write) policies alongside existing org-scoped ones — it does
--     not replace or weaken any existing tenant-isolation policy.
create table if not exists public.platform_admins (
  profile_id uuid primary key references public.profiles(id),
  granted_by uuid references public.profiles(id),
  granted_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;

-- Only existing platform admins can see who else is one — an empty table
-- means this also means "nobody but a superuser/service-role can see or
-- change this table" until the first admin is granted directly via SQL.
create policy "platform_admins_select_self_or_admin" on public.platform_admins
  for select using (
    profile_id = auth.uid()
    or exists (select 1 from public.platform_admins pa where pa.profile_id = auth.uid())
  );

create or replace function public.is_platform_admin()
returns boolean
language sql
security definer
stable
set search_path = 'public'
as $function$
  select exists (select 1 from public.platform_admins where profile_id = auth.uid());
$function$;

revoke all on function public.is_platform_admin() from public;
grant execute on function public.is_platform_admin() to authenticated;

-- Additive read policies: platform admins can see every organisation and
-- every billing account, on top of (not instead of) each org's own
-- members seeing their own org. Existing organisations_select_member and
-- billing_accounts_select_member policies are untouched.
create policy "organisations_select_platform_admin" on public.organisations
  for select using (public.is_platform_admin());

create policy "billing_accounts_select_platform_admin" on public.billing_accounts
  for select using (public.is_platform_admin());

-- Audit trigger for grants/revokes on platform_admins itself — this is
-- the highest-privilege table in the system, it should never change
-- silently.
create or replace function public.log_platform_admin_change()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $function$
begin
  insert into public.platform_audit_log (entity_type, entity_id, action, actor_profile_id, before_data, after_data, metadata)
  values (
    'platform_admins',
    coalesce(new.profile_id, old.profile_id)::text,
    tg_op,
    auth.uid(),
    case when tg_op = 'DELETE' then to_jsonb(old) else null end,
    case when tg_op = 'INSERT' then to_jsonb(new) else null end,
    '{}'::jsonb
  );
  return coalesce(new, old);
end;
$function$;

revoke all on function public.log_platform_admin_change() from public;
grant execute on function public.log_platform_admin_change() to authenticated;
revoke execute on function public.log_platform_admin_change() from anon;

drop trigger if exists platform_admins_audit on public.platform_admins;
create trigger platform_admins_audit
  after insert or delete on public.platform_admins
  for each row execute function public.log_platform_admin_change();
