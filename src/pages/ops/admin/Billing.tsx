import { Link } from 'react-router-dom';
import { ArrowLeft, CreditCard, Clock } from 'lucide-react';
import { useBillingAccount, BILLING_PROVIDER_LABELS } from '@/hooks/useBillingAccount';
import { BILLING_STATUS_META } from '@/hooks/useSuperAdmin';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDate, cn } from '@/lib/utils';

// Read-only: see useBillingAccount for why this deliberately doesn't offer
// a plan/status edit control. Surfaces exactly what the org's real
// billing_accounts row says — no fabricated invoices, usage, or pricing.
export default function Billing() {
  const { data: account, isLoading } = useBillingAccount();

  return (
    <div className="px-4 pt-6 pb-24">
      <Link to="/ops" className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 mb-3">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>
      <div className="mb-6">
        <p className="text-gray-500 dark:text-gray-400 text-sm flex items-center gap-1.5">
          <CreditCard className="w-4 h-4" /> Billing
        </p>
        <h1 className="font-heading font-bold text-2xl">Plan &amp; billing</h1>
      </div>

      {isLoading ? (
        <div className="space-y-2"><SkeletonCard /><SkeletonCard /></div>
      ) : !account ? (
        <EmptyState
          icon={CreditCard}
          title="No billing account"
          description="This organisation doesn't have a billing account set up yet. Contact support to get one created."
        />
      ) : (
        <>
          <div className="card mb-4">
            <div className="flex items-start justify-between gap-2 mb-3">
              <h3 className="font-heading font-bold text-sm">Current plan</h3>
              <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase shrink-0', BILLING_STATUS_META[account.status]?.className)}>
                {BILLING_STATUS_META[account.status]?.label ?? account.status}
              </span>
            </div>
            <p className="text-lg font-semibold capitalize">{account.plan}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Billed via {BILLING_PROVIDER_LABELS[account.provider]}</p>
            {account.trial_ends_at && (
              <p className="text-xs text-warning font-medium mt-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Trial ends {formatDate(account.trial_ends_at)}
              </p>
            )}
          </div>

          {account.provider === 'none' && (
            <div className="card !bg-gray-50 dark:!bg-charcoal-light">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                No payment provider is connected for this organisation. Plan and status changes are handled by the platform team until self-service billing is available — contact support to change your plan.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
