import { useState } from 'react';
import { CalendarClock, X, Play, Power } from 'lucide-react';
import {
  useMaintenanceSchedules, useCreateMaintenanceSchedule, useSetMaintenanceScheduleActive,
  useTriggerMaintenanceScheduleNow, useRunDueMaintenanceSchedules,
  isOverdue, daysUntilDue, TRIGGER_TYPE_LABELS,
} from '@/hooks/useMaintenanceSchedules';
import { useAssetOptions } from '@/hooks/useAssetSitePickers';
import { useOrganisation, INDUSTRY_CONFIG } from '@/hooks/useOrganisation';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { FAB } from '@/components/ui/FAB';
import { useToastStore } from '@/components/ui/Toast';
import { cn, formatDate } from '@/lib/utils';
import type { MaintenanceTriggerType } from '@/lib/afriops/preventiveMaintenance';

const TRIGGER_TYPES: MaintenanceTriggerType[] = ['interval_days', 'interval_hours', 'interval_km', 'fixed_date'];

function NewScheduleModal({ onClose }: { onClose: () => void }) {
  const create = useCreateMaintenanceSchedule();
  const { data: assets, isLoading: assetsLoading } = useAssetOptions();
  const { data: org } = useOrganisation();
  const industryConfig = INDUSTRY_CONFIG[org?.industry_mode ?? 'general'];
  const push = useToastStore((s) => s.push);
  const [form, setForm] = useState({ asset_id: '', name: '', trigger_type: 'interval_days' as MaintenanceTriggerType, interval_value: '', fixed_date: '' });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full sm:max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-heading font-bold">New maintenance schedule</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="space-y-3">
          <input className="input" placeholder="Schedule name (e.g. Oil service)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          {assetsLoading ? (
            <div className="input flex items-center text-sm text-gray-400">Loading assets…</div>
          ) : assets?.length ? (
            <select className="input" value={form.asset_id} onChange={(e) => setForm({ ...form, asset_id: e.target.value })}>
              <option value="">Select asset…</option>
              {assets.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          ) : (
            <input className="input" placeholder={`${industryConfig.assetLabelSingular} ID (UUID) — none found to pick from`} value={form.asset_id} onChange={(e) => setForm({ ...form, asset_id: e.target.value })} />
          )}
          <select className="input" value={form.trigger_type} onChange={(e) => setForm({ ...form, trigger_type: e.target.value as MaintenanceTriggerType })}>
            {TRIGGER_TYPES.map((t) => <option key={t} value={t}>{TRIGGER_TYPE_LABELS[t]}</option>)}
          </select>
          {form.trigger_type === 'fixed_date' ? (
            <input className="input" type="date" value={form.fixed_date} onChange={(e) => setForm({ ...form, fixed_date: e.target.value })} />
          ) : (
            <input className="input" type="number" placeholder="Interval value" value={form.interval_value} onChange={(e) => setForm({ ...form, interval_value: e.target.value })} />
          )}
        </div>
        <button
          className="btn-primary w-full mt-4"
          disabled={!form.name.trim() || !form.asset_id.trim() || create.isPending}
          onClick={async () => {
            try {
              await create.mutateAsync({
                name: form.name.trim(),
                asset_id: form.asset_id.trim(),
                trigger_type: form.trigger_type,
                interval_value: form.trigger_type !== 'fixed_date' && form.interval_value ? Number(form.interval_value) : undefined,
                fixed_date: form.trigger_type === 'fixed_date' ? form.fixed_date : undefined,
              });
              push('Schedule created', 'success');
              onClose();
            } catch (e: any) {
              push(e.message ?? 'Failed to create schedule', 'error');
            }
          }}
        >
          Create schedule
        </button>
      </div>
    </div>
  );
}

export default function MaintenanceSchedules() {
  const { data: schedules, isLoading } = useMaintenanceSchedules();
  const setActive = useSetMaintenanceScheduleActive();
  const triggerNow = useTriggerMaintenanceScheduleNow();
  const runDue = useRunDueMaintenanceSchedules();
  const push = useToastStore((s) => s.push);
  const [showNew, setShowNew] = useState(false);

  return (
    <div className="px-4 pt-6 pb-24">
      <div className="flex items-start justify-between mb-1">
        <h1 className="font-heading font-bold text-2xl">Preventive Maintenance</h1>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Time, meter or date-based schedules. Triggering creates a work order and rolls the next due date forward.
      </p>

      <button
        className="btn-secondary w-full mb-5 text-sm"
        disabled={runDue.isPending}
        onClick={async () => {
          try {
            const runs = await runDue.mutateAsync();
            push(`${runs.length} schedule${runs.length === 1 ? '' : 's'} swept`, 'success');
          } catch (e: any) {
            push(e.message ?? 'Sweep failed', 'error');
          }
        }}
      >
        Run due-schedule sweep now
      </button>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <SkeletonCard key={i} />)}</div>
      ) : !schedules?.length ? (
        <EmptyState icon={CalendarClock} title="No maintenance schedules yet" description="Create one to start tracking preventive service." />
      ) : (
        <div className="space-y-3">
          {schedules.map((s) => {
            const overdue = isOverdue(s);
            const days = daysUntilDue(s);
            return (
              <div key={s.id} className="card">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-sm">{s.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{TRIGGER_TYPE_LABELS[s.trigger_type]}</p>
                  </div>
                  <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold shrink-0',
                    !s.active ? 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' : overdue ? 'bg-danger/15 text-danger' : 'bg-success/15 text-success')}>
                    {!s.active ? 'Paused' : overdue ? 'Overdue' : 'Active'}
                  </span>
                </div>
                <p className={cn('text-xs mb-3', overdue ? 'text-danger font-semibold' : 'text-gray-500 dark:text-gray-400')}>
                  {s.next_due_at ? (overdue ? `Overdue by ${Math.abs(days ?? 0)}d (was due ${formatDate(s.next_due_at)})` : `Due in ${days}d (${formatDate(s.next_due_at)})`) : 'No due date computed yet'}
                </p>
                <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <button
                    className="btn-secondary flex-1 text-sm !py-2 flex items-center justify-center gap-1.5"
                    disabled={setActive.isPending}
                    onClick={async () => {
                      try {
                        await setActive.mutateAsync({ scheduleId: s.id, active: !s.active });
                      } catch (e: any) {
                        push(e.message ?? 'Failed to update', 'error');
                      }
                    }}
                  >
                    <Power className="w-4 h-4" /> {s.active ? 'Pause' : 'Resume'}
                  </button>
                  <button
                    className="btn-primary flex-1 text-sm !py-2 flex items-center justify-center gap-1.5"
                    disabled={triggerNow.isPending}
                    onClick={async () => {
                      try {
                        await triggerNow.mutateAsync({ scheduleId: s.id });
                        push('Work order created', 'success');
                      } catch (e: any) {
                        push(e.message ?? 'Failed to trigger', 'error');
                      }
                    }}
                  >
                    <Play className="w-4 h-4" /> Trigger now
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <FAB onClick={() => setShowNew(true)} label="New schedule" />
      {showNew && <NewScheduleModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
