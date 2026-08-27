import { Link } from 'react-router-dom';
import { ArrowLeft, Wallet, TrendingUp, ShoppingCart, CreditCard } from 'lucide-react';
import { useWorkOrders } from '@/hooks/useWorkOrders';
import { useBillingAccount, BILLING_PROVIDER_LABELS } from '@/hooks/useBillingAccount';
import { BILLING_STATUS_META } from '@/hooks/useSuperAdmin';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn, formatCurrencyZAR } from '@/lib/utils';

// Finance overview. This was previously an unreachable route: roleConfig.ts
// pointed the 'finance' role's default landing at /ops/finance, but no route
// or page ever existed for it, so anyone with that role hit an infinite
// redirect loop (/ -> /ops/finance -> no match -> / -> ...), which rendered
// as a permanent white screen.
//
// Deliberately built from data the app already has real numbers for
// (work_orders.actual_cost, the org's billing_accounts row) rather than
// fabricating invoices or revenue figures the schema doesn't track yet.
// Full purchase-order spend already has a home in Procurement — this links
// out to it instead of re-deriving item-level totals here.
export default function Finance() {
  const { data: workOrders, isLoading: woLoading } = useWorkOrders();
  const { data: account, isLoading: billingLoading } = useBillingAccount();

  const isLoading = woLoading || billingLoading;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const withCost = (workOrders ?? []).filter((wo) => typeof wo.actual_cost === 'number');
  const totalSpend = withCost.reduce((sum, wo) => sum + (wo.actual_cost ?? 0), 0);
  const monthSpend = withCost
    .filter((wo) => wo.completed_at && new Date(wo.completed_at) >= startOfMonth)
    .reduce((sum, wo) => sum + (wo.actual_cost ?? 0), 0);

  const byCategory = withCost.reduce<Record<string, number>>((acc, wo) => {
    acc[wo.category] = (acc[wo.category] ?? 0) + (wo.actual_cost ?? 0);
    return acc;
  }, {});
  const categoryRows = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);

  return (
    <div className="px-4 pt-6 pb-24">
      <Link to="/ops" className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 mb-3">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>
      <div className="mb-6">
        <p className="text-gray-500 dark:text-gray-400 text-sm flex items-center gap-1.5">
          <Wallet className="w-4 h-4" /> Finance
        </p>
        <h1 className="font-heading font-bold text-2xl">Finance overview</h1>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="card">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" /> Spend this month
              </p>
              <p className="text-xl font-bold">{formatCurrencyZAR(monthSpend)}</p>
            </div>
            <div className="card">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5" /> Total work order spend
              </p>
              <p className="text-xl font-bold">{formatCurrencyZAR(totalSpend)}</p>
            </div>
          </div>

          <div className="card mb-4">
            <h3 className="font-heading font-bold text-sm mb-3">Spend by category</h3>
            {categoryRows.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">No costed work orders yet.</p>
            ) : (
              <div className="space-y-2">
                {categoryRows.map(([category, amount]) => (
                  <div key={category} className="flex items-center justify-between text-sm">
                    <span className="capitalize text-gray-600 dark:text-gray-300">{category.replace(/_/g, ' ')}</span>
                    <span className="font-semibold">{formatCurrencyZAR(amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card mb-4">
            <div className="flex items-start justify-between gap-2 mb-3">
              <h3 className="font-heading font-bold text-sm flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5" /> Plan &amp; billing
              </h3>
              {account && (
                <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase shrink-0', BILLING_STATUS_META[account.status]?.className)}>
                  {BILLING_STATUS_META[account.status]?.label ?? account.status}
                </span>
              )}
            </div>
            {!account ? (
              <EmptyState icon={CreditCard} title="No billing account" description="This organisation doesn't have a billing account set up yet." />
            ) : (
              <>
                <p className="text-lg font-semibold capitalize">{account.plan}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Billed via {BILLING_PROVIDER_LABELS[account.provider]}</p>
              </>
            )}
            <Link to="/ops/admin/billing" className="text-xs font-semibold text-brand-600 dark:text-brand-400 mt-3 inline-block">
              View billing details →
            </Link>
          </div>

          <Link to="/ops/procurement" className="card flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm font-semibold">
              <ShoppingCart className="w-4 h-4" /> Procurement spend
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">View purchase orders →</span>
          </Link>
        </>
      )}
    </div>
  );
}
