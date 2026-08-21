import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import { useOrganisation, usePermissions, isModuleEnabled, INDUSTRY_LABELS } from '@/hooks/useOrganisation';
import { useUpdateOrgSettings, useUpdateOrgName, ORG_MODULE_KEYS, MODULE_LABELS, INDUSTRY_MODES } from '@/hooks/useOrgSettings';
import { useToastStore } from '@/components/ui/Toast';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { cn } from '@/lib/utils';
import type { Json } from '@/types/database.types';

export default function OrgSettings() {
  const { data: org, isLoading } = useOrganisation();
  const { can } = usePermissions();
  const updateSettings = useUpdateOrgSettings();
  const updateName = useUpdateOrgName();
  const push = useToastStore((s) => s.push);
  const canManage = can('org.manage_settings');

  const [name, setName] = useState('');
  useEffect(() => {
    if (org?.organisation_name) setName(org.organisation_name);
  }, [org?.organisation_name]);

  if (isLoading || !org) {
    return (
      <div className="px-4 pt-6 pb-24 space-y-3">
        <SkeletonCard /><SkeletonCard />
      </div>
    );
  }

  async function toggleModule(key: string, currentlyEnabled: boolean) {
    const base = (org!.enabled_modules && typeof org!.enabled_modules === 'object' && !Array.isArray(org!.enabled_modules))
      ? (org!.enabled_modules as Record<string, unknown>)
      : {};
    const next: Record<string, boolean> = { ...(base as Record<string, boolean>), [key]: !currentlyEnabled };
    try {
      await updateSettings.mutateAsync({ enabled_modules: next });
      push(`${MODULE_LABELS[key as keyof typeof MODULE_LABELS] ?? key} ${!currentlyEnabled ? 'enabled' : 'disabled'}`, 'success');
    } catch (e: any) {
      push(e.message ?? 'Failed to update module', 'error');
    }
  }

  return (
    <div className="px-4 pt-6 pb-24">
      <h1 className="font-heading font-bold text-2xl mb-1">Organisation Settings</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Industry mode, module visibility, and organisation details.</p>

      {!canManage && (
        <div className="card mb-4 !bg-gray-50 dark:!bg-charcoal-light">
          <p className="text-xs text-gray-500 dark:text-gray-400">You have view-only access. Ask an org admin to change these settings.</p>
        </div>
      )}

      <div className="card mb-4">
        <h3 className="font-heading font-bold text-sm mb-3">Organisation name</h3>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            value={name}
            disabled={!canManage}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            className="btn-primary text-sm !px-4"
            disabled={!canManage || !name.trim() || name.trim() === org.organisation_name || updateName.isPending}
            onClick={async () => {
              try {
                await updateName.mutateAsync(name.trim());
                push('Organisation name updated', 'success');
              } catch (e: any) {
                push(e.message ?? 'Failed to update name', 'error');
              }
            }}
          >
            Save
          </button>
        </div>
      </div>

      <div className="card mb-4">
        <h3 className="font-heading font-bold text-sm mb-3">Industry mode</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Affects default terminology and which workflows are surfaced. Currently: {INDUSTRY_LABELS[org.industry_mode]}.</p>
        <div className="grid grid-cols-2 gap-2">
          {INDUSTRY_MODES.map((mode) => (
            <button
              key={mode}
              disabled={!canManage || updateSettings.isPending}
              onClick={async () => {
                try {
                  await updateSettings.mutateAsync({ industry_mode: mode });
                  push(`Industry mode set to ${INDUSTRY_LABELS[mode]}`, 'success');
                } catch (e: any) {
                  push(e.message ?? 'Failed to update industry mode', 'error');
                }
              }}
              className={cn(
                'rounded-xl px-3 py-2.5 text-xs font-semibold flex items-center justify-between',
                org.industry_mode === mode ? 'bg-brand text-white' : 'bg-gray-100 dark:bg-charcoal-light text-gray-600 dark:text-gray-300'
              )}
            >
              {INDUSTRY_LABELS[mode]}
              {org.industry_mode === mode && <Check className="w-3.5 h-3.5" />}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 className="font-heading font-bold text-sm mb-1">Modules</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Turn workflows off for this organisation without losing their data.</p>
        <div className="space-y-2">
          {ORG_MODULE_KEYS.map((key) => {
            const enabled = isModuleEnabled(org.enabled_modules as Json, key);
            return (
              <div key={key} className="flex items-center justify-between rounded-xl bg-gray-50 dark:bg-charcoal-light px-3 py-2.5">
                <span className="text-sm font-medium">{MODULE_LABELS[key]}</span>
                <button
                  disabled={!canManage || updateSettings.isPending}
                  onClick={() => toggleModule(key, enabled)}
                  className={cn(
                    'relative w-11 h-6 rounded-full transition-colors',
                    enabled ? 'bg-brand' : 'bg-gray-300 dark:bg-charcoal'
                  )}
                  aria-label={`Toggle ${MODULE_LABELS[key]}`}
                >
                  <span className={cn('absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform', enabled ? 'translate-x-[22px]' : 'translate-x-0.5')} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
