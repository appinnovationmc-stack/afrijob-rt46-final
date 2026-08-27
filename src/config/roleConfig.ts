// Central role configuration for AfriOps UI behavior
// Frontend persona configuration only; backend permissions and RLS remain authoritative.
export type OrganisationRole =
  | 'owner' | 'admin' | 'operations_manager' | 'fleet_manager' | 'procurement_officer'
  | 'finance' | 'inspector' | 'supervisor' | 'manager' | 'technician' | 'contractor'
  | 'member' | 'viewer' | 'rt46_admin';

export interface RoleNavItem { to: string; label: string; moduleKey?: string; icon?: string; }
export interface RoleConfig {
  role: OrganisationRole;
  defaultLanding: string;
  dashboardKey: string;
  nav: RoleNavItem[];
  allowedModules: string[];
  canCreateEntities?: string[];
}

const NAV = {
  workspace: { to: '/ops/workspace', label: 'Industry Control Centre', moduleKey: 'workspace' } as RoleNavItem,
  intelligence: { to: '/ops/intelligence', label: 'Operational Intelligence', moduleKey: 'intelligence' } as RoleNavItem,
  work_orders: { to: '/ops/work-orders', label: 'Work Orders', moduleKey: 'work_orders' } as RoleNavItem,
  inventory: { to: '/ops/inventory', label: 'Inventory', moduleKey: 'inventory' } as RoleNavItem,
  procurement: { to: '/ops/procurement', label: 'Procurement', moduleKey: 'procurement' } as RoleNavItem,
  documents: { to: '/ops/documents', label: 'Document Vault', moduleKey: 'documents' } as RoleNavItem,
  incidents: { to: '/ops/incidents', label: 'Incidents', moduleKey: 'incidents' } as RoleNavItem,
  maintenance: { to: '/ops/maintenance', label: 'Preventive Maintenance', moduleKey: 'maintenance' } as RoleNavItem,
  sla: { to: '/ops/sla', label: 'SLA Tracking', moduleKey: 'sla' } as RoleNavItem,
  notifications: { to: '/ops/notifications', label: 'Notifications', moduleKey: 'notifications' } as RoleNavItem,
  assets: { to: '/ops/admin/assets', label: 'Asset Registry', moduleKey: 'assets' } as RoleNavItem,
  drivers: { to: '/ops/admin/drivers', label: 'Drivers', moduleKey: 'drivers' } as RoleNavItem,
  trips: { to: '/ops/trips', label: 'Trips', moduleKey: 'trips' } as RoleNavItem,
  admin_team: { to: '/ops/admin/team', label: 'Team', moduleKey: 'admin_team' } as RoleNavItem,
  finance: { to: '/ops/finance', label: 'Finance', moduleKey: 'finance' } as RoleNavItem,
  serviceproviders: { to: '/ops/admin/service-providers', label: 'Service Providers', moduleKey: 'serviceproviders' } as RoleNavItem,
  compliance: { to: '/ops/compliance', label: 'Compliance', moduleKey: 'compliance' } as RoleNavItem,
  audit: { to: '/ops/admin/audit', label: 'Audit Trail', moduleKey: 'audit' } as RoleNavItem,
  rt46: { to: '/rt46', label: 'RT46', moduleKey: 'rt46' } as RoleNavItem,
};

function landingFor(role: OrganisationRole) {
  switch (role) {
    case 'technician': return '/ops/work-orders';
    case 'procurement_officer': return '/ops/procurement';
    case 'finance': return '/ops/finance';
    case 'rt46_admin': return '/rt46';
    default: return '/ops';
  }
}

export const ROLE_CONFIG: Record<OrganisationRole, RoleConfig> = {
  owner: { role: 'owner', defaultLanding: landingFor('owner'), dashboardKey: 'owner', nav: [NAV.workspace, NAV.intelligence, NAV.work_orders, NAV.inventory, NAV.procurement, NAV.documents, NAV.incidents, NAV.maintenance, NAV.sla, NAV.assets, NAV.drivers, NAV.trips, NAV.serviceproviders, NAV.compliance, NAV.audit, NAV.notifications, NAV.admin_team], allowedModules: ['workspace','intelligence','work_orders','inventory','procurement','documents','incidents','maintenance','sla','assets','drivers','trips','serviceproviders','compliance','audit','notifications','admin_team'] },
  admin: { role: 'admin', defaultLanding: landingFor('admin'), dashboardKey: 'admin', nav: [NAV.workspace, NAV.intelligence, NAV.work_orders, NAV.inventory, NAV.procurement, NAV.documents, NAV.incidents, NAV.maintenance, NAV.sla, NAV.assets, NAV.drivers, NAV.trips, NAV.serviceproviders, NAV.compliance, NAV.audit, NAV.notifications, NAV.admin_team], allowedModules: ['workspace','intelligence','work_orders','inventory','procurement','documents','incidents','maintenance','sla','assets','drivers','trips','serviceproviders','compliance','audit','notifications','admin_team'] },
  operations_manager: { role: 'operations_manager', defaultLanding: landingFor('operations_manager'), dashboardKey: 'operations_manager', nav: [NAV.workspace, NAV.work_orders, NAV.inventory, NAV.maintenance, NAV.sla, NAV.incidents, NAV.assets, NAV.drivers, NAV.serviceproviders, NAV.compliance, NAV.audit, NAV.notifications], allowedModules: ['workspace','work_orders','inventory','maintenance','sla','incidents','assets','drivers','serviceproviders','compliance','audit','notifications'] },
  fleet_manager: { role: 'fleet_manager', defaultLanding: landingFor('fleet_manager'), dashboardKey: 'fleet_manager', nav: [NAV.workspace, NAV.work_orders, NAV.trips, NAV.drivers, NAV.assets, NAV.maintenance, NAV.incidents, NAV.procurement, NAV.compliance, NAV.serviceproviders, NAV.notifications], allowedModules: ['workspace','work_orders','trips','drivers','assets','maintenance','incidents','procurement','compliance','serviceproviders','notifications'] },
  procurement_officer: { role: 'procurement_officer', defaultLanding: landingFor('procurement_officer'), dashboardKey: 'procurement_officer', nav: [NAV.procurement, NAV.inventory, NAV.work_orders, NAV.incidents, NAV.documents, NAV.compliance, NAV.serviceproviders, NAV.notifications], allowedModules: ['procurement','inventory','work_orders','incidents','documents','compliance','serviceproviders','notifications'] },
  finance: { role: 'finance', defaultLanding: landingFor('finance'), dashboardKey: 'finance', nav: [NAV.finance, NAV.procurement, NAV.documents, NAV.intelligence, NAV.work_orders], allowedModules: ['finance','procurement','documents','intelligence','work_orders'] },
  inspector: { role: 'inspector', defaultLanding: landingFor('inspector'), dashboardKey: 'inspector', nav: [NAV.incidents, NAV.work_orders, NAV.assets, NAV.maintenance, NAV.documents, NAV.compliance, NAV.serviceproviders, NAV.notifications], allowedModules: ['incidents','work_orders','assets','maintenance','documents','compliance','serviceproviders','notifications'] },
  supervisor: { role: 'supervisor', defaultLanding: landingFor('supervisor'), dashboardKey: 'supervisor', nav: [NAV.workspace, NAV.work_orders, NAV.inventory, NAV.assets, NAV.procurement, NAV.incidents, NAV.maintenance, NAV.compliance, NAV.serviceproviders, NAV.audit, NAV.notifications], allowedModules: ['workspace','work_orders','inventory','assets','procurement','incidents','maintenance','compliance','serviceproviders','audit','notifications'] },
  manager: { role: 'manager', defaultLanding: landingFor('manager'), dashboardKey: 'manager', nav: [NAV.workspace, NAV.work_orders, NAV.inventory, NAV.procurement, NAV.assets, NAV.incidents, NAV.maintenance, NAV.sla, NAV.compliance, NAV.serviceproviders, NAV.audit, NAV.intelligence, NAV.notifications], allowedModules: ['workspace','work_orders','inventory','procurement','assets','incidents','maintenance','sla','compliance','serviceproviders','audit','intelligence','notifications'] },
  technician: { role: 'technician', defaultLanding: landingFor('technician'), dashboardKey: 'technician', nav: [NAV.work_orders, NAV.inventory, NAV.documents, NAV.incidents, NAV.compliance, NAV.notifications], allowedModules: ['work_orders','inventory','documents','incidents','compliance','notifications'] },
  contractor: { role: 'contractor', defaultLanding: landingFor('contractor'), dashboardKey: 'contractor', nav: [NAV.work_orders, NAV.documents, NAV.notifications], allowedModules: ['work_orders','documents','notifications'] },
  member: { role: 'member', defaultLanding: landingFor('member'), dashboardKey: 'member', nav: [NAV.workspace, NAV.work_orders, NAV.assets, NAV.procurement, NAV.incidents, NAV.notifications], allowedModules: ['workspace','work_orders','assets','procurement','incidents','notifications'] },
  viewer: { role: 'viewer', defaultLanding: landingFor('viewer'), dashboardKey: 'viewer', nav: [NAV.workspace], allowedModules: ['workspace'] },
  rt46_admin: { role: 'rt46_admin', defaultLanding: landingFor('rt46_admin'), dashboardKey: 'rt46_admin', nav: [NAV.rt46, NAV.intelligence], allowedModules: ['rt46','intelligence'] },
};

export function getRoleConfig(role: OrganisationRole | undefined): RoleConfig {
  if (!role) return ROLE_CONFIG.viewer;
  return ROLE_CONFIG[role] ?? ROLE_CONFIG.viewer;
}
