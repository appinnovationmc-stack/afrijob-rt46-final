-- RBAC review (Phase 2): Finance and Fleet Manager were granted identical
-- undifferentiated manager-level permissions, including cross-domain access
-- they should not have.
--
-- This migration continues the narrowing started in 20260827120000, applying
-- the same separation-of-duties principle to Finance and Fleet Manager.

-- Finance: financial oversight and procurement approval only.
-- Finance does NOT manage assets, incidents, suppliers, work orders, or compliance.
update public.role_permissions set granted = false
where role = 'finance' and permission_code in (
  'assets.create', 'assets.edit',
  'compliance.manage',
  'incidents.manage', 'incidents.create',
  'inventory.issue', 'inventory.manage', 'inventory.view',
  'maintenance.manage', 'maintenance.create',
  'notifications.send',
  'serviceproviders.manage', 'serviceproviders.create',
  'sites.manage', 'sites.create',
  'suppliers.manage', 'suppliers.create',
  'workorders.create', 'workorders.edit'
);

-- Ensure Finance has the core permissions it needs.
insert into public.role_permissions (role, permission_code, granted)
values
  ('finance', 'procurement.view', true),
  ('finance', 'procurement.approve', true),
  ('finance', 'org.view_billing', true),
  ('finance', 'workorders.view', true)
on conflict (role, permission_code) do update set granted = excluded.granted;

-- Fleet Manager: fleet assets, trips, drivers, and maintenance scheduling.
-- Fleet Manager does NOT manage procurement, suppliers, org billing, incidents, or compliance.
update public.role_permissions set granted = false
where role = 'fleet_manager' and permission_code in (
  'compliance.manage',
  'incidents.manage', 'incidents.create',
  'inventory.manage', 'inventory.issue',
  'maintenance.manage', 'maintenance.create',
  'notifications.send',
  'org.view_billing',
  'procurement.create', 'procurement.receive', 'procurement.approve',
  'serviceproviders.manage', 'serviceproviders.create',
  'sites.manage', 'sites.create',
  'suppliers.manage', 'suppliers.create',
  'workorders.create', 'workorders.edit'
);

-- Ensure Fleet Manager has the core permissions it needs.
insert into public.role_permissions (role, permission_code, granted)
values
  ('fleet_manager', 'assets.create', true),
  ('fleet_manager', 'assets.edit', true),
  ('fleet_manager', 'drivers.manage', true),
  ('fleet_manager', 'trips.manage', true),
  ('fleet_manager', 'maintenance.view', true),
  ('fleet_manager', 'incidents.view', true),
  ('fleet_manager', 'workorders.view', true)
on conflict (role, permission_code) do update set granted = excluded.granted;
