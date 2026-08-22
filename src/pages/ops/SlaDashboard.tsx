import { useState } from 'react';
import { Gauge, X, Trash2, ShieldCheck } from 'lucide-react';
import {
  useSlaPolicies, useCreateSlaPolicy, useSetSlaPolicyActive,
  useOpenSlaBreaches, useAcknowledgeBreach, useRunSlaBreachSweep,
} from '@/hooks/useSla';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { FAB } from '@/components/ui/FAB';
import { useToastStore } from '@/components/ui/Toast';
import { cn, formatDate } from '@/lib/utils';
import { usePermissions } from '@/hooks/useOrganisation';
import type { WorkOrderPriority } from '@/lib/afriops/types';

type Tab = 'breaches' | 'policies';
const PRIORITIES: WorkOrderPriority[] = ['low', 'normal', 'high', 'urgent'];

interface DraftTarget { priority: WorkOrderPriority; response_minutes: string; resolution_minutes: string }

function NewPolicyModal({ onClose }: { onClose: () => void }) {
  const create = useCreateSlaPolicy();
  const push = useToastStore((s) => s.push);
  const [name, setName] = useState('');
  const [targets, setTargets] = useState<DraftTarget[]>([{ priority: 'normal', response_minutes: '60', resolution_minutes: '1440' }]);

  const valid = name.trim() && targets.every((t) => Number(t.response_minutes) > 0 && Number(t.resolution_minutes) > 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full sm:max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-heading font-bold">New SLA policy</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <input className="input mb-3" placeholder="Policy name" value={name} onChange={(e) => setName(e.target.value)} />

        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Targets by priority</p>
        <div className="space-y-2 mb-3">
          {targets.map((t, i) => (
            <div key={i} className="flex gap-2 items-center">
              <select className="input !w-28 !px-2" value={t.priority} onChange={(e) => setTargets(targets.map((x, j) => (j === i ? { ...x, priority: e.target.value as WorkOrderPriority } : x)))}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <input className="input !px-2" type="number" placeholder="Response min" value={t.response_minutes}
                onChange={(e) => setTargets(targets.map((x, j) => (j === i ? { ...x, response_minutes: e.target.value } : x)))} />
              <input className="input !px-2" type="number" placeholder="Resolution min" value={t.resolution_minutes}
                onChange={(e) => setTargets(targets.map((x, j) => (j === i ? { ...x, resolution_minutes: e.target.value } : x)))} />
              {targets.length > 1 && (
                <button onClick={() => setTargets(targets.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4 text-danger" /></button>
              )}
            </div>
          ))}
        </div>
        <button className="text-sm text-brand font-semibold mb-4" onClick={() => setTargets([...targets, { priority: 'normal', response_minutes: '60', resolution_minutes: '1440' }])}>
          + Add priority target
        </button>

        <button
          className="btn-primary w-full"
          disabled={!valid || create.isPending}
          onClick={async () => {
            try {
              await create.mutateAsync({
                name: name.trim(),
                targets: targets.map((t) => ({ priority: t.priority, response_minutes: Number(t.response_minutes), resolution_minutes: Number(t.resolution_minutes) })),
              });
              push('SLA policy created', 'success');
              onClose();
            } catch (e: any) {
              push(e.message ?? 'Failed to create policy', 'error');
            }
          }}
        >
          Create policy
        </button>
      </div>
    </div>
  );
}

export default function SlaDashboard() {
  const [tab, setTab] = useState<Tab>('breaches');
  const { data: breaches, isLoading: breachesLoading } = useOpenSlaBreaches();
  const { data: policies, isLoading: policiesLoading } = useSlaPolicies();
  const acknowledge = useAcknowledgeBreach();
  const sweep = useRunSlaBreachSweep();
  const setActive = useSetSlaPolicyActive();
  const push = useToastStore((s) => s.push);
  const [showNew, setShowNew] = useState(false);
  const { can } = usePermissions();
  const canManageSla = can('sla.manage');

  return (
    <div className="px-4 pt-6 pb-24">
      <h1 className="font-heading font-bold text-2xl mb-1">SLA Tracking</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Response and resolution targets, with breach monitoring.</p>

      <div className="flex gap-2 mb-5">
        <button className={cn('flex-1 rounded-xl px-3 py-2 text-sm font-semibold', tab === 'breaches' ? 'bg-brand text-white' : 'bg-gray-100 dark:bg-charcoal-light text-gray-600 dark:text-gray-300')} onClick={() => setTab('breaches')}>
          Open Breaches
        </button>
        <button className={cn('flex-1 rounded-xl px-3 py-2 text-sm font-semibold', tab === 'policies' ? 'bg-brand text-white' : 'bg-gray-100 dark:bg-charcoal-light text-gray-600 dark:text-gray-300')} onClick={() => setTab('policies')}>
          Policies
        </button>
      </div>

      {tab === 'breaches' ? (
        <>
          {canManageSla && (
            <button
              className="btn-secondary w-full mb-4 text-sm"
              disabled={sweep.isPending}
              onClick={async () => {
                try {
                  const found = await sweep.mutateAsync();
                  push(`Sweep complete — ${found.length} breach${found.length === 1 ? '' : 'es'} found`, 'info');
                } catch (e: any) {
                  push(e.message ?? 'Sweep failed', 'error');
                }
              }}
            >
              Run breach sweep now
            </button>
          )}
          {breachesLoading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <SkeletonCard key={i} />)}</div>
          ) : !breaches?.length ? (
            <EmptyState icon={ShieldCheck} title="No open breaches" description="All tracked work orders are within their SLA targets." />
          ) : (
            <div className="space-y-3">
              {breaches.map((b) => (
                <div key={b.id} className="card border border-danger/30 bg-danger/5">
                  <div className="flex items-start justify-between mb-2">
                    <p className="font-semibold text-sm capitalize">{b.metric} breach</p>
                    <span className="text-xs text-danger font-semibold">{b.minutes_over}min over</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Breached {formatDate(b.breached_at)}</p>
                  <button
                    className="btn-secondary w-full text-sm !py-2"
                    disabled={acknowledge.isPending}
                    onClick={async () => {
                      try {
                        await acknowledge.mutateAsync(b.id);
                        push('Breach acknowledged', 'success');
                      } catch (e: any) {
                        push(e.message ?? 'Failed to acknowledge', 'error');
                      }
                    }}
                  >
                    Acknowledge
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      ) : policiesLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <SkeletonCard key={i} />)}</div>
      ) : !policies?.length ? (
        <EmptyState icon={Gauge} title="No SLA policies yet" description="Create one to start attaching targets to work orders." />
      ) : (
        <div className="space-y-3">
          {policies.map((p) => (
            <div key={p.id} className="card">
              <div className="flex items-start justify-between mb-2">
                <p className="font-semibold text-sm">{p.name}</p>
                <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold', p.active ? 'bg-success/15 text-success' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400')}>
                  {p.active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{p.category ?? 'All categories'}</p>
              {canManageSla && (
              <button
                className="btn-secondary w-full text-sm !py-2"
                disabled={setActive.isPending}
                onClick={async () => {
                  try {
                    await setActive.mutateAsync({ policyId: p.id, active: !p.active });
                  } catch (e: any) {
                    push(e.message ?? 'Failed to update', 'error');
                  }
                }}
              >
                {p.active ? 'Deactivate' : 'Activate'}
              </button>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'policies' && canManageSla && <FAB onClick={() => setShowNew(true)} label="New policy" />}
      {showNew && <NewPolicyModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
