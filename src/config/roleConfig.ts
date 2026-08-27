// Central role configuration for AfriOps UI behavior
// This file defines the authoritative ROLE_CONFIG used by routing, navigation
// dashboard selection and module visibility in the frontend. It intentionally
// *does not* replace backend-authoritative permission checks (role_permissions
// and RLS remain the security boundary). The goal is to centralise UI
// behavior so different personas see materially different experiences.

export type OrganisationRole =
  | 'owner'
  | 'admin'
  | 'operations_manager'
  | 'fleet_manager'
  | 'procurement_officer'
  | 'finance'
  | 'inspector'
  | 'supervisor'
  | 'manager'
  | 'technician'
  | 'contractor'
  | 'member'
  | 'viewer'
  | 'rt46_admin';

export interface RoleNavItem {
  to: string;
  label: string;
  moduleKey?: string; // matches NAV_ITEMS.moduleKey where relevant
  icon?: string;
}

export interface RoleConfig {
  role: OrganisationRole;
  defaultLanding: string;
  dashboardKey: string; // string key used to pick a dashboard component in OpsDashboard
  nav: RoleNavItem[]; // primary navigation for this role
  allowedModules: string[]; // module keys allowed for this role
  canCreateEntities?: string[]; // convenience helper, not authoritative
}

// Minimal shared nav items used across configs. Keep list canonical and terse.
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
  finance: { to: '/ops', label: 'Finance', moduleKey: 'finance' } as RoleNavItem,
  rt46: { to: '/rt46', label: 'RT46', moduleKey: 'rt46' } as RoleNavItem,
};

// Base helper to include industry-specific labeling where needed.
function landingFor(role: OrganisationRole) {
  switch (role) {
    case 'technician': return '/ops/work-orders';
    case 'fleet_manager': return '/ops/workspace';
    case 'procurement_officer': return '/ops/procurement';
    case 'finance': return '/ops';
    case 'inspector': return '/ops/incidents';
    case 'owner': return '/ops/workspace';
    case 'admin': return '/ops/admin/team';
    case 'rt46_admin': return '/rt46';
    default: return '/ops/workspace';
  }
}

// The canonical role configuration object. Keep conservative access by default
// and prefer explicit listing of allowed modules per role.
export const ROLE_CONFIG: Record<OrganisationRole, RoleConfig> = {
  owner: {
    role: 'owner',
    defaultLanding: landingFor('owner'),
    dashboardKey: 'owner',
    nav: [NAV.workspace, NAV.intelligence, NAV.finance, NAV.procurement, NAV.assets, NAV.notifications, NAV.admin_team],
    allowedModules: ['workspace', 'intelligence', 'finance', 'procurement', 'assets', 'notifications', 'admin_team'],
  },
  admin: {
    role: 'admin',
    defaultLanding: landingFor('admin'),
    dashboardKey: 'admin',
    nav: [NAV.admin_team, NAV.assets, NAV.documents, NAV.notifications, NAV.intelligence],
    allowedModules: ['admin_team', 'assets', 'documents', 'notifications', 'intelligence'],
  },
  operations_manager: {
    role: 'operations_manager',
    defaultLanding: landingFor('operations_manager'),
    dashboardKey: 'operations_manager',
    nav: [NAV.workspace, NAV.work_orders, NAV.maintenance, NAV.sla, NAV.incidents, NAV.notifications],
    allowedModules: ['workspace', 'work_orders', 'maintenance', 'sla', 'incidents', 'notifications'],
  },
  fleet_manager: {
    role: 'fleet_manager',
    defaultLanding: landingFor('fleet_manager'),
    dashboardKey: 'fleet_manager',
    nav: [NAV.workspace, NAV.trips, NAV.drivers, NAV.assets, NAV.maintenance, NAV.notifications],
    allowedModules: ['workspace', 'trips', 'drivers', 'assets', 'maintenance', 'notifications'],
  },
  procurement_officer: {
    role: 'procurement_officer',
    defaultLanding: landingFor('procurement_officer'),
    dashboardKey: 'procurement_officer',
    nav: [NAV.procurement, NAV.assets, NAV.finance, NAV.documents, NAV.notifications],
    allowedModules: ['procurement', 'assets', 'finance', 'documents', 'notifications'],
  },
  finance: {
    role: 'finance',
    defaultLanding: landingFor('finance'),
    dashboardKey: 'finance',
    nav: [NAV.finance, NAV.procurement, NAV.documents, NAV.intelligence],
    allowedModules: ['finance', 'procurement', 'documents', 'intelligence'],
  },
  inspector: {
    role: 'inspector',
    defaultLanding: landingFor('inspector'),
    dashboardKey: 'inspector',
    nav: [NAV.incidents, NAV.maintenance, NAV.documents, NAV.notifications],
    allowedModules: ['incidents', 'maintenance', 'documents', 'notifications'],
  },
  supervisor: {
    role: 'supervisor',
    defaultLanding: landingFor('supervisor'),
    dashboardKey: 'supervisor',
    nav: [NAV.workspace, NAV.work_orders, NAV.notifications],
    allowedModules: ['workspace', 'work_orders', 'notifications'],
  },
  manager: {
    role: 'manager',
    defaultLanding: landingFor('manager'),
    dashboardKey: 'manager',
    nav: [NAV.workspace, NAV.work_orders, NAV.intelligence, NAV.notifications],
    allowedModules: ['workspace', 'work_orders', 'intelligence', 'notifications'],
  },
  technician: {
    role: 'technician',
    defaultLanding: landingFor('technician'),
    dashboardKey: 'technician',
    nav: [NAV.work_orders, NAV.inventory, NAV.documents, NAV.notifications],
    allowedModules: ['work_orders', 'inventory', 'documents', 'notifications'],
  },
  contractor: {
    role: 'contractor',
    defaultLanding: landingFor('contractor'),
    dashboardKey: 'contractor',
    nav: [NAV.work_orders, NAV.documents, NAV.notifications],
    allowedModules: ['work_orders', 'documents', 'notifications'],
  },
  member: {
    role: 'member',
    defaultLanding: landingFor('member'),
    dashboardKey: 'member',
    nav: [NAV.workspace, NAV.notifications],
    allowedModules: ['workspace', 'notifications'],
  },
  viewer: {
    role: 'viewer',
    defaultLanding: landingFor('viewer'),
    dashboardKey: 'viewer',
    nav: [NAV.workspace],
    allowedModules: ['workspace'],
  },
  rt46_admin: {
    role: 'rt46_admin',
    defaultLanding: landingFor('rt46_admin'),
    dashboardKey: 'rt46_admin',
    nav: [NAV.rt46, NAV.intelligence],
    allowedModules: ['rt46', 'intelligence'],
  },
};

export function getRoleConfig(role: OrganisationRole | undefined): RoleConfig {
  if (!role) return ROLE_CONFIG.viewer;
  return ROLE_CONFIG[role] ?? ROLE_CONFIG.viewer;
}
