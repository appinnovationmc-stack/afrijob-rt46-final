import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Wrench, Boxes, Timer, FileText, AlertTriangle, History, ClipboardCheck } from 'lucide-react';
import {
  useWorkOrder, useUpdateWorkOrderStatus, useAssignWorkOrder, useSetWorkOrderPriority, useWorkOrderSlaBreaches, useWorkOrderIncidents,
  WORK_ORDER_CATEGORY_LABELS, WORK_ORDER_PRIORITY_META, WORK_ORDER_SOURCE_LABELS, WORK_ORDER_NEXT_STATUS,
} from '@/hooks/useWorkOrders';
import { useOrgMembers } from '@/hooks/useTeam';
import { useWorkOrderParts } from '@/hooks/useWorkOrderParts';
import { useVaultDocuments } from '@/hooks/useAfriops';
import { useAuditLog, AUDIT_ACTION_LABELS } from '@/hooks/useAuditLog';
import { ComplianceStatusChip } from '@/components/ui/StatusChip';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToastStore } from '@/components/ui/Toast';
import { EnumStatusChip, WORK_ORDER_STATUS_STYLES, WORK_ORDER_STATUS_LABELS } from '@/components/ui/StatusChip';
import { cn, formatDate, formatCurrencyZAR } from '@/lib/utils';

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
  const { data: slaBreaches } = useWorkOrderSlaBreaches(workOrderId);
  const { data: incidents } = useWorkOrderIncidents(workOrderId);
  const { data: documents } = useVaultDocuments('work_order', workOrderId);
  const { data: auditLog } = useAuditLog({ entityType: 'work_order', entityId: workOrderId }, 0);
  const { data: orgMembers } = useOrgMembers();
  const updateStatus = useUpdateWorkOrderStatus();
  const assignWorkOrder = useAssignWorkOrder();
  const setPriority = useSetWorkOrderPriority();
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

  // Generic Ops inspection workflow (RT46 has its own quality module).
  // Shown when the work order is an inspection category, or is waiting for
  // approval after field work. Pass → completed; Fail → back to in_progress (rework).
  const showInspection =
    wo.category === 'inspection' ||
    wo.status === 'awaiting_approval' ||
    (wo.status === 'in_progress' && wo.category === 'inspection');
  const canInspect =
    showInspection &&
    (wo.status === 'in_progress' || wo.status === 'awaiting_approval' || wo.status === 'assigned');

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
        <select
          className={cn('rounded-full pl-2.5 pr-6 py-1 text-xs font-semibold border-0 appearance-none', priorityMeta.className)}
          value={wo.priority}
          disabled={setPriority.isPending}
          onChange={async (e) => {
            const priority = e.target.value as typeof wo.priority;
            try {
              await setPriority.mutateAsync({ id: wo.id, priority });
              push('Priority updated', 'success');
            } catch (err: any) {
              push(err.message ?? 'Failed to update priority', 'error');
            }
          }}
        >
          {Object.entries(WORK_ORDER_PRIORITY_META).map(([value, meta]) => (
            <option key={value} value={value}>{meta.label} priority</option>
          ))}
        </select>
        {wo.actual_cost != null && (
          <span className="text-sm font-semibold">{formatCurrencyZAR(wo.actual_cost)}</span>
        )}
      </div>

      {canInspect && (
        <div className="card mb-4 border-brand/30">
          <div className="flex items-center gap-2 mb-2">
            <ClipboardCheck className="w-4 h-4 text-brand" />
            <h2 className="font-heading font-bold text-sm">Inspection outcome</h2>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Record pass to complete this work order, or fail to send it back for rework.
          </p>
          <div className="flex gap-2">
            <button
              className="btn-primary flex-1 text-sm !py-2.5"
              disabled={updateStatus.isPending}
              onClick={async () => {
                try {
                  await updateStatus.mutateAsync({ id: wo.id, status: 'completed' });
                  push('Inspection passed — work order completed', 'success');
                } catch (e: any) {
                  push(e.message ?? 'Failed to record pass', 'error');
                }
              }}
            >
              Pass
            </button>
            <button
              className="btn-secondary flex-1 text-sm !py-2.5 border-danger/40 text-danger"
              disabled={updateStatus.isPending}
              onClick={async () => {
                try {
                  await updateStatus.mutateAsync({ id: wo.id, status: 'in_progress' });
                  push('Inspection failed — returned for rework', 'success');
                } catch (e: any) {
                  push(e.message ?? 'Failed to record fail', 'error');
                }
              }}
            >
              Fail / Rework
            </button>
          </div>
        </div>
      )}

      {next && !canInspect && (
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
        <div className="flex justify-between items-center py-1 border-b border-gray-100 dark:border-charcoal-light last:border-0 gap-2">
          <span className="text-gray-500 dark:text-gray-400">Assignee</span>
          <select
            className="input !py-1 !h-auto text-sm text-right max-w-[60%]"
            value={wo.assignee?.id ?? ''}
            disabled={assignWorkOrder.isPending}
            onChange={async (e) => {
              const assigneeProfileId = e.target.value || null;
              try {
                await assignWorkOrder.mutateAsync({ id: wo.id, assigneeProfileId, currentStatus: wo.status });
                push(assigneeProfileId ? 'Assignee updated' : 'Unassigned', 'success');
              } catch (err: any) {
                push(err.message ?? 'Failed to update assignee', 'error');
              }
            }}
          >
            <option value="">Unassigned</option>
            {orgMembers?.map((m) => (
              <option key={m.profile_id} value={m.profile_id}>{m.profile_name ?? 'Unnamed'}</option>
            ))}
          </select>
        </div>
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

      <h2 className="font-heading font-bold text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 px-1 mt-4">SLA</h2>
      {!slaBreaches?.length ? (
        <EmptyState icon={Timer} title="No SLA breaches" description="This work order has not breached any SLA target." />
      ) : (
        <div className="space-y-2">
          {slaBreaches.map((b) => (
            <div key={b.id} className={cn('card !py-3', !b.acknowledged_at && 'border-danger/40')}>
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="font-medium text-sm flex-1 capitalize">{b.metric} breach</p>
                {!b.acknowledged_at && <span className="text-xs font-semibold text-danger">Unacknowledged</span>}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{b.minutes_over} min over target · Breached {formatDate(b.breached_at)}</p>
            </div>
          ))}
        </div>
      )}

      <h2 className="font-heading font-bold text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 px-1 mt-4">Linked Incidents</h2>
      {!incidents?.length ? (
        <EmptyState icon={AlertTriangle} title="No linked incidents" description="No incidents have been linked to this work order." />
      ) : (
        <div className="space-y-2">
          {incidents.map((i) => (
            <div key={i.id} className="card !py-3">
              <p className="font-medium text-sm">{i.category}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{i.severity} severity · {i.status} · {formatDate(i.occurred_at)}</p>
            </div>
          ))}
        </div>
      )}

      <h2 className="font-heading font-bold text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 px-1 mt-4">Documents</h2>
      {!documents?.length ? (
        <EmptyState icon={FileText} title="No documents" description="No documents have been attached to this work order." />
      ) : (
        <div className="space-y-2">
          {documents.map((d) => (
            <div key={d.id} className="card !py-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{d.doc_type}</p>
                {d.expiry_date && <p className="text-xs text-gray-500 dark:text-gray-400">Expires {formatDate(d.expiry_date)}</p>}
              </div>
              <ComplianceStatusChip status={d.status} />
            </div>
          ))}
        </div>
      )}

      <h2 className="font-heading font-bold text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 px-1 mt-4">Audit History</h2>
      {!auditLog?.entries.length ? (
        <EmptyState icon={History} title="No audit history" description="No changes have been recorded against this work order." />
      ) : (
        <div className="space-y-2">
          {auditLog.entries.map((entry) => (
            <div key={entry.id} className="card !py-3">
              <p className="font-medium text-sm">{AUDIT_ACTION_LABELS[entry.action] ?? entry.action}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{entry.actor?.full_name ?? 'System'} · {formatDate(entry.created_at)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
