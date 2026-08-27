import { Link, Outlet } from 'react-router-dom';
import { PackageX } from 'lucide-react';
import { useOrganisation, usePermissions, isModuleEnabled } from '@/hooks/useOrganisation';
import { MODULE_LABELS } from '@/hooks/useOrgSettings';
import { getRoleConfig } from '@/config/roleConfig';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/SkeletonCard';

// Nav (OpsDashboard) already hides disabled-module tiles, but that's a
// list filter, not an access control — a disabled module was still fully
// reachable by typing its URL directly. This closes that gap the same
// way Rt46AdminGuard closes it for the /rt46/* persona split: one guard
// on the route, not a check sprinkled into each page component.
//
// org.manage_settings is the same permission OrgSettings itself checks
// before letting someone toggle enabled_modules — the CTA here only
// appears for someone who could actually act on it.
export function ModuleGuard({ moduleKey }: { moduleKey: string }) {
  const { data: org, isLoading } = useOrganisation();
  const { can } = usePermissions();

  if (isLoading) {
    return (
      <div className="px-4 pt-6">
        <SkeletonCard />
      </div>
    );
  }

  const moduleEnabled = isModuleEnabled(org?.enabled_modules, moduleKey);
  const roleCfg = getRoleConfig(org?.role as any);
  const roleAllows = Array.isArray(roleCfg?.allowedModules)
    ? roleCfg.allowedModules.includes(moduleKey)
    : false;

  if (!moduleEnabled || !roleAllows) {
    const label = MODULE_LABELS[moduleKey as keyof typeof MODULE_LABELS] ?? moduleKey;
    const canManage = can('org.manage_settings');
    const reason = !moduleEnabled
      ? `This module is turned off for ${org?.organisation_name ?? 'your organisation'}.`
      : `Your role (${org?.role ?? 'unknown'}) does not permit access to this module.`;

    return (
      <div className="px-4 pt-6">
        <EmptyState
          icon={PackageX}
          title={`${label} access restricted`}
          description={
            canManage
              ? `${reason} You can enable or grant access from Organisation Settings.`
              : `${reason} Ask an organisation admin to enable access if this is unexpected.`
          }
          action={
            canManage ? (
              <Link to="/ops/admin/settings" className="btn-primary text-sm">
                Go to Settings
              </Link>
            ) : undefined
          }
        />
      </div>
    );
  }

  return <Outlet />;
}
