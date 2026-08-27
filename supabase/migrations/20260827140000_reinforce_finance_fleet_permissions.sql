-- Reinforce Finance and Fleet Manager permission narrowing.
-- Idempotent: safe to re-run. Matches the intent of
-- 20260827120000_tighten_manager_role_permissions.sql and ensures live
-- environments that may have partially applied that migration still end
-- with the correct grants.

-- Finance: financial + billing oversight, does not run field operations.
update public.role_permissions set granted = false
where role = 'finance' and permission_code in (
  'assets.create', 'assets.edit',
  'compliance.manage',
  'incidents.manage',
  'inventory.issue', 'inventory.manage',
  'maintenance.manage',
  'notifications.send',
  'serviceproviders.manage',
  'sites.manage',
  'suppliers.manage',
  'workorders.create', 'workorders.edit'
);

insert into public.role_permissions (role, permission_code, granted)
values ('finance', 'procurement.approve', true)
on conflict (role, permission_code) do update set granted = excluded.granted;

-- Fleet Manager: fleet assets, trips, maintenance and incidents;
-- does not own supplier contracts, PO approval/receiving or org billing.
update public.role_permissions set granted = false
where role = 'fleet_manager' and permission_code in (
  'org.view_billing',
  'procurement.receive',
  'suppliers.manage',
  'procurement.approve',
  'procurement.create'
);
