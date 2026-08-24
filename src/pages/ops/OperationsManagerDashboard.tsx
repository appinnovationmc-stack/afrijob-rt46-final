import { Link } from 'react-router-dom';
import { ClipboardList, CalendarClock, AlertTriangle, ShoppingCart, ArrowRight, type LucideIcon } from 'lucide-react';
import { useWorkOrders, WORK_ORDER_PRIORITY_META } from '@/hooks/useWorkOrders';
import { useDueMaintenanceSchedules } from '@/hooks/useMaintenanceSchedules';
import { useIncidents } from '@/hooks/useIncidents';
import { usePurchaseOrders, PO_STATUS_META } from '@/hooks/useAfriops';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDate, cn } from '@/lib/utils';

// An Operations Manager's job is triage: what needs a decision or an
// assignment right now, across every module, ranked by urgency. This is
// deliberately NOT the same shape as OpsDashboard's KPI-tiles-plus-module-nav
// (that's still available via the module list) or Technician's single
// personal queue — it's a cross-module action list, each section capped to
// what's actually actionable (unassigned/overdue/open/pending-approval),
// not a full history dump.
export default function OperationsManagerDashboard() {
  const { data: allWorkOrders, isLoading: woLoading } = useWorkOrders();
  const { data: dueSchedules, isLoading: dueLoading } = useDueMaintenanceSchedules();
  const { data: openIncidents, isLoading: incidentsLoading } = useIncidents('reported');
  const { data: purchaseOrders, isLoading: poLoading } = usePurchaseOrders();

  const unassigned = (allWorkOrders ?? []).filter((w) => w.status === 'pending' || w.status === 'draft');
  const overdueMaintenance = (dueSchedules ?? []).filter((s) => s.next_due_at && new Date(s.next_due_at) < new Date());
  const posAwaitingApproval = (purchaseOrders ?? []).filter((po) => po.status === 'submitted');

  const isLoading = woLoading || dueLoading || incidentsLoading || poLoading;

  return (
    <div className="px-4 pt-6 pb-6">
      <div className="mb-6">
        <p className="text-gray-500 dark:text-gray-400 text-sm flex items-center gap-1.5">
          <ClipboardList className="w-4 h-4" /> Operations Manager
        </p>
        <h1 className="font-heading font-bold text-2xl">Needs Attention</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className={cn('card !py-3', unassigned.length > 0 && 'border-danger/40')}>
          <p className="text-xs text-gray-500 dark:text-gray-400">Unassigned work</p>
          <p className={cn('font-heading font-bold text-lg', unassigned.length > 0 && 'text-danger')}>{unassigned.length}</p>
        </div>
        <div className={cn('card !py-3', overdueMaintenance.length > 0 && 'border-danger/40')}>
          <p className="text-xs text-gray-500 dark:text-gray-400">Overdue maintenance</p>
          <p className={cn('font-heading font-bold text-lg', overdueMaintenance.length > 0 && 'text-danger')}>{overdueMaintenance.length}</p>
        </div>
        <div className={cn('card !py-3', (openIncidents?.length ?? 0) > 0 && 'border-danger/40')}>
          <p className="text-xs text-gray-500 dark:text-gray-400">Open incidents</p>
          <p className={cn('font-heading font-bold text-lg', (openIncidents?.length ?? 0) > 0 && 'text-danger')}>{openIncidents?.length ?? 0}</p>
        </div>
        <div className={cn('card !py-3', posAwaitingApproval.length > 0 && 'border-warning/40')}>
          <p className="text-xs text-gray-500 dark:text-gray-400">POs awaiting approval</p>
          <p className={cn('font-heading font-bold text-lg', posAwaitingApproval.length > 0 && 'text-warning')}>{posAwaitingApproval.length}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
      ) : (
        <>
          <QueueSection
            title="Unassigned work orders"
            icon={ClipboardList}
            emptyText="Nothing waiting on assignment."
            viewAllHref="/ops/work-orders"
          >
            {unassigned.slice(0, 5).map((w) => (
              <Link key={w.id} to={`/ops/work-orders/${w.id}`} className="card !py-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{w.description || w.category}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{WORK_ORDER_PRIORITY_META[w.priority].label} priority · {formatDate(w.created_at)}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 shrink-0" />
              </Link>
            ))}
          </QueueSection>

          <QueueSection
            title="Overdue maintenance"
            icon={CalendarClock}
            emptyText="No preventive maintenance is overdue."
            viewAllHref="/ops/maintenance"
          >
            {overdueMaintenance.slice(0, 5).map((s) => (
              <div key={s.id} className="card !py-3">
                <p className="font-medium text-sm">{s.name}</p>
                <p className="text-xs text-danger">Due {formatDate(s.next_due_at)}</p>
              </div>
            ))}
          </QueueSection>

          <QueueSection
            title="Open incidents"
            icon={AlertTriangle}
            emptyText="No incidents currently open."
            viewAllHref="/ops/incidents"
          >
            {(openIncidents ?? []).slice(0, 5).map((i) => (
              <div key={i.id} className="card !py-3">
                <p className="font-medium text-sm">{i.category}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{i.severity} severity · {formatDate(i.occurred_at)}</p>
              </div>
            ))}
          </QueueSection>

          <QueueSection
            title="Purchase orders awaiting approval"
            icon={ShoppingCart}
            emptyText="Nothing waiting on approval."
            viewAllHref="/ops/procurement"
          >
            {posAwaitingApproval.slice(0, 5).map((po) => {
              const meta = PO_STATUS_META[po.status];
              return (
                <Link key={po.id} to="/ops/procurement" className="card !py-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">PO {po.id.slice(0, 8)}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(po.created_at)}</p>
                  </div>
                  <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase shrink-0', meta.className)}>{meta.label}</span>
                </Link>
              );
            })}
          </QueueSection>
        </>
      )}
    </div>
  );
}

function QueueSection({
  title, icon: Icon, emptyText, viewAllHref, children,
}: {
  title: string; icon: LucideIcon; emptyText: string; viewAllHref: string; children: React.ReactNode;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2 px-1">
        <h2 className="font-heading font-bold text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide">{title}</h2>
        <Link to={viewAllHref} className="text-xs text-brand font-medium">View all</Link>
      </div>
      {hasChildren ? (
        <div className="space-y-2">{children}</div>
      ) : (
        <EmptyState icon={Icon} title="All clear" description={emptyText} />
      )}
    </div>
  );
}
