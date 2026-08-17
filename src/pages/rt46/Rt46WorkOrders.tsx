import { useState } from 'react';
import { ClipboardList, ChevronDown, ChevronUp, Download, Play, CheckCircle2, XCircle, Clock, PauseCircle } from 'lucide-react';
import { useWorkOrders, useAllocationLog, useAllocateWorkOrder, useSetAwaitingParts } from '@/hooks/useRt46';
import { WORK_ORDER_STATUS_LABELS, formatCountdown, type WorkOrder } from '@/lib/rt46';
import { useAuthStore } from '@/store/authStore';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToastStore } from '@/components/ui/Toast';
import { cn, formatCurrencyZAR, formatDate } from '@/lib/utils';

const STATUS_STYLES: Record<WorkOrder['status'], string> = {
  pending_allocation: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  allocated: 'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-200',
  accepted: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200',
  in_progress: 'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-200',
  completed: 'bg-success/15 text-success',
  disputed: 'bg-danger/15 text-danger',
  cancelled: 'bg-gray-200 text-gray-500',
};

const FILTERS = [
  { value: undefined, label: 'All' },
  { value: 'pending_allocation', label: 'Pending' },
  { value: 'allocated', label: 'Allocated' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'disputed', label: 'Disputed' },
];

function exportAllocationLogCsv(rows: any[], workOrderId: string) {
  const headers = ['merchant', 'score', 'eligible', 'exclusion_reason', 'capacity_ratio', 'bbbee_weight', 'quality_score', 'region_match', 'was_selected'];
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push([
      `"${(r.merchants?.trading_name ?? r.merchant_id).replace(/"/g, '""')}"`,
      r.score, r.eligible, `"${(r.exclusion_reason ?? '').replace(/"/g, '""')}"`,
      r.capacity_ratio, r.bbbee_weight, r.quality_score, r.region_match, r.was_selected,
    ].join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `allocation-log-${workOrderId}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function AllocationBreakdown({ workOrderId }: { workOrderId: string }) {
  const { data: log, isLoading } = useAllocationLog(workOrderId);

  if (isLoading) return <p className="text-xs text-gray-400 py-2">Loading allocation reasoning…</p>;
  if (!log?.length) return <p className="text-xs text-gray-400 py-2">Not yet allocated — no scoring run.</p>;

  return (
    <div className="pt-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Why this allocation</p>
        <button className="text-xs text-brand font-semibold flex items-center gap-1" onClick={() => exportAllocationLogCsv(log, workOrderId)}>
          <Download className="w-3 h-3" /> Export CSV
        </button>
      </div>
      {log.map((entry) => (
        <div key={entry.id} className={cn('rounded-lg px-3 py-2 text-xs border', entry.was_selected ? 'border-success bg-success/5' : 'border-gray-100 dark:border-gray-800')}>
          <div className="flex items-center justify-between mb-1">
            <span className="font-semibold flex items-center gap-1">
              {entry.was_selected && <CheckCircle2 className="w-3.5 h-3.5 text-success" />}
              {!entry.eligible && <XCircle className="w-3.5 h-3.5 text-gray-400" />}
              {entry.merchants?.trading_name ?? entry.merchant_id}
            </span>
            <span className="font-mono text-gray-500">score {Number(entry.score).toFixed(3)}</span>
          </div>
          {entry.eligible ? (
            <p className="text-gray-500 dark:text-gray-400">
              capacity ratio {Number(entry.capacity_ratio).toFixed(2)} · bbbee weight {Number(entry.bbbee_weight).toFixed(2)} ·
              {' '}quality {Number(entry.quality_score ?? 0).toFixed(2)} · region match {entry.region_match ? 'yes' : 'no'}
            </p>
          ) : (
            <p className="text-danger">Excluded: {entry.exclusion_reason}</p>
          )}
        </div>
      ))}
    </div>
  );
}

export default function Rt46WorkOrders() {
  const [filter, setFilter] = useState<string | undefined>(undefined);
  const [expanded, setExpanded] = useState<string | null>(null);
  const { data: workOrders, isLoading } = useWorkOrders(filter);
  const push = useToastStore((s) => s.push);
  const allocate = useAllocateWorkOrder();
  const setAwaitingParts = useSetAwaitingParts();
  const profile = useAuthStore((s) => s.profile);

  return (
    <div className="px-4 pt-6 pb-6">
      <h1 className="font-heading font-bold text-2xl mb-1">Fair Allocation</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Every allocation is scored transparently on capacity, B-BBEE level, region, and quality performance.
      </p>

      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4 pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.label}
            onClick={() => setFilter(f.value)}
            className={cn(
              'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold',
              filter === f.value ? 'bg-brand text-white' : 'bg-gray-100 dark:bg-charcoal-light text-gray-600 dark:text-gray-300'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <SkeletonCard key={i} />)}</div>
      ) : !workOrders?.length ? (
        <EmptyState icon={ClipboardList} title="No work orders" description="Nothing matches this filter." />
      ) : (
        <div className="space-y-3">
          {workOrders.map((wo) => {
            const isOpen = expanded === wo.id;
            const overdue = wo.due_at && new Date(wo.due_at).getTime() < Date.now() && !['completed', 'cancelled'].includes(wo.status);
            return (
              <div key={wo.id} className="card">
                <button className="w-full flex items-start justify-between text-left" onClick={() => setExpanded(isOpen ? null : wo.id)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold capitalize">{wo.category.replace('_', ' ')}</p>
                      <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold', STATUS_STYLES[wo.status])}>
                        {WORK_ORDER_STATUS_LABELS[wo.status]}
                      </span>
                      {wo.sla_breached && (
                        <span className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold bg-danger/15 text-danger">SLA Breached</span>
                      )}
                      {wo.awaiting_parts && (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold bg-warning/15 text-warning">
                          <PauseCircle className="w-3 h-3" /> Awaiting Parts
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {wo.description || 'No description'} {wo.estimated_value ? `· est. ${formatCurrencyZAR(wo.estimated_value)}` : ''}
                    </p>
                    {wo.due_at && !['completed', 'cancelled'].includes(wo.status) && (
                      <p className={cn('text-xs mt-0.5 flex items-center gap-1', overdue ? 'text-danger font-semibold' : 'text-gray-500')}>
                        <Clock className="w-3 h-3" /> {formatCountdown(wo.due_at)}
                      </p>
                    )}
                  </div>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0 mt-1" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 mt-1" />}
                </button>

                {isOpen && (
                  <>
                    <AllocationBreakdown workOrderId={wo.id} />
                    {wo.status === 'pending_allocation' && (
                      <button
                        className="btn-primary w-full mt-3 text-sm !py-2.5 flex items-center justify-center gap-1.5"
                        disabled={allocate.isPending}
                        onClick={async () => {
                          try {
                            const merchantId = await allocate.mutateAsync(wo.id);
                            push(merchantId ? 'Work order allocated' : 'No eligible merchant found — see audit log', merchantId ? 'success' : 'error');
                          } catch (e: any) {
                            push(e.message ?? 'Allocation failed', 'error');
                          }
                        }}
                      >
                        <Play className="w-4 h-4" /> {allocate.isPending ? 'Running fair allocation…' : 'Run Fair Allocation'}
                      </button>
                    )}
                    <p className="text-[11px] text-gray-400 mt-2">Created {formatDate(wo.created_at)}{wo.allocated_at && ` · Allocated ${formatDate(wo.allocated_at)}`}</p>
                    {['allocated', 'accepted', 'in_progress'].includes(wo.status) && (
                      <button
                        className="btn-secondary w-full mt-2 text-xs !py-2 flex items-center justify-center gap-1.5"
                        disabled={setAwaitingParts.isPending}
                        onClick={async () => {
                          if (!profile?.id) return;
                          try {
                            await setAwaitingParts.mutateAsync({ workOrderId: wo.id, awaiting: !wo.awaiting_parts, actorId: profile.id });
                            push(wo.awaiting_parts ? 'Parts delay ended — SLA clock resumed' : 'Marked awaiting parts — SLA clock paused', 'success');
                          } catch (e: any) {
                            push(e.message ?? 'Failed to update parts-wait status', 'error');
                          }
                        }}
                      >
                        <PauseCircle className="w-3.5 h-3.5" /> {wo.awaiting_parts ? 'Resume — parts received' : 'Mark awaiting parts'}
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
