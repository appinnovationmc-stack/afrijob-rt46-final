import { useState } from 'react';
import {
  Building2, ChevronDown, ChevronUp, ShieldAlert, ShieldCheck, Wrench,
  Users, Landmark, History, CalendarClock,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import {
  useMerchants, useMerchantVerification, useSuspendMerchant, useReinstateMerchant,
} from '@/hooks/useRt46';
import { BBBEE_LABELS, MERCHANT_STATUS_LABELS, daysUntil, type Merchant } from '@/lib/rt46';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToastStore } from '@/components/ui/Toast';
import { cn, formatDate } from '@/lib/utils';

const STATUS_STYLES: Record<Merchant['status'], string> = {
  pending_onboarding: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  active: 'bg-success/15 text-success',
  suspended: 'bg-danger/15 text-danger',
  terminated: 'bg-gray-200 text-gray-500',
};

function SuspendModal({ merchant, onClose }: { merchant: Merchant; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const profile = useAuthStore((s) => s.profile);
  const push = useToastStore((s) => s.push);
  const suspend = useSuspendMerchant();

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full sm:max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-2">
          <ShieldAlert className="w-5 h-5 text-danger" />
          <h3 className="font-heading font-bold">Suspend {merchant.trading_name}</h3>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          A reason is mandatory and is recorded permanently in the audit log. No new work will be allocated to this merchant until reinstated.
        </p>
        <textarea
          className="input min-h-[90px] mb-3"
          placeholder="Reason for suspension (minimum 5 characters)…"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="flex gap-2">
          <button className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary flex-1 !bg-danger"
            disabled={reason.trim().length < 5 || suspend.isPending}
            onClick={async () => {
              if (!profile?.id) return;
              try {
                await suspend.mutateAsync({ merchantId: merchant.id, actorId: profile.id, reason });
                push('Merchant suspended', 'success');
                onClose();
              } catch (e: any) {
                push(e.message ?? 'Failed to suspend merchant', 'error');
              }
            }}
          >
            {suspend.isPending ? 'Suspending…' : 'Confirm Suspension'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MerchantDetail({ merchant }: { merchant: Merchant }) {
  const { data, isLoading } = useMerchantVerification(merchant.id);
  const holdDays = merchant.verification_hold_until ? daysUntil(merchant.verification_hold_until) : null;

  if (isLoading) return <div className="pt-3"><SkeletonCard /></div>;
  if (!data) return null;

  return (
    <div className="pt-3 space-y-3 text-sm">
      {holdDays !== null && holdDays >= 0 && (
        <div className="rounded-lg bg-warning/10 text-warning px-3 py-2 text-xs font-medium">
          Allocation on hold for {holdDays}d — {merchant.verification_hold_reason}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
          <Building2 className="w-3.5 h-3.5" /> {data.facilities.length} facilities
        </div>
        <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
          <Wrench className="w-3.5 h-3.5" /> {data.equipment.length} equipment items
        </div>
        <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
          <Users className="w-3.5 h-3.5" /> {data.technicians.length} technicians
        </div>
        <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
          <Landmark className="w-3.5 h-3.5" /> {data.bankDetails.length ? 'Bank details on file' : 'No bank details'}
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
        <CalendarClock className="w-3.5 h-3.5" />
        Next re-inspection: {formatDate(merchant.next_inspection_due)}
        {merchant.last_inspection_at && ` · last: ${formatDate(merchant.last_inspection_at)}`}
      </div>

      {data.inspections.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Recent inspections</p>
          {data.inspections.slice(0, 3).map((i) => (
            <div key={i.id} className="flex items-center justify-between py-1 border-t border-gray-100 dark:border-gray-800">
              <span className="text-xs">{formatDate(i.scheduled_for)}</span>
              <span className={cn(
                'text-xs font-semibold',
                i.result === 'pass' && 'text-success',
                i.result === 'fail' && 'text-danger',
                i.result === 'conditional_pass' && 'text-warning',
                !i.result && 'text-gray-400',
              )}>
                {i.result ? i.result.replace('_', ' ') : 'scheduled'}
              </span>
            </div>
          ))}
        </div>
      )}

      {data.changeLog.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 flex items-center gap-1">
            <History className="w-3 h-3" /> Change history
          </p>
          {data.changeLog.slice(0, 5).map((c) => (
            <div key={c.id} className="text-xs py-1 border-t border-gray-100 dark:border-gray-800">
              <span className={cn('font-medium', c.is_critical && 'text-warning')}>{c.field_changed}</span>
              {' changed '}{formatDate(c.changed_at)}
              {c.is_critical && ' — triggered re-verification hold'}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Rt46Merchants() {
  const { data: merchants, isLoading } = useMerchants();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<Merchant | null>(null);
  const profile = useAuthStore((s) => s.profile);
  const push = useToastStore((s) => s.push);
  const reinstate = useReinstateMerchant();

  return (
    <div className="px-4 pt-6 pb-6">
      <h1 className="font-heading font-bold text-2xl mb-1">Merchant Governance</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
        Verification, compliance status, and enforcement actions for all onboarded merchants.
      </p>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <SkeletonCard key={i} />)}</div>
      ) : !merchants?.length ? (
        <EmptyState icon={Building2} title="No merchants onboarded yet" />
      ) : (
        <div className="space-y-3">
          {merchants.map((m) => {
            const isOpen = expanded === m.id;
            const insuranceDays = daysUntil(m.insurance_valid_until);
            return (
              <div key={m.id} className="card">
                <button className="w-full flex items-start justify-between text-left" onClick={() => setExpanded(isOpen ? null : m.id)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">{m.trading_name}</p>
                      <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold', STATUS_STYLES[m.status])}>
                        {MERCHANT_STATUS_LABELS[m.status]}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {BBBEE_LABELS[m.bbbee_level]} · Quality {Math.round(m.quality_score * 100)}% · Capacity {m.declared_capacity_per_month}/mo
                    </p>
                    <p className={cn(
                      'text-xs mt-0.5',
                      insuranceDays === null ? 'text-gray-400' : insuranceDays < 0 ? 'text-danger font-semibold' : insuranceDays <= 30 ? 'text-warning font-semibold' : 'text-gray-500'
                    )}>
                      {insuranceDays === null ? 'No insurance on file' :
                        insuranceDays < 0 ? `Insurance expired ${Math.abs(insuranceDays)}d ago` :
                        `Insurance valid ${insuranceDays}d`}
                    </p>
                  </div>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0 mt-1" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0 mt-1" />}
                </button>

                {isOpen && (
                  <>
                    <MerchantDetail merchant={m} />
                    <div className="flex gap-2 pt-3 mt-2 border-t border-gray-100 dark:border-gray-800">
                      {m.status === 'suspended' ? (
                        <button
                          className="btn-secondary flex-1 text-sm !py-2 flex items-center justify-center gap-1.5"
                          disabled={reinstate.isPending}
                          onClick={async () => {
                            if (!profile?.id) return;
                            try {
                              await reinstate.mutateAsync({ merchantId: m.id, actorId: profile.id });
                              push('Merchant reinstated', 'success');
                            } catch (e: any) {
                              push(e.message ?? 'Failed to reinstate', 'error');
                            }
                          }}
                        >
                          <ShieldCheck className="w-4 h-4" /> Reinstate
                        </button>
                      ) : (
                        <button
                          className="btn-secondary flex-1 text-sm !py-2 !text-danger flex items-center justify-center gap-1.5"
                          onClick={() => setSuspendTarget(m)}
                        >
                          <ShieldAlert className="w-4 h-4" /> Suspend
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {suspendTarget && <SuspendModal merchant={suspendTarget} onClose={() => setSuspendTarget(null)} />}
    </div>
  );
}
