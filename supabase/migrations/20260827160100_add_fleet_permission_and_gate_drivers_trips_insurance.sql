-- drivers, trips, and vehicle_insurance_policies (from fleet_drivers_and_trips
-- and fleet_vehicle_insurance migrations) were never wired into the
-- permission matrix at all -- zero fleet.* permission codes existed before
-- this migration. Any org member, including a viewer, could write/edit any
-- driver, trip, or insurance policy record via direct API call.
--
-- Adds fleet.manage / fleet.view, seeded to mirror the existing
-- maintenance.manage pattern: owner/admin/manager/supervisor/fleet_manager/
-- operations_manager get manage; member/technician/inspector get view only;
-- procurement_officer/finance get neither (consistent with how they're
-- excluded from assets.edit and maintenance.manage). This is a conservative
-- default for a previously-completely-ungated surface -- widen later via
-- the permission matrix UI if a role needs more.
-- Applied live and verified against pg_policies.

insert into public.permissions (code, module, description) values
  ('fleet.manage', 'fleet', 'Create and edit drivers, trips, and vehicle insurance records'),
  ('fleet.view', 'fleet', 'View drivers, trips, and vehicle insurance records')
on conflict (code) do nothing;

insert into public.role_permissions (role, permission_code, granted)
select r.role, p.code, true
from (values
  ('owner'::organisation_role), ('admin'::organisation_role),
  ('manager'::organisation_role), ('supervisor'::organisation_role),
  ('fleet_manager'::organisation_role), ('operations_manager'::organisation_role)
) as r(role)
cross join (values ('fleet.manage'), ('fleet.view')) as p(code)
on conflict (role, permission_code) do update set granted = true;

insert into public.role_permissions (role, permission_code, granted)
select r.role, 'fleet.view', true
from (values
  ('member'::organisation_role), ('technician'::organisation_role),
  ('inspector'::organisation_role)
) as r(role)
on conflict (role, permission_code) do update set granted = true;

drop policy if exists drivers_update_member on public.drivers;
create policy drivers_update_member on public.drivers for update
using (is_org_member(organisation_id) and has_permission(organisation_id, 'fleet.manage'));

drop policy if exists drivers_write_member on public.drivers;
create policy drivers_write_member on public.drivers for insert
with check (is_org_member(organisation_id) and has_permission(organisation_id, 'fleet.manage'));

drop policy if exists trips_update_member on public.trips;
create policy trips_update_member on public.trips for update
using (is_org_member(organisation_id) and has_permission(organisation_id, 'fleet.manage'));

drop policy if exists trips_write_member on public.trips;
create policy trips_write_member on public.trips for insert
with check (is_org_member(organisation_id) and has_permission(organisation_id, 'fleet.manage'));

drop policy if exists vehicle_insurance_update_member on public.vehicle_insurance_policies;
create policy vehicle_insurance_update_member on public.vehicle_insurance_policies for update
using (is_org_member(organisation_id) and has_permission(organisation_id, 'fleet.manage'));

drop policy if exists vehicle_insurance_write_member on public.vehicle_insurance_policies;
create policy vehicle_insurance_write_member on public.vehicle_insurance_policies for insert
with check (is_org_member(organisation_id) and has_permission(organisation_id, 'fleet.manage'));
