import { Link } from 'react-router-dom';
import { AlertTriangle, Car, Gauge, MapPinned, Route as RouteIcon, Wrench } from 'lucide-react';
import { useOrganisation } from '@/hooks/useOrganisation';
import { useAssets } from '@/hooks/useAssetRegistry';
import { useDrivers } from '@/hooks/useDrivers';
import { useDueMaintenanceSchedules } from '@/hooks/useMaintenanceSchedules';
import { useIncidents } from '@/hooks/useIncidents';
import { useOpenSlaBreaches } from '@/hooks/useSla';
import { useWorkOrders } from '@/hooks/useWorkOrders';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { cn } from '@/lib/utils';

function Kpi({ label, value, tone = 'default' }: { label: string; value: number; tone?: 'default' | 'warning' | 'danger' }) {
  return <div className={cn('card !py-3', tone === 'danger' && 'border-danger/40')}><p className={cn('text-2xl font-heading font-bold', tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-charcoal dark:text-white')}>{value}</p><p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</p></div>;
}

export default function FleetManagerDashboard() {
  const { data: org, isLoading: orgLoading } = useOrganisation();
  const { data: assets, isLoading: assetsLoading } = useAssets();
  const { data: drivers, isLoading: driversLoading } = useDrivers();
  const { data: maintenance, isLoading: maintenanceLoading } = useDueMaintenanceSchedules();
  const { data: incidents, isLoading: incidentsLoading } = useIncidents('reported');
  const { data: breaches, isLoading: slaLoading } = useOpenSlaBreaches();
  const { data: workOrders, isLoading: workOrdersLoading } = useWorkOrders();

  if (!orgLoading && !org) return <div className="px-4 pt-6"><EmptyState icon={Gauge} title="No organisation found" description="Your account isn't linked to an organisation." /></div>;
  if (orgLoading) return <div className="px-4 pt-6 space-y-2"><SkeletonCard /><SkeletonCard /></div>;

  const vehicles = assets ?? [];
  const unavailable = vehicles.filter((a) => ['down', 'maintenance', 'retired'].includes(a.status)).length;
  const open = (workOrders ?? []).filter((w) => !['completed', 'cancelled', 'disputed'].includes(w.status));
  const loading = assetsLoading || driversLoading || maintenanceLoading || incidentsLoading || slaLoading || workOrdersLoading;

  return <div className="px-4 pt-6 pb-8 max-w-6xl mx-auto">
    <header className="mb-6"><p className="text-xs uppercase tracking-wide font-semibold text-gray-500">{org?.organisation_name} · Fleet</p><h1 className="font-heading font-bold text-2xl mt-1">Fleet Command</h1><p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Availability, maintenance, drivers and operational risk.</p></header>
    {loading ? <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">{[1,2,3,4].map((i) => <SkeletonCard key={i} />)}</div> : <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <Kpi label="Vehicles" value={vehicles.length} />
      <Kpi label="Unavailable" value={unavailable} tone={unavailable ? 'danger' : 'default'} />
      <Kpi label="Maintenance due" value={maintenance?.length ?? 0} tone={maintenance?.length ? 'warning' : 'default'} />
      <Kpi label="Open work" value={open.length} tone={open.length ? 'warning' : 'default'} />
    </div>}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <Kpi label="Drivers" value={drivers?.length ?? 0} />
      <Kpi label="Open incidents" value={incidents?.length ?? 0} tone={incidents?.length ? 'danger' : 'default'} />
      <Kpi label="SLA breaches" value={breaches?.length ?? 0} tone={breaches?.length ? 'danger' : 'default'} />
      <Kpi label="Due maintenance" value={maintenance?.length ?? 0} tone={maintenance?.length ? 'warning' : 'default'} />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      <Link to="/ops/admin/assets" className="card flex items-center gap-3"><Car className="w-5 h-5 text-brand"/><div className="flex-1"><p className="font-semibold text-sm">Vehicles</p><p className="text-xs text-gray-500">Open Asset 360 and lifecycle history</p></div></Link>
      <Link to="/ops/admin/drivers" className="card flex items-center gap-3"><Gauge className="w-5 h-5 text-brand"/><div className="flex-1"><p className="font-semibold text-sm">Drivers</p><p className="text-xs text-gray-500">Licences and driver compliance</p></div></Link>
      <Link to="/ops/trips" className="card flex items-center gap-3"><RouteIcon className="w-5 h-5 text-brand"/><div className="flex-1"><p className="font-semibold text-sm">Trips</p><p className="text-xs text-gray-500">Vehicle movement operations</p></div></Link>
      <Link to="/ops/maintenance" className="card flex items-center gap-3"><Wrench className="w-5 h-5 text-brand"/><div className="flex-1"><p className="font-semibold text-sm">Maintenance</p><p className="text-xs text-gray-500">Upcoming and overdue services</p></div></Link>
      <Link to="/ops/incidents" className="card flex items-center gap-3"><AlertTriangle className="w-5 h-5 text-danger"/><div className="flex-1"><p className="font-semibold text-sm">Incidents</p><p className="text-xs text-gray-500">Breakdowns, accidents and risk</p></div></Link>
      <Link to="/ops/work-orders" className="card flex items-center gap-3"><MapPinned className="w-5 h-5 text-brand"/><div className="flex-1"><p className="font-semibold text-sm">Work Orders</p><p className="text-xs text-gray-500">Dispatch and close operational work</p></div></Link>
    </div>
  </div>;
}
