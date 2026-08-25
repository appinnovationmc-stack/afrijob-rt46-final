import { LineChart, Truck, Wrench, AlertTriangle, Users, DollarSign, Shield } from 'lucide-react';
import { useAssets } from '@/hooks/useAssetRegistry';
import { useWorkOrders } from '@/hooks/useWorkOrders';
import { useIncidents } from '@/hooks/useIncidents';
import { useOrgMembers } from '@/hooks/useTeam';
import { useOrganisation, INDUSTRY_LABELS } from '@/hooks/useOrganisation';
import { AdminLinksSection } from '@/components/layout/AdminLinksSection';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/utils';

// An executive wants fleet-wide health at a glance: how much is operating,
// how much work is in flight, incident rate, headcount. NOT a cost/spend
// dashboard — checked live against production first: work_orders.actual_cost
// is a real column but is 0-of-10 populated (nothing in the codebase writes
// to it), and work_order_parts_unified has zero rows in production right
// now. Showing "R0 total spend" from that would look like a real, good
// number rather than what it actually is: no cost data has been recorded
// yet. So the cost section says that honestly instead of rendering a
// confident zero.
export default function ExecutiveDashboard() {
  const { data: org } = useOrganisation();
  const { data: assets, isLoading: assetsLoading, isError: assetsError } = useAssets();
  const { data: workOrders, isLoading: woLoading, isError: woError } = useWorkOrders();
  const { data: incidents, isLoading: incidentsLoading, isError: incidentsError } = useIncidents();
  const { data: members, isLoading: membersLoading, isError: membersError } = useOrgMembers();

  const isLoading = assetsLoading || woLoading || incidentsLoading || membersLoading;
  const openWorkOrders = (workOrders ?? []).filter((w) => w.status !== 'completed' && w.status !== 'cancelled');
  const completedThisPeriod = (workOrders ?? []).filter((w) => w.status === 'completed');
  const openIncidents = (incidents ?? []).filter((i) => i.status !== 'resolved' && i.status !== 'closed');
  const activeAssets = (assets ?? []).filter((a) => a.status === 'active');

  if (isLoading) {
    return <div className="px-4 pt-6 pb-6 space-y-2"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>;
  }

  return (
    <div className="px-4 pt-6 pb-6">
      <div className="mb-6">
        <p className="text-gray-500 dark:text-gray-400 text-sm flex items-center gap-1.5">
          <LineChart className="w-4 h-4" /> Executive
        </p>
        <h1 className="font-heading font-bold text-2xl">{org?.organisation_name ?? 'Organisation'}</h1>
        {org?.industry_mode && (
          <p className="text-xs text-gray-400 mt-0.5">{INDUSTRY_LABELS[org.industry_mode] ?? org.industry_mode}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <Tile icon={Truck} label="Assets" value={assetsError ? null : (assets?.length ?? 0)} sub={`${activeAssets.length} active`} />
        <Tile icon={Wrench} label="Open work orders" value={woError ? null : openWorkOrders.length} sub={`${completedThisPeriod.length} completed`} />
        <Tile icon={AlertTriangle} label="Open incidents" value={incidentsError ? null : openIncidents.length} danger={openIncidents.length > 0} />
        <Tile icon={Users} label="Team members" value={membersError ? null : (members?.length ?? 0)} />
      </div>

      <div className="card !py-4 mb-3">
        <div className="flex items-center gap-2 mb-1">
          <DollarSign className="w-4 h-4 text-gray-400" />
          <h2 className="font-heading font-bold text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide">Cost & Spend</h2>
        </div>
        <EmptyState
          icon={DollarSign}
          title="No cost data recorded yet"
          description="Work order and parts costs aren't being captured in production yet, so spend figures aren't shown here rather than displaying an inaccurate zero. This fills in automatically once cost data starts flowing through work orders and purchase orders."
        />
      </div>

      {/* 'owner' outranks 'admin' but previously had no in-app path to
          Team/Billing/Settings/Permissions/etc — those links only lived
          on OrgAdminDashboard, which owners never render. Same shared
          section as that dashboard, so an owner can actually administer
          the org without knowing a URL to type. */}
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="w-4 h-4 text-gray-400" />
          <h2 className="font-heading font-bold text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide">Organisation Administration</h2>
        </div>
        <AdminLinksSection />
      </div>
    </div>
  );
}

function Tile({
  icon: Icon, label, value, sub, danger,
}: {
  icon: React.ComponentType<{ className?: string }>; label: string; value: number | null; sub?: string; danger?: boolean;
}) {
  const failed = value === null;
  return (
    <div className={cn('card !py-3', danger && 'border-danger/40')}>
      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon className="w-3.5 h-3.5 text-gray-400" />
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      </div>
      <p
        className={cn('font-heading font-bold text-lg', danger && !failed && 'text-danger', failed && 'text-gray-400')}
        title={failed ? 'Could not load this figure' : undefined}
      >
        {failed ? '—' : value}
      </p>
      {sub && !failed && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}
