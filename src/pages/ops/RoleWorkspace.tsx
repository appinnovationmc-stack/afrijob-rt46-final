import { Link } from 'react-router-dom';
import { CalendarClock, CheckCircle2, FileCheck2, Gauge, Package, ShieldAlert, ShoppingCart, Users, Wrench } from 'lucide-react';
import { useOrganisation } from '@/hooks/useOrganisation';
import type { OrganisationRole } from '@/lib/afriops/types';

const ROLE_COPY: Record<OrganisationRole, { title: string; subtitle: string; links: { to: string; label: string; description: string; icon: React.ElementType }[] }> = {
  fleet_manager: {
    title: 'Fleet Control', subtitle: 'Vehicles, availability, maintenance and incidents', links: [
      { to: '/ops/work-orders', label: 'Work Orders', description: 'Monitor vehicle repairs and downtime', icon: Wrench },
      { to: '/ops/maintenance', label: 'Maintenance', description: 'Track upcoming and overdue services', icon: CalendarClock },
      { to: '/ops/incidents', label: 'Incidents', description: 'Review accidents, breakdowns and incidents', icon: ShieldAlert },
      { to: '/ops/inventory', label: 'Parts & Inventory', description: 'Monitor parts availability', icon: Package },
      { to: '/ops/sla', label: 'SLA Tracking', description: 'Monitor repair response and resolution', icon: Gauge },
    ],
  },
  finance: {
    title: 'Finance Control', subtitle: 'Spend, approvals and financial oversight', links: [
      { to: '/ops/procurement', label: 'Procurement', description: 'Review purchasing activity and commitments', icon: ShoppingCart },
      { to: '/ops/work-orders', label: 'Work Orders', description: 'Review operational work driving spend', icon: Wrench },
      { to: '/ops/documents', label: 'Documents', description: 'Review supporting operational documents', icon: FileCheck2 },
    ],
  },
  supervisor: {
    title: 'Team Operations', subtitle: 'Supervision, workload and operational exceptions', links: [
      { to: '/ops/work-orders', label: 'Work Orders', description: 'Monitor team workload and job progress', icon: Wrench },
      { to: '/ops/incidents', label: 'Incidents', description: 'Review and escalate incidents', icon: ShieldAlert },
      { to: '/ops/maintenance', label: 'Maintenance', description: 'Track scheduled work', icon: CalendarClock },
      { to: '/ops/sla', label: 'SLA Tracking', description: 'Watch jobs approaching breach', icon: Gauge },
    ],
  },
  manager: {
    title: 'Management Control', subtitle: 'Workload, service performance and exceptions', links: [
      { to: '/ops/work-orders', label: 'Work Orders', description: 'Manage operational workload', icon: Wrench },
      { to: '/ops/sla', label: 'SLA Tracking', description: 'Monitor service performance', icon: Gauge },
      { to: '/ops/incidents', label: 'Incidents', description: 'Review operational incidents', icon: ShieldAlert },
      { to: '/ops/maintenance', label: 'Maintenance', description: 'Review maintenance obligations', icon: CalendarClock },
    ],
  },
  contractor: {
    title: 'Service Provider Workspace', subtitle: 'Assigned work, evidence and completion', links: [
      { to: '/ops/work-orders', label: 'Assigned Work', description: 'Open and update your assigned work orders', icon: Wrench },
      { to: '/ops/documents', label: 'Compliance Documents', description: 'Maintain required provider documentation', icon: FileCheck2 },
    ],
  },
  member: {
    title: 'Operations Workspace', subtitle: 'Your operational work and assigned responsibilities', links: [
      { to: '/ops/work-orders', label: 'Work Orders', description: 'View operational work you can access', icon: Wrench },
      { to: '/ops/notifications', label: 'Notifications', description: 'Review operational alerts', icon: CheckCircle2 },
    ],
  },
  viewer: {
    title: 'Read-Only Operations', subtitle: 'Operational information available to you', links: [
      { to: '/ops/work-orders', label: 'Work Orders', description: 'View permitted work orders', icon: Wrench },
      { to: '/ops/documents', label: 'Documents', description: 'View permitted documents', icon: FileCheck2 },
    ],
  },
  technician: { title: 'My Work', subtitle: 'Your assigned jobs and tasks', links: [{ to: '/ops/work-orders', label: 'My Work Orders', description: 'Open your assigned work', icon: Wrench }] },
  inspector: { title: 'Inspection Control', subtitle: 'Inspections, quality and compliance', links: [{ to: '/ops/work-orders', label: 'Work Orders', description: 'Inspect permitted work orders', icon: Wrench }, { to: '/ops/documents', label: 'Compliance', description: 'Review compliance evidence', icon: FileCheck2 }] },
  procurement_officer: { title: 'Procurement Control', subtitle: 'Suppliers, purchasing and receiving', links: [{ to: '/ops/procurement', label: 'Procurement', description: 'Suppliers, purchase orders and receiving', icon: ShoppingCart }, { to: '/ops/inventory', label: 'Inventory', description: 'Check stock and purchasing requirements', icon: Package }] },
  operations_manager: { title: 'Operations Control', subtitle: 'Workload, allocation, SLA and exceptions', links: [{ to: '/ops/work-orders', label: 'Work Orders', description: 'Manage operational workload', icon: Wrench }, { to: '/ops/sla', label: 'SLA Tracking', description: 'Monitor response and resolution', icon: Gauge }, { to: '/ops/incidents', label: 'Incidents', description: 'Manage operational incidents', icon: ShieldAlert }] },
  admin: { title: 'Organisation Administration', subtitle: 'People, assets, permissions and configuration', links: [{ to: '/ops/admin/team', label: 'Team', description: 'Manage organisation members and roles', icon: Users }, { to: '/ops/admin/permissions', label: 'Permissions', description: 'Configure role permissions', icon: Users }, { to: '/ops/admin/assets', label: 'Asset Registry', description: 'Manage organisational assets', icon: Package }, { to: '/ops/admin/settings', label: 'Organisation Settings', description: 'Configure the organisation', icon: FileCheck2 }] },
  owner: { title: 'Executive Control', subtitle: 'Organisation-wide performance and strategic oversight', links: [{ to: '/ops/intelligence', label: 'Operational Intelligence', description: 'Exceptions and recommended actions', icon: Gauge }, { to: '/ops/work-orders', label: 'Work Orders', description: 'Organisation-wide operational view', icon: Wrench }, { to: '/ops/admin/team', label: 'Team', description: 'Organisation people and roles', icon: Users }] },
};

export default function RoleWorkspace() {
  const { data: org } = useOrganisation();
  if (!org) return null;
  const config = ROLE_COPY[org.role] ?? ROLE_COPY.viewer;
  return (
    <div className="px-4 pt-6 pb-6">
      <div className="mb-6"><p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">{org.organisation_name}</p><h1 className="font-heading font-bold text-2xl">{config.title}</h1><p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{config.subtitle}</p></div>
      <div className="grid gap-3">{config.links.map(({ to, label, description, icon: Icon }) => <Link key={to} to={to} className="card flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-charcoal-light flex items-center justify-center shrink-0"><Icon className="w-5 h-5 text-brand" /></div><div className="flex-1"><p className="font-semibold text-sm">{label}</p><p className="text-xs text-gray-500 dark:text-gray-400">{description}</p></div></Link>)}</div>
    </div>
  );
}
