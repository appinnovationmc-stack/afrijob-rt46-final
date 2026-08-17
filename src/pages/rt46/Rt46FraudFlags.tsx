import { useState } from 'react';
import { AlertOctagon, ShieldAlert, Search, CheckCircle2, XCircle } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useFraudFlags, useUpdateFraudFlagStatus, useSuspendMerchant } from '@/hooks/useRt46';
import { FRAUD_STATUS_LABELS, type FraudFlagStatus } from '@/lib/rt46';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToastStore } from '@/components/ui/Toast';
import { cn, formatDate } from '@/lib/utils';

const STATUS_STYLES: Record<FraudFlagStatus, string> = {
  open: 'bg-danger/15 text-danger',
  under_review: 'bg-warning/15 text-warning',
  confirmed: 'bg-charcoal text-white dark:bg-white dark:text-charcoal',
  dismissed: 'bg-gray-200 text-gray-500',
};

const FLAG_TYPE_LABELS: Record<string, string> = {
  self_invoicing: 'Self-invoicing',
  price_anomaly: 'Price anomaly',
  duplicate_claim: 'Duplicate / repeated claim',
  collusion_pattern: 'Collusion pattern',
  insurance_lapse: 'Insurance lapse',
  other: 'Other anomaly',
};

const FILTERS: { value: FraudFlagStatus | undefined; label: string }[] = [
  { value: undefined, label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'dismissed', label: 'Dismissed' },
];

function SuspendPrompt({ onConfirm, onCancel }: { onConfirm: (reason: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4" onClick={onCancel}>
      <div className="card w-full sm:max-w-md" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-heading font-bold mb-2">Suspend merchant</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">A reason is mandatory and recorded in the audit log.</p>
        <textarea className="input min-h-[80px] mb-3" placeholder="Reason (min. 5 characters)…" value={reason} onChange={(e) => setReason(e.target.value)} />
        <div className="flex gap-2">
          <button className="btn-secondary flex-1" onClick={onCancel}>Cancel</button>
          <button className="btn-primary flex-1 !bg-danger" disabled={reason.trim().length < 5} onClick={() => onConfirm(reason)}>Suspend</button>
        </div>
      </div>
    </div>
  );
}

export default function Rt46FraudFlags() {
  const [filter, setFilter] = useState<FraudFlagStatus | undefined>(undefined);
  const { data: flags, isLoading } = useFraudFlags(filter);
  const profile = useAuthStore((s) => s.profile);
  const push = useToastStore((s) => s.push);
  const updateStatus = useUpdateFraudFlagStatus();
  const suspend = useSuspendMerchant();
  const [suspendCtx, setSuspendCtx] = useState<{ merchantId: string } | null>(null);

  return (
    <div className="px-4 pt-6 pb-6">
      <h1 className="font-heading font-bold text-2xl mb-1">Fraud & Investigations</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Auto-detected anomalies — repeated vehicles, volume spikes, cancellation rates, price variance, shared bank/contact details.
      </p>

      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4 pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.label}
            onClick={() => setFilter(f.value)}
            className={cn(
              'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold',
              filter === f.value ? 'bg-brand text-white' : 'bg-gray-100 dark:bg-charcoal-light text-gray-600 dark:text-gray-300'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <SkeletonCard key={i} />)}</div>
      ) : !flags?.length ? (
        <EmptyState icon={AlertOctagon} title="No fraud flags" description="Nothing matches this filter." />
      ) : (
        <div className="space-y-3">
          {flags.map((f) => (
            <div key={f.id} className="card">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold text-sm">{FLAG_TYPE_LABELS[f.flag_type] ?? f.flag_type}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{f.merchants?.trading_name ?? 'Unknown merchant'} · {formatDate(f.created_at)}</p>
                </div>
                <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold shrink-0', STATUS_STYLES[f.status])}>
                  {FRAUD_STATUS_LABELS[f.status]}
                </span>
              </div>

              {f.detail && <p className="text-xs text-gray-600 dark:text-gray-300 mb-3">{f.detail}</p>}

              <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                {f.status === 'open' && (
                  <button
                    className="btn-secondary text-xs !py-1.5 !px-3 flex items-center gap-1"
                    onClick={async () => {
                      if (!profile?.id) return;
                      try { await updateStatus.mutateAsync({ flagId: f.id, status: 'under_review', actorId: profile.id }); }
                      catch (e: any) { push(e.message, 'error'); }
                    }}
                  >
                    <Search className="w-3 h-3" /> Start review
                  </button>
                )}
                {f.status === 'under_review' && (
                  <>
                    <button
                      className="btn-secondary text-xs !py-1.5 !px-3 flex items-center gap-1 !text-success"
                      onClick={async () => {
                        if (!profile?.id) return;
                        try { await updateStatus.mutateAsync({ flagId: f.id, status: 'confirmed', actorId: profile.id }); push('Marked confirmed', 'success'); }
                        catch (e: any) { push(e.message, 'error'); }
                      }}
                    >
                      <CheckCircle2 className="w-3 h-3" /> Confirm
                    </button>
                    <button
                      className="btn-secondary text-xs !py-1.5 !px-3 flex items-center gap-1"
                      onClick={async () => {
                        if (!profile?.id) return;
                        try { await updateStatus.mutateAsync({ flagId: f.id, status: 'dismissed', actorId: profile.id }); push('Dismissed', 'success'); }
                        catch (e: any) { push(e.message, 'error'); }
                      }}
                    >
                      <XCircle className="w-3 h-3" /> Dismiss
                    </button>
                  </>
                )}
                {f.merchant_id && (f.status === 'under_review' || f.status === 'confirmed') && (
                  <button
                    className="btn-secondary text-xs !py-1.5 !px-3 flex items-center gap-1 !text-danger"
                    onClick={() => setSuspendCtx({ merchantId: f.merchant_id! })}
                  >
                    <ShieldAlert className="w-3 h-3" /> Suspend merchant
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {suspendCtx && (
        <SuspendPrompt
          onCancel={() => setSuspendCtx(null)}
          onConfirm={async (reason) => {
            if (!profile?.id) return;
            try {
              await suspend.mutateAsync({ merchantId: suspendCtx.merchantId, actorId: profile.id, reason });
              push('Merchant suspended', 'success');
            } catch (e: any) {
              push(e.message ?? 'Failed to suspend', 'error');
            } finally {
              setSuspendCtx(null);
            }
          }}
        />
      )}
    </div>
  );
}
