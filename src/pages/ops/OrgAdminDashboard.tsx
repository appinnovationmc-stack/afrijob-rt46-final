import { Shield } from 'lucide-react';
import { useOrganisation } from '@/hooks/useOrganisation';
import { AdminLinksSection } from '@/components/layout/AdminLinksSection';

// An org admin's job is administering the organisation itself, not
// operations — team composition, pending invites, permissions, audit
// oversight, and org-level settings. This intentionally does NOT surface
// work orders/incidents/inventory: that's what OpsDashboard (the default
// view every other role still gets) already covers, and this role can
// always navigate there too. The actual links live in AdminLinksSection
// (shared with ExecutiveDashboard) rather than being duplicated here.
export default function OrgAdminDashboard() {
  const { data: org } = useOrganisation();

  return (
    <div className="px-4 pt-6 pb-6">
      <div className="mb-6">
        <p className="text-gray-500 dark:text-gray-400 text-sm flex items-center gap-1.5">
          <Shield className="w-4 h-4" /> Organisation Administrator
        </p>
        <h1 className="font-heading font-bold text-2xl">{org?.organisation_name ?? 'Organisation'}</h1>
      </div>

      <AdminLinksSection />
    </div>
  );
}
