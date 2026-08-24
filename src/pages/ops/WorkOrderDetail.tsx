import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Wrench, Boxes } from 'lucide-react';
import {
  useWorkOrder, useUpdateWorkOrderStatus,
  WORK_ORDER_CATEGORY_LABELS, WORK_ORDER_PRIORITY_META, WORK_ORDER_SOURCE_LABELS, WORK_ORDER_NEXT_STATUS,
} from '@/hooks/useWorkOrders';
import { useWorkOrderParts } from '@/hooks/useWorkOrderParts';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToastStore } from '@/components/ui/Toast';
import { EnumStatusChip, WORK_ORDER_STATUS_STYLES, WORK_ORDER_STATUS_LABELS } from '@/components/ui/StatusChip';
import { cn, formatDate, formatCurrencyZAR } from '@/lib/utils';

// Same Job/Inventory source split already used on Asset 360's Parts tab —
// work_order_parts_unified rows carry `source` = 'job_parts' (workshop
// Parts & Labour form) or 'inventory_movements' (issued from Ops Inventory
// against this work order). Read-only here: editing parts still happens
// from whichever system recorded them, not from this generic view.
const PART_SOURCE_LABELS: Record<string, string> = { job_parts: 'Job', inventory_movements: 'Inventory' };

function Row({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex justify-between py-1 border-b border-gray-100 dark:border-charcoal-light last:border-0">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className={cn('font-medium text-right', mono && 'font-mono text-xs')}>{value}</span>
    </div>
  );
}

export default function WorkOrderDetail() {
  const { workOrderId } = useParams<{ workOrderId: string }>();
  const { data: wo, isLoading } = useWorkOrder(workOrderId);
  const { data: parts } = useWorkOrderParts(workOrderId);
  const updateStatus = useUpdateWorkOrderStatus();
  const push = useToastStore((s) => s.push);

  if (isLoading) {
    return (
      <div className="px-4 pt-6 pb-24">
        <SkeletonCard /><SkeletonCard />
      </div>
    );
  }

  if (!wo) {
    return (
      <div className="px-4 pt-6 pb-24">
        <EmptyState icon={Wrench} title="Work order not found" description="This may have been removed, or you don't have access to it." />
      </div>
    );
  }

  const assetLabel = wo.asset ? [wo.asset.manufacturer, wo.asset.model].filter(Boolean).join(' ') || wo.asset.asset_number : null;
  const priorityMeta = WORK_ORDER_PRIORITY_META[wo.priority];
  const next = WORK_ORDER_NEXT_STATUS[wo.status];
  const partsTotal = (parts ?? []).reduce((sum: number, p: any) => sum + (p.line_total ?? 0), 0);

  return (
    <div className="px-4 pt-6 pb-24">
      <Link to="/ops/work-orders" className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 mb-3">
        <ArrowLeft className="w-4 h-4" /> Work Orders
      </Link>

      <div className="flex items-start justify-between gap-2 mb-1">
        <h1 className="font-heading font-bold text-xl flex-1">{wo.description || WORK_ORDER_CATEGORY_LABELS[wo.category]}</h1>
        <EnumStatusChip status={wo.status} styles={WORK_ORDER_STATUS_STYLES} labels={WORK_ORDER_STATUS_LABELS} />
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        {WORK_ORDER_SOURCE_LABELS[wo.source_system] ?? wo.source_system} · {WORK_ORDER_CATEGORY_LABELS[wo.category]}
      </p>

      <div className="flex items-center gap-2 mb-4">
        <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold', priorityMeta.className)}>
          {priorityMeta.label} priority
        </span>
        {wo.actual_cost != null && (
          <span className="text-sm font-semibold">{formatCurrencyZAR(wo.actual_cost)}</span>
        )}
      </div>

      {next && (
        <button
          className="btn-primary w-full text-sm !py-2.5 mb-4"
          disabled={updateStatus.isPending}
          onClick={async () => {
            try {
              await updateStatus.mutateAsync({ id: wo.id, status: next });
              push(`Marked as ${WORK_ORDER_STATUS_LABELS[next].toLowerCase()}`, 'success');
            } catch (e: any) {
              push(e.message ?? 'Failed to update status', 'error');
            }
          }}
        >
          Mark as {WORK_ORDER_STATUS_LABELS[next]}
        </button>
      )}

      <div className="card mb-4">
        <h2 className="font-heading font-bold text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Details</h2>
        {assetLabel && <Row label="Asset" value={assetLabel} />}
        <Row label="Site" value={wo.site?.name} />
        <Row label="Assignee" value={wo.assignee?.full_name} />
        <Row label="Requester" value={wo.requester?.full_name} />
        <Row label="Service provider" value={wo.service_provider?.trading_name} />
        <Row label="Estimated value" value={wo.estimated_value != null ? formatCurrencyZAR(wo.estimated_value) : null} />
        <Row label="Due" value={wo.due_at ? formatDate(wo.due_at) : null} />
        <Row label="Completed" value={wo.completed_at ? formatDate(wo.completed_at) : null} />
        <Row label="Logged" value={formatDate(wo.created_at)} />
      </div>

      <h2 className="font-heading font-bold text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 px-1">Parts</h2>
      {!parts?.length ? (
        <EmptyState icon={Boxes} title="No parts logged" description="No parts have been recorded against this work order yet." />
      ) : (
        <div className="card space-y-2">
          {parts.map((p: any) => (
            <div key={p.id} className="flex items-center justify-between text-sm">
              <div>
                <p className="font-medium">{p.description}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {PART_SOURCE_LABELS[p.source] ?? p.source} · {p.quantity} × {p.unit_cost != null ? formatCurrencyZAR(p.unit_cost) : '—'} · {formatDate(p.created_at)}
                </p>
              </div>
              <p className="font-semibold">{p.line_total != null ? formatCurrencyZAR(p.line_total) : '—'}</p>
            </div>
          ))}
          <hr className="border-gray-100 dark:border-gray-800 my-1" />
          <div className="flex items-center justify-between text-sm font-semibold">
            <span>Parts total</span>
            <span>{formatCurrencyZAR(partsTotal)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
