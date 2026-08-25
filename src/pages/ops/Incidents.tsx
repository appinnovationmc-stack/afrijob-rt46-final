import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import {
  useIncidents, useCreateIncident, useUpdateIncidentStatus,
  INCIDENT_CATEGORY_LABELS, INCIDENT_SEVERITY_META, INCIDENT_STATUS_META,
} from '@/hooks/useIncidents';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { FAB } from '@/components/ui/FAB';
import { useToastStore } from '@/components/ui/Toast';
import { usePermissions } from '@/hooks/useOrganisation';
import { useAuthStore } from '@/store/authStore';
import { cn, formatDate } from '@/lib/utils';
import type { IncidentCategory, IncidentSeverity, IncidentStatus } from '@/lib/afriops/types';

const CATEGORIES: IncidentCategory[] = ['breakdown', 'safety', 'accident', 'security', 'environmental', 'other'];
const SEVERITIES: IncidentSeverity[] = ['low', 'medium', 'high', 'critical'];
const NEXT_STATUS: Record<IncidentStatus, IncidentStatus | null> = {
  reported: 'investigating',
  investigating: 'resolved',
  resolved: 'closed',
  closed: null,
};

function ReportModal({ onClose }: { onClose: () => void }) {
  const create = useCreateIncident();
  const push = useToastStore((s) => s.push);
  const [category, setCategory] = useState<IncidentCategory>('breakdown');
  const [severity, setSeverity] = useState<IncidentSeverity>('medium');
  const [description, setDescription] = useState('');

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full sm:max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-heading font-bold">Report incident</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Category</p>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCategory(c)}
              className={cn('rounded-xl px-2 py-2 text-xs font-semibold', category === c ? 'bg-brand text-white' : 'bg-gray-100 dark:bg-charcoal-light text-gray-600 dark:text-gray-300')}>
              {INCIDENT_CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>

        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Severity</p>
        <div className="grid grid-cols-4 gap-2 mb-3">
          {SEVERITIES.map((s) => (
            <button key={s} onClick={() => setSeverity(s)}
              className={cn('rounded-xl px-2 py-2 text-xs font-semibold capitalize', severity === s ? 'bg-brand text-white' : 'bg-gray-100 dark:bg-charcoal-light text-gray-600 dark:text-gray-300')}>
              {s}
            </button>
          ))}
        </div>

        <textarea className="input min-h-[90px]" placeholder="What happened?" value={description} onChange={(e) => setDescription(e.target.value)} />

        <button
          className="btn-primary w-full mt-4"
          disabled={!description.trim() || create.isPending}
          onClick={async () => {
            try {
              await create.mutateAsync({ category, severity, description: description.trim() });
              push('Incident reported', 'success');
              onClose();
            } catch (e: any) {
              push(e.message ?? 'Failed to report incident', 'error');
            }
          }}
        >
          Submit report
        </button>
      </div>
    </div>
  );
}

export default function Incidents() {
  const { data: incidents, isLoading } = useIncidents();
  const updateStatus = useUpdateIncidentStatus();
  const push = useToastStore((s) => s.push);
  const [showReport, setShowReport] = useState(false);
  const { can } = usePermissions();
  const userId = useAuthStore((s) => s.user?.id);
  // Mirrors incidents_insert (requires incidents.report) and incidents_update
  // (incidents.manage, OR incidents.report + reporter + still 'reported') so
  // viewer/contractor — the only two roles without incidents.report — don't
  // see a "Report incident" button that would fail against RLS.
  const canReport = can('incidents.report');
  const canManage = can('incidents.manage');

  return (
    <div className="px-4 pt-6 pb-24">
      <h1 className="font-heading font-bold text-2xl mb-1">Incidents</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Breakdowns, safety, accident, security and environmental incidents.</p>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <SkeletonCard key={i} />)}</div>
      ) : !incidents?.length ? (
        <EmptyState icon={AlertTriangle} title="No incidents reported" description="Report an incident to start tracking it." />
      ) : (
        <div className="space-y-3">
          {incidents.map((inc) => {
            const sevMeta = INCIDENT_SEVERITY_META[inc.severity];
            const statusMeta = INCIDENT_STATUS_META[inc.status];
            const next = NEXT_STATUS[inc.status];
            return (
              <div key={inc.id} className="card">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-sm">{INCIDENT_CATEGORY_LABELS[inc.category]}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(inc.occurred_at)}</p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold', sevMeta.className)}>{sevMeta.label}</span>
                    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold', statusMeta.className)}>{statusMeta.label}</span>
                  </div>
                </div>
                <p className="text-sm mb-3">{inc.description}</p>
                {next && (canManage || (canReport && inc.reported_by === userId && inc.status === 'reported')) && (
                  <button
                    className="btn-secondary w-full text-sm !py-2"
                    disabled={updateStatus.isPending}
                    onClick={async () => {
                      try {
                        await updateStatus.mutateAsync({ incidentId: inc.id, status: next });
                        push(`Marked as ${INCIDENT_STATUS_META[next].label.toLowerCase()}`, 'success');
                      } catch (e: any) {
                        push(e.message ?? 'Failed to update status', 'error');
                      }
                    }}
                  >
                    Mark as {INCIDENT_STATUS_META[next].label}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {canReport && <FAB onClick={() => setShowReport(true)} label="Report incident" />}
      {showReport && <ReportModal onClose={() => setShowReport(false)} />}
    </div>
  );
}
