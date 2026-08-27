import { useState } from 'react';
import { Bug, X } from 'lucide-react';
import { useOrganisation, usePermissions } from '@/hooks/useOrganisation';
import { getRoleConfig } from '@/config/roleConfig';

// QA aid only - never rendered in production. Shows what role AfriOps has
// resolved for the current profile and exactly which permission codes
// role_permissions grants it, so QA can confirm "the app thinks I'm a
// technician" without cross-referencing the database by hand. Reads the
// same usePermissions()/useOrganisation() data every guard in the app
// already reads - it's a window onto existing state, not a second source
// of truth.
export function RoleInspector() {
  const [open, setOpen] = useState(false);
  const { data: org } = useOrganisation();
  const { data: permissions, can } = usePermissions();

  if (import.meta.env.PROD) return null;

  const roleCfg = org?.role ? getRoleConfig(org.role) : null;
  const grantedCodes = permissions ? Array.from(permissions).sort() : [];

  return (
    <div className="fixed bottom-20 left-3 z-50">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="w-9 h-9 rounded-full bg-charcoal text-white shadow-card flex items-center justify-center"
          aria-label="Open role inspector"
          title="Role inspector (dev only)"
        >
          <Bug className="w-4 h-4" />
        </button>
      ) : (
        <div className="w-72 max-h-96 overflow-y-auto rounded-xl bg-charcoal text-white text-xs shadow-card p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="font-heading font-bold text-sm flex items-center gap-1.5">
              <Bug className="w-3.5 h-3.5" /> Role inspector
            </p>
            <button onClick={() => setOpen(false)} aria-label="Close role inspector">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1 mb-3">
            <p><span className="text-gray-400">org:</span> {org?.organisation_name ?? '—'}</p>
            <p><span className="text-gray-400">role:</span> {org?.role ?? '—'}</p>
            <p><span className="text-gray-400">industry_mode:</span> {org?.industry_mode ?? '—'}</p>
            <p><span className="text-gray-400">default landing:</span> {roleCfg?.defaultLanding ?? '—'}</p>
            <p><span className="text-gray-400">dashboard key:</span> {roleCfg?.dashboardKey ?? '—'}</p>
          </div>

          <p className="font-semibold text-gray-300 mb-1">allowedModules ({roleCfg?.allowedModules.length ?? 0})</p>
          <p className="text-gray-400 mb-3 break-words">{roleCfg?.allowedModules.join(', ') || '—'}</p>

          <p className="font-semibold text-gray-300 mb-1">granted permissions ({grantedCodes.length})</p>
          {grantedCodes.length === 0 ? (
            <p className="text-gray-500">none loaded yet</p>
          ) : (
            <ul className="space-y-0.5">
              {grantedCodes.map((code) => (
                <li key={code} className="text-gray-300">
                  {code}
                </li>
              ))}
            </ul>
          )}

          <p className="mt-3 pt-2 border-t border-white/10 text-gray-500">
            can('org.manage_settings'): {String(can('org.manage_settings'))}
          </p>
        </div>
      )}
    </div>
  );
}
