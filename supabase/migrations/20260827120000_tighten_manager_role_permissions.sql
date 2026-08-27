-- RBAC review (handover doc section 3.3): Finance, Fleet Manager and
-- Operations Manager were granted an identical, undifferentiated set of 28
-- "manager" permissions each -- including cross-domain *.manage rights none
-- of them need (e.g. Finance could manage inventory, sites and service
-- providers; Fleet Manager and Operations Manager could manage suppliers).
-- Procurement Officer additionally held procurement.approve, meaning the
-- role that creates purchase orders could also approve its own -- a
-- separation-of-duties gap.
--
-- This migration narrows each role to what its name implies and restores
-- approval authority to Finance/Admin/Owner only. It only revokes grants
-- that were broader than the role's function; it does not touch admin,
-- owner or technician, and does not remove any *.view permission.

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

-- Fleet Manager: manages fleet assets, trips, maintenance and incidents;
-- does not own supplier contracts, PO approval/receiving or org billing.
update public.role_permissions set granted = false
where role = 'fleet_manager' and permission_code in (
  'org.view_billing',
  'procurement.receive',
  'suppliers.manage'
);

-- Operations Manager: cross-functional oversight of work orders, SLA,
-- incidents and maintenance; does not run procurement, supplier contracts,
-- inventory stock levels or billing.
update public.role_permissions set granted = false
where role = 'operations_manager' and permission_code in (
  'inventory.manage',
  'org.view_billing',
  'procurement.create', 'procurement.receive',
  'suppliers.manage'
);

-- Procurement Officer: owns the procurement/supplier/inventory-receiving
-- lifecycle; does not approve its own requests, and does not manage
-- incidents, maintenance, compliance, sites or service providers.
update public.role_permissions set granted = false
where role = 'procurement_officer' and permission_code in (
  'assets.create', 'assets.edit',
  'compliance.manage',
  'incidents.manage',
  'maintenance.manage',
  'notifications.send',
  'procurement.approve',
  'serviceproviders.manage',
  'sites.manage'
);
