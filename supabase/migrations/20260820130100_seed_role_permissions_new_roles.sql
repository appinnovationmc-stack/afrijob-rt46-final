-- Seeds role_permissions for the 8 roles added in
-- 20260820130000_expand_organisation_roles.sql.
--
-- HONEST LIMITATION: this repo has no tracked source for the full
-- `permissions` catalog (it lives only in the production database, applied
-- outside version control). Rather than guess a permission_code list, this
-- migration copies each new role's starting grants from the nearest
-- existing role's actual live rows in role_permissions — whatever those
-- turn out to be — so no permission is invented here. Mapping used:
--   contractor                          <- copies from 'viewer'   (read-only baseline)
--   technician, inspector               <- copies from 'member'   (field-level baseline)
--   supervisor, fleet_manager,
--   operations_manager, finance         <- copies from 'manager'  (manager-level baseline)
--   procurement_officer                 <- copies from 'manager', then explicitly
--                                          granted procurement.approve / procurement.receive
--                                          if those codes exist in the live permissions table
--
-- This is a deliberately conservative starting point, not a finished
-- permission model — e.g. finance and fleet_manager get identical
-- manager-level access here, which is almost certainly broader than
-- intended for finance in a real deployment. Section 4 of the mandate
-- ("granular RBAC") is NOT satisfied by this migration alone; an admin
-- must review and tighten role_permissions per role before relying on
-- these distinctions for real access control. Marked INCOMPLETE for that
-- reason in AFRIOPS_PRODUCTION_READINESS.md.

-- Defensive: role_permissions, like organisation_members, was applied
-- outside this repo's tracked migrations, so its exact constraints aren't
-- visible here. The ON CONFLICT clauses below need a uniqueness guarantee
-- on (role, permission_code) — add it if missing, rather than assume.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.role_permissions'::regclass
      and contype = 'u'
      and conkey = (
        select array_agg(attnum order by attnum) from pg_attribute
        where attrelid = 'public.role_permissions'::regclass
          and attname in ('role', 'permission_code')
      )
  ) then
    alter table public.role_permissions
      add constraint role_permissions_role_code_unique unique (role, permission_code);
  end if;
end $$;

insert into public.role_permissions (role, permission_code, granted)
select 'contractor'::public.organisation_role, permission_code, granted
from public.role_permissions
where role = 'viewer'
on conflict (role, permission_code) do nothing;

insert into public.role_permissions (role, permission_code, granted)
select 'technician'::public.organisation_role, permission_code, granted
from public.role_permissions
where role = 'member'
on conflict (role, permission_code) do nothing;

insert into public.role_permissions (role, permission_code, granted)
select 'inspector'::public.organisation_role, permission_code, granted
from public.role_permissions
where role = 'member'
on conflict (role, permission_code) do nothing;

insert into public.role_permissions (role, permission_code, granted)
select 'supervisor'::public.organisation_role, permission_code, granted
from public.role_permissions
where role = 'manager'
on conflict (role, permission_code) do nothing;

insert into public.role_permissions (role, permission_code, granted)
select 'fleet_manager'::public.organisation_role, permission_code, granted
from public.role_permissions
where role = 'manager'
on conflict (role, permission_code) do nothing;

insert into public.role_permissions (role, permission_code, granted)
select 'operations_manager'::public.organisation_role, permission_code, granted
from public.role_permissions
where role = 'manager'
on conflict (role, permission_code) do nothing;

insert into public.role_permissions (role, permission_code, granted)
select 'finance'::public.organisation_role, permission_code, granted
from public.role_permissions
where role = 'manager'
on conflict (role, permission_code) do nothing;

insert into public.role_permissions (role, permission_code, granted)
select 'procurement_officer'::public.organisation_role, permission_code, granted
from public.role_permissions
where role = 'manager'
on conflict (role, permission_code) do nothing;

update public.role_permissions
set granted = true
where role = 'procurement_officer'
  and permission_code in ('procurement.approve', 'procurement.receive');

-- If those two codes didn't already have a row for procurement_officer
-- (e.g. 'manager' itself had no row for them), insert them explicitly.
insert into public.role_permissions (role, permission_code, granted)
select 'procurement_officer'::public.organisation_role, code, true
from (values ('procurement.approve'), ('procurement.receive')) as needed(code)
where exists (select 1 from public.permissions p where p.code = needed.code)
on conflict (role, permission_code) do update set granted = true;
