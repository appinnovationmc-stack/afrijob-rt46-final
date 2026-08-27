-- Close gap: work_orders INSERT/UPDATE only checked org membership, not permission.
-- A viewer role (or any org member) could update/create any work order via a
-- direct API call, bypassing the UI. Brings work_orders in line with the
-- jobs table pattern (see gate_jobs_write_by_org_permission).
-- Applied live to wtbycozfoeiepvgortvx and verified against pg_policies.

drop policy if exists work_orders_update_member on public.work_orders;
create policy work_orders_update_member
on public.work_orders
for update
using (
  is_org_member(organisation_id)
  and has_permission(organisation_id, 'workorders.edit')
);

drop policy if exists work_orders_write_member on public.work_orders;
create policy work_orders_write_member
on public.work_orders
for insert
with check (
  is_org_member(organisation_id)
  and has_permission(organisation_id, 'workorders.create')
);
