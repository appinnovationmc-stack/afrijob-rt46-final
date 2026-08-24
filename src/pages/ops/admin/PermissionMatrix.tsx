import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, ChevronDown } from 'lucide-react';
import { usePermissionCatalogue, useRolePermissions, useSetRolePermission } from '@/hooks/useRolePermissions';
import { useOrganisation, roleAtLeast } from '@/hooks/useOrganisation';
import { useToastStore } from '@/components/ui/Toast';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { cn } from '@/lib/utils';
import type { OrganisationRole } from '@/lib/afriops/types';

const ROLES: OrganisationRole[] = [
  'owner', 'admin', 'manager', 'supervisor', 'operations_manager', 'fleet_manager',
  'finance', 'procurement_officer', 'member', 'technician', 'inspector', 'contractor', 'viewer',
];

export default function PermissionMatrix() {
  const { data: org } = useOrganisation();
  const { data: permissions, isLoading: permsLoading } = usePermissionCatalogue();
  const { data: rolePermissions, isLoading: rpLoading } = useRolePermissions();
  const setPermission = useSetRolePermission();
  const push = useToastStore((s) => s.push);
  const [activeModule, setActiveModule] = useState<string | null>(null);

  // This table has no organisation_id — it's platform-wide. Only the
  // platform-level "owner" tier should be able to edit it from here, not
  // every org's local admin (see useRolePermissions.ts).
  const isOwner = roleAtLeast(org?.role, 'owner');

  if (permsLoading || rpLoading || !permissions || !rolePermissions) {
    return (
      <div className="px-4 pt-6 pb-24 space-y-3">
        <Link to="/ops" className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 mb-3">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <SkeletonCard /><SkeletonCard />
      </div>
    );
  }

  const grantMap = new Map<string, boolean>();
  for (const rp of rolePermissions) grantMap.set(`${rp.role}:${rp.permission_code}`, rp.granted);

  const modules = Array.from(new Set(permissions.map((p) => p.module)));
  const visibleModules = activeModule ? [activeModule] : modules;

  return (
    <div className="px-4 pt-6 pb-24">
      <Link to="/ops" className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 mb-3">
        <ArrowLeft className="w-4 h-4" /> Back
      </Link>
      <h1 className="font-heading font-bold text-2xl mb-1">Permission Matrix</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Which roles can do what — applies platform-wide, across every organisation.</p>
      {!isOwner && (
        <div className="card mt-3 mb-4 !bg-warning/10">
          <p className="text-xs text-warning font-semibold">View-only. This table has no per-organisation scope — editing it changes every organisation on the platform, so only the owner tier can toggle grants here.</p>
        </div>
      )}

      <div className="relative mb-4">
        <select
          className="input appearance-none pr-8"
          value={activeModule ?? ''}
          onChange={(e) => setActiveModule(e.target.value || null)}
        >
          <option value="">All modules</option>
          {modules.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      </div>

      <div className="overflow-x-auto -mx-4 px-4">
        {visibleModules.map((mod) => (
          <div key={mod} className="mb-6">
            <h3 className="font-heading font-bold text-sm mb-2 capitalize flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-brand" /> {mod.replace(/_/g, ' ')}
            </h3>
            <table className="min-w-full text-xs border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="text-left pb-2 pr-3 font-semibold text-gray-500 dark:text-gray-400 sticky left-0 bg-white dark:bg-charcoal">Permission</th>
                  {ROLES.map((r) => (
                    <th key={r} className="pb-2 px-1.5 font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {r.replace(/_/g, ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {permissions.filter((p) => p.module === mod).map((perm) => (
                  <tr key={perm.code}>
                    <td className="py-1.5 pr-3 whitespace-nowrap sticky left-0 bg-white dark:bg-charcoal">{perm.code}</td>
                    {ROLES.map((role) => {
                      const granted = grantMap.get(`${role}:${perm.code}`) ?? false;
                      return (
                        <td key={role} className="py-1.5 px-1.5 text-center">
                          <button
                            disabled={!isOwner || setPermission.isPending}
                            onClick={async () => {
                              try {
                                await setPermission.mutateAsync({ role, permission_code: perm.code, granted: !granted });
                              } catch (e: any) {
                                push(e.message ?? 'Failed to update permission', 'error');
                              }
                            }}
                            className={cn(
                              'w-5 h-5 rounded-md inline-flex items-center justify-center',
                              granted ? 'bg-brand' : 'bg-gray-200 dark:bg-charcoal-light'
                            )}
                            aria-label={`${role} ${perm.code}`}
                          >
                            {granted && <span className="w-2 h-2 rounded-full bg-white" />}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
