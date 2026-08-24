import { Link } from 'react-router-dom';
import { FolderLock, History, AlertTriangle, type LucideIcon } from 'lucide-react';
import { useExpiringDocuments } from '@/hooks/useAfriops';
import { useAuditLog, AUDIT_ACTION_LABELS } from '@/hooks/useAuditLog';
import { useIncidents } from '@/hooks/useIncidents';
import { ComplianceStatusChip } from '@/components/ui/StatusChip';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDate } from '@/lib/utils';

// Compliance cares about three things: documents going out of date,
// critical-severity events in the audit trail (the ones worth a look
// regardless of module), and high-severity incidents that could carry a
// regulatory or safety obligation. This is a read-heavy oversight view,
// not an action queue like Operations Manager's — compliance mostly
// verifies and escalates rather than executes.
export default function ComplianceDashboard() {
  const { data: expiringDocs, isLoading: docsLoading } = useExpiringDocuments();
  const { data: criticalAudit, isLoading: auditLoading } = useAuditLog({ severity: 'critical' }, 0);
  const { data: incidents, isLoading: incidentsLoading } = useIncidents();

  const highSeverityOpen = (incidents ?? []).filter(
    (i) => (i.severity === 'high' || i.severity === 'critical') && i.status !== 'resolved' && i.status !== 'closed'
  );
  const isLoading = docsLoading || auditLoading || incidentsLoading;

  return (
    <div className="px-4 pt-6 pb-6">
      <div className="mb-6">
        <p className="text-gray-500 dark:text-gray-400 text-sm flex items-center gap-1.5">
          <FolderLock className="w-4 h-4" /> Compliance
        </p>
        <h1 className="font-heading font-bold text-2xl">Oversight</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="card !py-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">Docs expiring/expired</p>
          <p className="font-heading font-bold text-lg">{expiringDocs?.length ?? 0}</p>
        </div>
        <div className="card !py-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">Critical audit events</p>
          <p className="font-heading font-bold text-lg">{criticalAudit?.entries.length ?? 0}</p>
        </div>
        <div className="card !py-3 col-span-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">High-severity open incidents</p>
          <p className="font-heading font-bold text-lg">{highSeverityOpen.length}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
      ) : (
        <>
          <Section title="Documents expiring or expired" icon={FolderLock} empty="Everything is current." href="/ops/documents">
            {(expiringDocs ?? []).slice(0, 6).map((d) => (
              <Link key={d.id} to="/ops/documents" className="card !py-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{d.doc_type}</p>
                  {d.expiry_date && <p className="text-xs text-gray-500 dark:text-gray-400">Expires {formatDate(d.expiry_date)}</p>}
                </div>
                <ComplianceStatusChip status={d.status} />
              </Link>
            ))}
          </Section>

          <Section title="Critical audit events" icon={History} empty="No critical-severity events recorded." href="/ops/admin/audit">
            {(criticalAudit?.entries ?? []).slice(0, 6).map((entry) => (
              <div key={entry.id} className="card !py-3">
                <p className="font-medium text-sm">{AUDIT_ACTION_LABELS[entry.action] ?? entry.action}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{entry.actor?.full_name ?? 'System'} · {formatDate(entry.created_at)}</p>
              </div>
            ))}
          </Section>

          <Section title="High-severity open incidents" icon={AlertTriangle} empty="No high or critical severity incidents currently open." href="/ops/incidents">
            {highSeverityOpen.slice(0, 6).map((i) => (
              <div key={i.id} className="card !py-3">
                <p className="font-medium text-sm">{i.category}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{i.severity} severity · {formatDate(i.occurred_at)}</p>
              </div>
            ))}
          </Section>
        </>
      )}
    </div>
  );
}

function Section({
  title, icon: Icon, empty, href, children,
}: {
  title: string; icon: LucideIcon; empty: string; href: string; children: React.ReactNode;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2 px-1">
        <h2 className="font-heading font-bold text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide">{title}</h2>
        <Link to={href} className="text-xs text-brand font-medium">View all</Link>
      </div>
      {hasChildren ? <div className="space-y-2">{children}</div> : <EmptyState icon={Icon} title="All clear" description={empty} />}
    </div>
  );
}
