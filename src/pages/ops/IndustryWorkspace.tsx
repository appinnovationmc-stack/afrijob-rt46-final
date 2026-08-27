import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Boxes, CalendarClock, FileCheck2, Gauge, Lightbulb, ShoppingCart, Wrench } from 'lucide-react';
import { useOrganisation, INDUSTRY_CONFIG, INDUSTRY_LABELS, isModuleEnabled } from '@/hooks/useOrganisation';
import { useInventoryItems, useExpiringDocuments, isBelowReorderPoint } from '@/hooks/useAfriops';
import { useIncidents } from '@/hooks/useIncidents';
import { useDueMaintenanceSchedules } from '@/hooks/useMaintenanceSchedules';
import { useOpenSlaBreaches } from '@/hooks/useSla';
import { useWorkOrders } from '@/hooks/useWorkOrders';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { cn } from '@/lib/utils';

const ACTIONS = [
  { key: 'work_orders', label: 'Work Orders', description: 'Create, assign and control operational work', to: '/ops/work-orders', icon: Wrench },
  { key: 'maintenance', label: 'Maintenance', description: 'Prevent downtime with scheduled work', to: '/ops/maintenance', icon: CalendarClock },
  { key: 'inventory', label: 'Inventory', description: 'Control parts, stock and replenishment', to: '/ops/inventory', icon: Boxes },
  { key: 'procurement', label: 'Procurement', description: 'Suppliers and purchase orders', to: '/ops/procurement', icon: ShoppingCart },
  { key: 'incidents', label: 'Incidents', description: 'Capture and resolve operational risk', to: '/ops/incidents', icon: AlertTriangle },
  { key: 'documents', label: 'Compliance', description: 'Documents, verification and expiry', to: '/ops/documents', icon: FileCheck2 },
  { key: 'sla', label: 'SLA Control', description: 'Monitor response and resolution targets', to: '/ops/sla', icon: Gauge },
  { key: 'intelligence', label: 'Intelligence', description: 'Prioritised exceptions and recommendations', to: '/ops/intelligence', icon: Lightbulb },
] as const;

const MODE_COPY: Record<string, { title: string; subtitle: string; primary: string[] }> = {
  fleet: { title: 'Fleet Control Centre', subtitle: 'Keep vehicles available, compliant and cost-efficient.', primary: ['Vehicles', 'Drivers', 'Trips', 'Maintenance', 'Incidents'] },
  mining: { title: 'Mining Operations Centre', subtitle: 'Control equipment availability, safety and site maintenance.', primary: ['Equipment', 'Sites', 'Safety', 'Maintenance', 'Contractors'] },
  municipal: { title: 'Municipal Service Centre', subtitle: 'Coordinate public assets, service requests and SLA performance.', primary: ['Assets', 'Service Requests', 'Facilities', 'SLA', 'Compliance'] },
  government: { title: 'Government Operations Centre', subtitle: 'Run accountable procurement, compliance and service delivery.', primary: ['Assets', 'Procurement', 'Compliance', 'SLA', 'Audit'] },
  logistics: { title: 'Logistics Control Centre', subtitle: 'Keep vehicles moving, routes reliable and deliveries on time.', primary: ['Vehicles', 'Routes', 'Fuel', 'Maintenance', 'Incidents'] },
  general: { title: 'Operations Control Centre', subtitle: 'Run assets, work, maintenance, risk and procurement in one place.', primary: ['Assets', 'Work Orders', 'Maintenance', 'Inventory', 'Compliance'] },
};

function Metric({ label, value, tone = 'default' }: { label: string; value: number; tone?: 'default' | 'warning' | 'danger' }) {
  return <div className="card"><p className={cn('text-2xl font-heading font-bold', tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-charcoal dark:text-white')}>{value}</p><p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</p></div>;
}

export default function IndustryWorkspace() {
  const { data: org, isLoading: orgLoading } = useOrganisation();
  const { data: workOrders, isLoading: workLoading } = useWorkOrders();
  const { data: incidents, isLoading: incidentsLoading } = useIncidents('reported');
  const { data: maintenance, isLoading: maintenanceLoading } = useDueMaintenanceSchedules();
  const { data: breaches, isLoading: slaLoading } = useOpenSlaBreaches();
  const { data: inventory, isLoading: inventoryLoading } = useInventoryItems();
  const { data: expiringDocs, isLoading: docsLoading } = useExpiringDocuments();

  if (!orgLoading && !org) return <div className="px-4 pt-6"><EmptyState icon={Gauge} title="No organisation found" description="Your account isn't linked to an organisation yet." /></div>;

  const mode = org?.industry_mode ?? 'general';
  const config = INDUSTRY_CONFIG[mode];
  const copy = MODE_COPY[mode];
  const openWork = (workOrders ?? []).filter((w) => !['completed', 'cancelled', 'disputed'].includes(w.status)).length;
  const lowStock = (inventory ?? []).filter(isBelowReorderPoint).length;
  const loading = orgLoading || workLoading || incidentsLoading || maintenanceLoading || slaLoading || inventoryLoading || docsLoading;
  const actions = ACTIONS.filter((action) => action.key === 'work_orders' || action.key === 'intelligence' || isModuleEnabled(org?.enabled_modules, action.key));

  return <div className="px-4 pt-6 pb-8 max-w-6xl mx-auto">
    <header className="mb-6">
      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-semibold"><span>{org?.organisation_name}</span><span>•</span><span>{INDUSTRY_LABELS[mode]}</span></div>
      <h1 className="font-heading font-bold text-2xl mt-1">{copy.title}</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{copy.subtitle}</p>
      <div className="flex flex-wrap gap-2 mt-4">{copy.primary.map((item) => <span key={item} className="px-2.5 py-1 rounded-full bg-brand-50 dark:bg-charcoal-light text-xs font-medium text-brand">{item}</span>)}</div>
    </header>

    {loading ? <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">{[1,2,3,4].map((i) => <SkeletonCard key={i} />)}</div> : <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <Metric label="Open work orders" value={openWork} tone={openWork ? 'warning' : 'default'} />
      <Metric label="Maintenance due" value={maintenance?.length ?? 0} tone={(maintenance?.length ?? 0) ? 'warning' : 'default'} />
      <Metric label="Open incidents" value={incidents?.length ?? 0} tone={(incidents?.length ?? 0) ? 'warning' : 'default'} />
      <Metric label="SLA breaches" value={breaches?.length ?? 0} tone={(breaches?.length ?? 0) ? 'danger' : 'default'} />
    </div>}

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
      <section className="card lg:col-span-2">
        <div className="flex items-center justify-between mb-3"><div><h2 className="font-heading font-bold">Run the operation</h2><p className="text-xs text-gray-500 mt-0.5">One workflow surface, prioritised for {INDUSTRY_LABELS[mode]}.</p></div><Link to="/ops/intelligence" className="text-xs font-semibold text-brand">View intelligence</Link></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{actions.map(({ key, label, description, to, icon: Icon }) => <Link key={key} to={to} className="flex items-center gap-3 rounded-xl border border-gray-100 dark:border-charcoal-light p-3 hover:bg-gray-50 dark:hover:bg-charcoal-light transition-colors"><div className="w-9 h-9 rounded-lg bg-brand-50 dark:bg-charcoal-light flex items-center justify-center"><Icon className="w-4 h-4 text-brand" /></div><div className="min-w-0 flex-1"><p className="font-semibold text-sm">{label}</p><p className="text-xs text-gray-500 dark:text-gray-400 truncate">{description}</p></div><ArrowRight className="w-4 h-4 text-gray-300" /></Link>)}</div>
      </section>
      <section className="card"><h2 className="font-heading font-bold mb-3">Attention now</h2><div className="space-y-3 text-sm">
        <Link to="/ops/inventory" className="flex justify-between gap-3"><span className="text-gray-600 dark:text-gray-300">Low stock</span><strong>{lowStock}</strong></Link>
        <Link to="/ops/documents" className="flex justify-between gap-3"><span className="text-gray-600 dark:text-gray-300">Expiring documents</span><strong>{expiringDocs?.length ?? 0}</strong></Link>
        <Link to="/ops/sla" className="flex justify-between gap-3"><span className="text-gray-600 dark:text-gray-300">SLA breaches</span><strong className={(breaches?.length ?? 0) ? 'text-danger' : ''}>{breaches?.length ?? 0}</strong></Link>
        <Link to="/ops/maintenance" className="flex justify-between gap-3"><span className="text-gray-600 dark:text-gray-300">Maintenance due</span><strong>{maintenance?.length ?? 0}</strong></Link>
      </div></section>
    </div>

    <section className="rounded-2xl border border-brand/20 bg-brand-50/40 dark:bg-charcoal-light p-4"><div className="flex gap-3"><Lightbulb className="w-5 h-5 text-brand mt-0.5 shrink-0"/><div><p className="font-semibold text-sm">AfriOps operating principle</p><p className="text-xs text-gray-600 dark:text-gray-300 mt-1">The same operational record can be managed differently by industry without fragmenting the underlying organisation, asset, work-order, compliance and cost data.</p><p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Current mode: <strong>{INDUSTRY_LABELS[mode]}</strong> · terminology: <strong>{config.assetLabelPlural}</strong></p></div></div></section>
  </div>;
}
