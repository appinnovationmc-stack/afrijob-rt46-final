import type { OrganisationRole } from '@/lib/afriops/types';

// Frontend navigation policy. Database RLS/has_permission remains the security boundary.
// This map controls which workspaces a role should see and prevents the UI from
// presenting an unrelated module to a specialist user.
export const ROLE_MODULE_ACCESS: Record<OrganisationRole, string[]> = {
  owner: ['intelligence', 'work_orders', 'inventory', 'procurement', 'documents', 'incidents', 'maintenance', 'sla', 'notifications'],
  admin: ['intelligence', 'work_orders', 'inventory', 'procurement', 'documents', 'incidents', 'maintenance', 'sla', 'notifications'],
  operations_manager: ['intelligence', 'work_orders', 'inventory', 'procurement', 'documents', 'incidents', 'maintenance', 'sla', 'notifications'],
  manager: ['intelligence', 'work_orders', 'documents', 'incidents', 'maintenance', 'sla', 'notifications'],
  fleet_manager: ['intelligence', 'work_orders', 'inventory', 'documents', 'incidents', 'maintenance', 'sla', 'notifications'],
  supervisor: ['work_orders', 'documents', 'incidents', 'maintenance', 'sla', 'notifications'],
  procurement_officer: ['work_orders', 'inventory', 'procurement', 'documents', 'notifications'],
  finance: ['work_orders', 'procurement', 'documents', 'notifications'],
  inspector: ['work_orders', 'documents', 'incidents', 'sla', 'notifications'],
  technician: ['work_orders', 'inventory', 'documents', 'notifications'],
  contractor: ['work_orders', 'documents', 'notifications'],
  member: ['work_orders', 'notifications'],
  viewer: ['work_orders', 'documents', 'notifications'],
};

export function roleCanAccessModule(role: OrganisationRole | undefined, moduleKey: string): boolean {
  return !!role && (ROLE_MODULE_ACCESS[role]?.includes(moduleKey) ?? false);
}
