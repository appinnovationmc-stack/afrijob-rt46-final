import { Clock } from 'lucide-react';
import { cn, JOB_STATUS_LABELS } from '@/lib/utils';
import type { Enums } from '@/types/database.types';
import type { IncidentStatus } from '@/lib/afriops/types';

export function PendingSyncBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold bg-warning/15 text-warning whitespace-nowrap">
      <Clock className="w-3 h-3" />
      Pending sync
    </span>
  );
}

const STATUS_STYLES: Record<Enums<'job_status'>, string> = {
  draft: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  in_progress: 'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-200',
  waiting_for_parts: 'bg-warning/15 text-warning',
  completed: 'bg-success/15 text-success',
  submitted: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200',
  paid: 'bg-success text-white',
};

export function StatusChip({ status }: { status: Enums<'job_status'> }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
        STATUS_STYLES[status]
      )}
    >
      {JOB_STATUS_LABELS[status]}
    </span>
  );
}

const COMPLIANCE_STYLES: Record<string, string> = {
  valid: 'bg-success/15 text-success',
  expiring_soon: 'bg-warning/15 text-warning',
  expired: 'bg-danger/15 text-danger',
};

const COMPLIANCE_LABELS: Record<string, string> = {
  valid: 'Valid',
  expiring_soon: 'Expiring Soon',
  expired: 'Expired',
};

export function ComplianceStatusChip({ status }: { status: string }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold', COMPLIANCE_STYLES[status])}>
      {COMPLIANCE_LABELS[status]}
    </span>
  );
}

// Generic chip for any enum-backed status, given a full style/label map for
// that enum. Using Record<TStatus, string> (not Record<string, string>)
// means TypeScript enforces every enum member has a style and a label —
// the previous bug (asset/work-order/incident statuses being rendered
// through ComplianceStatusChip, whose map only knows valid/expiring_soon/
// expired, with zero overlap with any of those enums) can't recur silently
// because a missing key is now a compile error, not a blank chip at runtime.
export function EnumStatusChip<TStatus extends string>({
  status,
  styles,
  labels,
}: {
  status: TStatus;
  styles: Record<TStatus, string>;
  labels: Record<TStatus, string>;
}) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap', styles[status])}>
      {labels[status]}
    </span>
  );
}

export const ASSET_STATUS_STYLES: Record<Enums<'asset_status'>, string> = {
  acquired: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  commissioned: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200',
  active: 'bg-success/15 text-success',
  under_maintenance: 'bg-warning/15 text-warning',
  retired: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  disposed: 'bg-danger/15 text-danger',
};

export const ASSET_STATUS_LABELS: Record<Enums<'asset_status'>, string> = {
  acquired: 'Acquired',
  commissioned: 'Commissioned',
  active: 'Active',
  under_maintenance: 'Under Maintenance',
  retired: 'Retired',
  disposed: 'Disposed',
};

export const WORK_ORDER_STATUS_STYLES: Record<Enums<'work_order_generic_status'>, string> = {
  draft: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  pending: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  assigned: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200',
  in_progress: 'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-200',
  awaiting_parts: 'bg-warning/15 text-warning',
  awaiting_approval: 'bg-warning/15 text-warning',
  completed: 'bg-success/15 text-success',
  cancelled: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
  disputed: 'bg-danger/15 text-danger',
};

export const WORK_ORDER_STATUS_LABELS: Record<Enums<'work_order_generic_status'>, string> = {
  draft: 'Draft',
  pending: 'Pending',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  awaiting_parts: 'Awaiting Parts',
  awaiting_approval: 'Awaiting Approval',
  completed: 'Completed',
  cancelled: 'Cancelled',
  disputed: 'Disputed',
};

export const INCIDENT_STATUS_STYLES: Record<IncidentStatus, string> = {
  reported: 'bg-warning/15 text-warning',
  investigating: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200',
  resolved: 'bg-success/15 text-success',
  closed: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  reported: 'Reported',
  investigating: 'Investigating',
  resolved: 'Resolved',
  closed: 'Closed',
};
