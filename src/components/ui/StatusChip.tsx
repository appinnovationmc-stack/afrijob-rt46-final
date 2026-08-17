import { Clock } from 'lucide-react';
import { cn, JOB_STATUS_LABELS } from '@/lib/utils';
import type { Enums } from '@/types/database.types';

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
