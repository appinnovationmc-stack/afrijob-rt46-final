import { Link } from 'react-router-dom';
import {
  Building2, ClipboardList, ShieldCheck, ClipboardCheck, AlertOctagon,
  Gauge, TrendingUp, Clock, ChevronRight,
} from 'lucide-react';
import { useControlTowerStats, useIsRt46Admin } from '@/hooks/useRt46';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/utils';

function Kpi({ label, value, tone = 'default', icon: Icon }: { label: string; value: string | number; tone?: 'default' | 'warning' | 'danger' | 'success'; icon: React.ElementType }) {
  const toneClass = {
    default: 'text-charcoal dark:text-white',
    warning: 'text-warning',
    danger: 'text-danger',
    success: 'text-success',
  }[tone];
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <Icon className="w-4 h-4 text-gray-400" />
      </div>
      <p className={cn('text-2xl font-heading font-bold', toneClass)}>{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}

const NAV_ITEMS = [
  { to: '/rt46/merchants', label: 'Merchant Governance', description: 'Onboarding, verification, suspensions', icon: Building2 },
  { to: '/rt46/work-orders', label: 'Fair Allocation', description: 'Work orders, scoring, audit log, export', icon: ClipboardList },
  { to: '/rt46/compliance', label: 'Insurance Compliance', description: 'Policy verification, expiry alerts', icon: ShieldCheck },
  { to: '/rt46/quality', label: 'Quality Control', description: 'Checklists, evidence, parts, reviews', icon: ClipboardCheck },
  { to: '/rt46/fraud-flags', label: 'Fraud & Investigations', description: 'Flags, review workflow, suspensions', icon: AlertOctagon },
];

export default function Rt46Dashboard() {
  const { data: admin, isLoading: adminLoading } = useIsRt46Admin();
  const { data: stats, isLoading } = useControlTowerStats();

  if (!adminLoading && !admin) {
    return (
      <div className="px-4 pt-6">
        <EmptyState
          icon={ShieldCheck}
          title="RT46 admin access required"
          description="Your account isn't registered as an RT46 program administrator. Contact National Treasury program support if you believe this is incorrect."
        />
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-6">
      <div className="mb-6">
        <p className="text-gray-500 dark:text-gray-400 text-sm flex items-center gap-1.5">
          <Gauge className="w-4 h-4" /> RT46 Control Tower
        </p>
        <h1 className="font-heading font-bold text-2xl">Fleet Repair Program</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {isLoading ? (
          [1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <Kpi label="Active work orders" value={stats?.activeWorkOrders ?? 0} icon={ClipboardList} />
            <Kpi
              label="SLA breaches"
              value={stats?.breachedSla ?? 0}
              tone={stats && stats.breachedSla > 0 ? 'danger' : 'success'}
              icon={Clock}
            />
            <Kpi
              label="Suspended merchants"
              value={stats?.suspendedMerchants ?? 0}
              tone={stats && stats.suspendedMerchants > 0 ? 'warning' : 'default'}
              icon={Building2}
            />
            <Kpi
              label="Avg. quality score"
              value={stats ? `${Math.round(stats.avgQualityScore * 100)}%` : '—'}
              tone="success"
              icon={TrendingUp}
            />
            <Kpi
              label="Insurance expiring ≤60d"
              value={stats?.expiringInsurance ?? 0}
              tone={stats && stats.expiringInsurance > 0 ? 'warning' : 'default'}
              icon={ShieldCheck}
            />
            <Kpi
              label="Open fraud flags"
              value={stats?.openFraudFlags ?? 0}
              tone={stats && stats.openFraudFlags > 0 ? 'danger' : 'success'}
              icon={AlertOctagon}
            />
          </>
        )}
      </div>

      {stats && stats.pendingInsuranceVerification > 0 && (
        <div className="card mb-4 border border-warning/30 bg-warning/5">
          <p className="text-sm font-semibold text-warning">
            {stats.pendingInsuranceVerification} insurance {stats.pendingInsuranceVerification === 1 ? 'policy' : 'policies'} awaiting verification
          </p>
        </div>
      )}

      <h2 className="font-heading font-bold text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 px-1">
        Program Areas
      </h2>
      <div className="flex flex-col gap-2">
        {NAV_ITEMS.map(({ to, label, description, icon: Icon }) => (
          <Link key={to} to={to} className="card flex items-center gap-3 active:scale-[0.98] transition-transform">
            <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-charcoal-light flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5 text-brand" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{label}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{description}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}
