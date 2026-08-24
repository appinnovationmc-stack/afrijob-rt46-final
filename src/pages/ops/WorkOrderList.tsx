import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Wrench } from 'lucide-react';
import { useWorkOrders, WORK_ORDER_CATEGORY_LABELS, WORK_ORDER_PRIORITY_META, WORK_ORDER_SOURCE_LABELS } from '@/hooks/useWorkOrders';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { EnumStatusChip, WORK_ORDER_STATUS_STYLES, WORK_ORDER_STATUS_LABELS } from '@/components/ui/StatusChip';
import { cn, formatDate, formatCurrencyZAR } from '@/lib/utils';
import type { Enums } from '@/types/database.types';

type WorkOrderStatus = Enums<'work_order_generic_status'>;

const STATUS_FILTERS: (WorkOrderStatus | 'all')[] = [
  'all', 'pending', 'assigned', 'in_progress', 'awaiting_parts', 'awaiting_approval', 'completed', 'cancelled', 'disputed', 'draft',
];

export default function WorkOrderList() {
  const [filter, setFilter] = useState<WorkOrderStatus | 'all'>('all');
  const { data: workOrders, isLoading } = useWorkOrders(filter === 'all' ? undefined : filter);

  return (
    <div className="px-4 pt-6 pb-24">
      <h1 className="font-heading font-bold text-2xl mb-1">Work Orders</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Every work order across AfriJob, RT46, and Ops in one place.
      </p>

      <div className="flex gap-1 overflow-x-auto mb-4 -mx-4 px-4">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap shrink-0 transition-colors',
              filter === s ? 'bg-brand text-white' : 'bg-gray-100 dark:bg-charcoal-light text-gray-600 dark:text-gray-300'
            )}
          >
            {s === 'all' ? 'All' : WORK_ORDER_STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <SkeletonCard key={i} />)}</div>
      ) : !workOrders?.length ? (
        <EmptyState icon={Wrench} title="No work orders" description="Nothing matches this filter yet." />
      ) : (
        <div className="space-y-2">
          {workOrders.map((w) => {
            const priorityMeta = WORK_ORDER_PRIORITY_META[w.priority];
            const assetLabel = w.asset ? [w.asset.manufacturer, w.asset.model].filter(Boolean).join(' ') || w.asset.asset_number : null;
            return (
              <Link key={w.id} to={`/ops/work-orders/${w.id}`} className="card !py-3 block">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="font-medium text-sm flex-1">{w.description || WORK_ORDER_CATEGORY_LABELS[w.category]}</p>
                  <EnumStatusChip status={w.status} styles={WORK_ORDER_STATUS_STYLES} labels={WORK_ORDER_STATUS_LABELS} />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {WORK_ORDER_SOURCE_LABELS[w.source_system] ?? w.source_system} · {WORK_ORDER_CATEGORY_LABELS[w.category]}
                  {assetLabel && <span> · {assetLabel}</span>}
                  {w.site && <span> · {w.site.name}</span>}
                </p>
                <div className="flex items-center justify-between mt-1.5">
                  <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold', priorityMeta.className)}>
                    {priorityMeta.label}
                  </span>
                  <p className="text-xs text-gray-400">
                    {w.actual_cost != null && <span>{formatCurrencyZAR(w.actual_cost)} · </span>}
                    {w.completed_at ? `Completed ${formatDate(w.completed_at)}` : w.due_at ? `Due ${formatDate(w.due_at)}` : formatDate(w.created_at)}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
