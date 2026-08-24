import { useState } from 'react';
import { History, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  useAuditLog,
  useAuditLogEntityTypes,
  useAuditLogActors,
  AUDIT_ACTION_LABELS,
  AUDIT_ENTITY_LABELS,
  AUDIT_SEVERITY_LABELS,
  type AuditLogFilters,
  type AuditSeverity,
} from '@/hooks/useAuditLog';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDate } from '@/lib/utils';

// Renders whichever of before_data/after_data changed as compact key:
// old → new pairs. Falls back to showing after_data alone for create-only
// events (before_data is null on 'created'/'uploaded'/etc.).
function ChangeSummary({ before, after }: { before: unknown; after: unknown }) {
  const b = (before ?? {}) as Record<string, unknown>;
  const a = (after ?? {}) as Record<string, unknown>;
  const keys = Array.from(new Set([...Object.keys(b), ...Object.keys(a)]));
  if (!keys.length) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
      {keys.map((k) => {
        const bv = b[k];
        const av = a[k];
        if (bv === undefined && av === undefined) return null;
        return (
          <span key={k}>
            <span className="font-medium">{k}:</span>{' '}
            {bv !== undefined && bv !== null ? <span className="line-through opacity-70">{String(bv)}</span> : null}
            {bv !== undefined && av !== undefined ? ' → ' : ''}
            {av !== undefined && av !== null ? <span>{String(av)}</span> : null}
          </span>
        );
      })}
    </div>
  );
}

const SEVERITY_STYLES: Record<AuditSeverity, string> = {
  info: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

function SeverityBadge({ severity }: { severity: AuditSeverity }) {
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${SEVERITY_STYLES[severity]}`}>
      {AUDIT_SEVERITY_LABELS[severity]}
    </span>
  );
}

export default function AuditLog() {
  const [filters, setFilters] = useState<AuditLogFilters>({});
  const [page, setPage] = useState(0);
  const { data: entityTypes } = useAuditLogEntityTypes();
  const { data: actors } = useAuditLogActors();
  const { data, isLoading } = useAuditLog(filters, page);

  const setFilter = (patch: Partial<AuditLogFilters>) => {
    setPage(0);
    setFilters((f) => ({ ...f, ...patch }));
  };

  return (
    <div className="px-4 pt-6 pb-24">
      <h1 className="font-heading font-bold text-2xl mb-1">Audit Log</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Every recorded change across assets, work orders, incidents, procurement, documents, SLA, inventory, maintenance and team membership.
      </p>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <select
          className="input text-sm"
          value={filters.entityType ?? ''}
          onChange={(e) => setFilter({ entityType: e.target.value || undefined })}
        >
          <option value="">All entity types</option>
          {(entityTypes ?? []).map((t) => (
            <option key={t} value={t}>{AUDIT_ENTITY_LABELS[t] ?? t}</option>
          ))}
        </select>
        <select
          className="input text-sm"
          value={filters.action ?? ''}
          onChange={(e) => setFilter({ action: e.target.value || undefined })}
        >
          <option value="">All actions</option>
          {Object.entries(AUDIT_ACTION_LABELS).map(([code, label]) => (
            <option key={code} value={code}>{label}</option>
          ))}
        </select>
        <select
          className="input text-sm"
          value={filters.actorProfileId ?? ''}
          onChange={(e) => setFilter({ actorProfileId: e.target.value || undefined })}
        >
          <option value="">All actors</option>
          {(actors ?? []).map((a) => (
            <option key={a.id} value={a.id}>{a.full_name ?? 'Unnamed user'}</option>
          ))}
        </select>
        <select
          className="input text-sm"
          value={filters.severity ?? ''}
          onChange={(e) => setFilter({ severity: (e.target.value || undefined) as AuditSeverity | undefined })}
        >
          <option value="">All severities</option>
          {(Object.entries(AUDIT_SEVERITY_LABELS) as [AuditSeverity, string][]).map(([code, label]) => (
            <option key={code} value={code}>{label}</option>
          ))}
        </select>
        <input
          type="date"
          className="input text-sm"
          value={filters.dateFrom?.slice(0, 10) ?? ''}
          onChange={(e) => setFilter({ dateFrom: e.target.value ? `${e.target.value}T00:00:00Z` : undefined })}
        />
        <input
          type="date"
          className="input text-sm"
          value={filters.dateTo?.slice(0, 10) ?? ''}
          onChange={(e) => setFilter({ dateTo: e.target.value ? `${e.target.value}T23:59:59Z` : undefined })}
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}</div>
      ) : !data?.entries.length ? (
        <EmptyState icon={History} title="No audit entries" description="Nothing matches these filters yet." />
      ) : (
        <>
          <div className="space-y-2">
            {data.entries.map((e) => (
              <div key={e.id} className="card !py-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium flex items-center gap-1.5 flex-wrap">
                    {AUDIT_ENTITY_LABELS[e.entity_type] ?? e.entity_type} · {AUDIT_ACTION_LABELS[e.action] ?? e.action}
                    <SeverityBadge severity={e.severity} />
                  </p>
                  <p className="text-xs text-gray-400 whitespace-nowrap">{formatDate(e.created_at)}</p>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {e.actor?.full_name ?? 'System'}
                </p>
                <ChangeSummary before={e.before_data} after={e.after_data} />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-4">
            <button
              className="btn-secondary text-sm !py-1.5 !px-3 inline-flex items-center gap-1 disabled:opacity-40"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeft className="w-4 h-4" /> Newer
            </button>
            <span className="text-xs text-gray-400">Page {page + 1}</span>
            <button
              className="btn-secondary text-sm !py-1.5 !px-3 inline-flex items-center gap-1 disabled:opacity-40"
              disabled={!data.hasMore}
              onClick={() => setPage((p) => p + 1)}
            >
              Older <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
