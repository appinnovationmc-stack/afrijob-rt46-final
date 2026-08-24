-- vehicles: replace blanket "any authenticated user" read with proper tenant scoping,
-- mirroring the access model already used on rt46.work_orders (admin / assigned merchant / owning org).
drop policy if exists "vehicles_select_all" on rt46.vehicles;

create policy "vehicles_select_scoped" on rt46.vehicles
for select
using (
  rt46.is_admin()
  or exists (
    select 1 from rt46.work_orders wo
    where wo.vehicle_id = vehicles.id
      and (
        rt46.is_merchant_staff(wo.allocated_merchant_id)
        or (wo.organisation_id is not null and is_org_admin(wo.organisation_id))
      )
  )
);

-- allocation_config: internal routing/allocation rules. Already admin-only for ALL
-- operations via allocation_config_admin_all; the separate "any authenticated user"
-- read policy had no legitimate non-admin consumer and is removed.
drop policy if exists "allocation_config_authenticated_read" on rt46.allocation_config;
