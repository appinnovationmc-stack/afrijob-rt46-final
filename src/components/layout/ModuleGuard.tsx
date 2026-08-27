import { Link, Outlet } from 'react-router-dom';
import { PackageX } from 'lucide-react';
import { useOrganisation, usePermissions, isModuleEnabled } from '@/hooks/useOrganisation';
import { MODULE_LABELS } from '@/hooks/useOrgSettings';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { roleCanAccessModule } from '@/lib/roleAccess';

export function ModuleGuard({ moduleKey }: { moduleKey: string }) {
  const { data: org, isLoading } = useOrganisation();
  const { can } = usePermissions();

  if (isLoading) return <div className="px-4 pt-6"><SkeletonCard /></div>;
  if (!org) return <div className="px-4 pt-6"><EmptyState icon={PackageX} title="No organisation found" description="Your account isn't linked to an organisation yet." /></div>;

  const label = MODULE_LABELS[moduleKey as keyof typeof MODULE_LABELS] ?? moduleKey;
  const roleAllowed = roleCanAccessModule(org.role, moduleKey);
  const moduleEnabled = isModuleEnabled(org.enabled_modules, moduleKey);

  if (!roleAllowed) {
    return <div className="px-4 pt-6"><EmptyState icon={PackageX} title="Access restricted" description={`Your ${org.role.replaceAll('_', ' ')} role does not have access to ${label}.`} /></div>;
  }

  if (!moduleEnabled) {
    const canManage = can('org.manage_settings');
    return (
      <div className="px-4 pt-6">
        <EmptyState icon={PackageX} title={`${label} isn't enabled`} description={canManage ? `This module is turned off for ${org.organisation_name}. You can enable it from Organisation Settings.` : `This module is turned off for ${org.organisation_name}. Ask an organisation admin to enable it.`} action={canManage ? <Link to="/ops/admin/settings" className="btn-primary text-sm">Go to Settings</Link> : undefined} />
      </div>
    );
  }

  return <Outlet />;
}
