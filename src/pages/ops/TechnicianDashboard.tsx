import { Link } from 'react-router-dom';
import { Wrench, MapPin, Clock } from 'lucide-react';
import { useMyWorkOrders, WORK_ORDER_PRIORITY_META, WORK_ORDER_SOURCE_LABELS } from '@/hooks/useWorkOrders';
import { EnumStatusChip, WORK_ORDER_STATUS_STYLES, WORK_ORDER_STATUS_LABELS } from '@/components/ui/StatusChip';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuthStore } from '@/store/authStore';
import { formatDate, cn } from '@/lib/utils';

// A technician doesn't need org-wide KPIs (inventory levels, SLA breach
// counts across the whole org, low-stock alerts) — they need to know
// what's assigned to them, right now, in priority/due order. This is a
// genuinely different experience from OpsDashboard, not a filtered copy
// of it: no module nav grid, no admin section, just the queue.
export default function TechnicianDashboard() {
  const profile = useAuthStore((s) => s.profile);
  const { data: workOrders, isLoading } = useMyWorkOrders(profile?.id);

  const overdue = (workOrders ?? []).filter((w) => w.due_at && new Date(w.due_at) < new Date());
  const dueToday = (workOrders ?? []).filter(
    (w) => w.due_at && new Date(w.due_at).toDateString() === new Date().toDateString()
  );

  return (
    <div className="px-4 pt-6 pb-6">
      <div className="mb-6">
        <p className="text-gray-500 dark:text-gray-400 text-sm flex items-center gap-1.5">
          <Wrench className="w-4 h-4" /> My Work
        </p>
        <h1 className="font-heading font-bold text-2xl">
          {profile?.full_name ? `Hi, ${profile.full_name.split(' ')[0]}` : 'Your Queue'}
        </h1>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className={cn('card !py-3', overdue.length > 0 && 'border-danger/40')}>
          <p className="text-xs text-gray-500 dark:text-gray-400">Overdue</p>
          <p className={cn('font-heading font-bold text-lg', overdue.length > 0 ? 'text-danger' : '')}>
            {overdue.length}
          </p>
        </div>
        <div className="card !py-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">Due today</p>
          <p className="font-heading font-bold text-lg">{dueToday.length}</p>
        </div>
      </div>

      <h2 className="font-heading font-bold text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 px-1">
        Assigned to me
      </h2>

      {isLoading ? (
        <div className="space-y-2"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
      ) : (workOrders ?? []).length === 0 ? (
        <EmptyState icon={Wrench} title="Nothing assigned" description="You have no open work orders assigned to you right now." />
      ) : (
        <div className="space-y-2">
          {workOrders!.map((w) => {
            const priorityMeta = WORK_ORDER_PRIORITY_META[w.priority];
            const isOverdue = w.due_at && new Date(w.due_at) < new Date();
            return (
              <Link key={w.id} to={`/ops/work-orders/${w.id}`} className={cn('card !py-3 block', isOverdue && 'border-danger/40')}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="font-medium text-sm flex-1">{w.description || w.category}</p>
                  <EnumStatusChip status={w.status} styles={WORK_ORDER_STATUS_STYLES} labels={WORK_ORDER_STATUS_LABELS} />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase', priorityMeta.className)}>
                    {priorityMeta.label}
                  </span>
                  <span className="text-xs text-gray-400">{WORK_ORDER_SOURCE_LABELS[w.source_system] ?? w.source_system}</span>
                </div>
                {w.asset && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {[w.asset.manufacturer, w.asset.model].filter(Boolean).join(' ') || w.asset.asset_number}
                  </p>
                )}
                {w.due_at && (
                  <p className={cn('text-xs mt-0.5 flex items-center gap-1', isOverdue ? 'text-danger font-medium' : 'text-gray-400')}>
                    <Clock className="w-3 h-3" /> Due {formatDate(w.due_at)}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
