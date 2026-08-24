import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldAlert, Building2 } from 'lucide-react';
import { useIsPlatformAdmin, usePlatformOrganisations, BILLING_STATUS_META } from '@/hooks/useSuperAdmin';
import { INDUSTRY_LABELS } from '@/hooks/useOrganisation';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDate, cn } from '@/lib/utils';

// Deliberately separate from OrgAdminDashboard/OpsDashboard — this reads
// across every organisation in the platform, not just the current user's.
// Access is enforced by RLS (organisations_select_platform_admin /
// billing_accounts_select_platform_admin), not by this component: a non-
// admin hitting this route gets an honest "no access" empty state because
// their query genuinely returns zero rows, not because of a client-side
// if-check that could be bypassed.
export default function SuperAdmin() {
  const { data: isAdmin, isLoading: adminCheckLoading } = useIsPlatformAdmin();
  const { data: orgs, isLoading: orgsLoading } = usePlatformOrganisations();

  if (adminCheckLoading) {
    return <div className="px-4 pt-6 pb-6 space-y-2"><SkeletonCard /><SkeletonCard /></div>;
  }

  if (!isAdmin) {
    return (
      <div className="px-4 pt-6 pb-6">
        <Link to="/ops" className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 mb-3">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <EmptyState
          icon={ShieldAlert}
          title="No platform access"
          description="This area is restricted to platform administrators. If you believe you should have access, ask an existing platform admin to grant it."
        />
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-6">
      <Link to="/ops" className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 mb-3">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>
      <div className="mb-6">
        <p className="text-gray-500 dark:text-gray-400 text-sm flex items-center gap-1.5">
          <ShieldAlert className="w-4 h-4" /> Platform Administration
        </p>
        <h1 className="font-heading font-bold text-2xl">Organisations</h1>
        <p className="text-xs text-gray-400 mt-0.5">{orgs?.length ?? 0} organisation{orgs?.length === 1 ? '' : 's'} on the platform</p>
      </div>

      {orgsLoading ? (
        <div className="space-y-2"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
      ) : !orgs?.length ? (
        <EmptyState icon={Building2} title="No organisations" description="Nothing on the platform yet." />
      ) : (
        <div className="space-y-2">
          {orgs.map((o) => {
            const billingMeta = o.billing_status ? BILLING_STATUS_META[o.billing_status] : null;
            return (
              <div key={o.id} className="card !py-3">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="font-medium text-sm flex-1">{o.name}</p>
                  {billingMeta && (
                    <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase shrink-0', billingMeta.className)}>
                      {billingMeta.label}
                    </span>
                  )}
                  {!o.billing_status && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase shrink-0 bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                      No billing account
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {INDUSTRY_LABELS[o.industry_mode as keyof typeof INDUSTRY_LABELS] ?? o.industry_mode} · {o.billing_plan ?? 'No plan'} · Created {formatDate(o.created_at)}
                </p>
                {o.trial_ends_at && (
                  <p className="text-xs text-gray-400 mt-0.5">Trial ends {formatDate(o.trial_ends_at)}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
