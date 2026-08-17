import { useState } from 'react';
import { ShieldCheck, ShieldAlert, ShieldX, Clock, FileText } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useInsurancePolicies, useVerifyInsurance, useMerchants, useSignedUrl } from '@/hooks/useRt46';
import { daysUntil, type InsurancePolicy } from '@/lib/rt46';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToastStore } from '@/components/ui/Toast';
import { cn, formatDate } from '@/lib/utils';

const STATUS_META: Record<InsurancePolicy['status'], { label: string; className: string; icon: typeof ShieldCheck }> = {
  pending_verification: { label: 'Pending Verification', className: 'bg-warning/15 text-warning', icon: Clock },
  verified: { label: 'Verified', className: 'bg-success/15 text-success', icon: ShieldCheck },
  rejected: { label: 'Rejected', className: 'bg-danger/15 text-danger', icon: ShieldX },
  expired: { label: 'Expired', className: 'bg-gray-200 text-gray-500', icon: ShieldAlert },
};

function RejectPrompt({ onConfirm, onCancel }: { onConfirm: (reason: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4" onClick={onCancel}>
      <div className="card w-full sm:max-w-md" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-heading font-bold mb-2">Reject policy</h3>
        <textarea className="input min-h-[80px] mb-3" placeholder="Reason for rejection…" value={reason} onChange={(e) => setReason(e.target.value)} />
        <div className="flex gap-2">
          <button className="btn-secondary flex-1" onClick={onCancel}>Cancel</button>
          <button className="btn-primary flex-1 !bg-danger" disabled={!reason.trim()} onClick={() => onConfirm(reason)}>Reject</button>
        </div>
      </div>
    </div>
  );
}

function PolicyDocLink({ path }: { path: string }) {
  const { data: url } = useSignedUrl('rt46-evidence', path);
  if (!url) return <p className="text-xs text-gray-400 mb-2">Loading document link…</p>;
  return (
    <a className="text-xs text-brand font-semibold flex items-center gap-1 mb-2" href={url} target="_blank" rel="noreferrer">
      <FileText className="w-3 h-3" /> View policy document
    </a>
  );
}

export default function Rt46Compliance() {
  const { data: policies, isLoading } = useInsurancePolicies();
  const { data: merchants } = useMerchants();
  const profile = useAuthStore((s) => s.profile);
  const push = useToastStore((s) => s.push);
  const verify = useVerifyInsurance();
  const [rejecting, setRejecting] = useState<string | null>(null);

  const merchantsById = new Map((merchants ?? []).map((m) => [m.id, m]));

  return (
    <div className="px-4 pt-6 pb-6">
      <h1 className="font-heading font-bold text-2xl mb-1">Insurance Compliance</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
        Merchants are auto-suspended the day their insurance expires and cannot receive new work until a valid, verified policy is on file.
      </p>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <SkeletonCard key={i} />)}</div>
      ) : !policies?.length ? (
        <EmptyState icon={ShieldCheck} title="No insurance policies uploaded yet" />
      ) : (
        <div className="space-y-3">
          {policies.map((p) => {
            const meta = STATUS_META[p.status];
            const Icon = meta.icon;
            const days = daysUntil(p.expiry_date);
            const merchant = merchantsById.get(p.merchant_id);
            return (
              <div key={p.id} className="card">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold">{p.merchants?.trading_name ?? merchant?.trading_name ?? 'Merchant'}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{p.insurer} · {p.cover_type} · #{p.policy_number}</p>
                  </div>
                  <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold shrink-0', meta.className)}>
                    <Icon className="w-3 h-3" /> {meta.label}
                  </span>
                </div>

                <p className={cn('text-xs mb-2', days !== null && days < 0 ? 'text-danger font-semibold' : days !== null && days <= 30 ? 'text-warning font-semibold' : 'text-gray-500')}>
                  {days === null ? '—' : days < 0 ? `Expired ${Math.abs(days)}d ago` : `Expires in ${days}d (${formatDate(p.expiry_date)})`}
                </p>

                <PolicyDocLink path={p.document_storage_path} />

                {p.status === 'rejected' && p.rejection_reason && (
                  <p className="text-xs text-danger mb-2">Rejected: {p.rejection_reason}</p>
                )}

                {p.status === 'pending_verification' && (
                  <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                    <button
                      className="btn-secondary flex-1 text-sm !py-2 !text-danger"
                      onClick={() => setRejecting(p.id)}
                    >
                      Reject
                    </button>
                    <button
                      className="btn-primary flex-1 text-sm !py-2"
                      disabled={verify.isPending}
                      onClick={async () => {
                        if (!profile?.id) return;
                        try {
                          await verify.mutateAsync({ policyId: p.id, approve: true, actorId: profile.id });
                          push('Policy verified', 'success');
                        } catch (e: any) {
                          push(e.message ?? 'Verification failed', 'error');
                        }
                      }}
                    >
                      Verify & Approve
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {rejecting && (
        <RejectPrompt
          onCancel={() => setRejecting(null)}
          onConfirm={async (reason) => {
            if (!profile?.id) return;
            try {
              await verify.mutateAsync({ policyId: rejecting, approve: false, actorId: profile.id, reason });
              push('Policy rejected', 'success');
            } catch (e: any) {
              push(e.message ?? 'Failed to reject', 'error');
            } finally {
              setRejecting(null);
            }
          }}
        />
      )}
    </div>
  );
}
