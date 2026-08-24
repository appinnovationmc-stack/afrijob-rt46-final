import { Link } from 'react-router-dom';
import { Users, Mail, Shield, History, Settings, ArrowRight } from 'lucide-react';
import { useOrgMembers, useOrgInvitations } from '@/hooks/useTeam';
import { useOrganisation } from '@/hooks/useOrganisation';
import { useAuditLog } from '@/hooks/useAuditLog';
import { SkeletonCard } from '@/components/ui/SkeletonCard';

// An org admin's job is administering the organisation itself, not
// operations — team composition, pending invites, permissions, audit
// oversight, and org-level settings. This intentionally does NOT surface
// work orders/incidents/inventory: that's what OpsDashboard (the default
// view every other role still gets) already covers, and this role can
// always navigate there too. Kept as a hub linking into the existing
// full pages (Team, PermissionMatrix, AuditLog, OrgSettings) rather than
// re-rendering their content here.
export default function OrgAdminDashboard() {
  const { data: org } = useOrganisation();
  const { data: members, isLoading: membersLoading } = useOrgMembers();
  const { data: invitations, isLoading: invitesLoading } = useOrgInvitations();
  const { data: recentAudit, isLoading: auditLoading } = useAuditLog({}, 0);

  const pendingInvites = (invitations ?? []).filter((i) => i.status === 'pending');
  const isLoading = membersLoading || invitesLoading || auditLoading;

  return (
    <div className="px-4 pt-6 pb-6">
      <div className="mb-6">
        <p className="text-gray-500 dark:text-gray-400 text-sm flex items-center gap-1.5">
          <Shield className="w-4 h-4" /> Organisation Administrator
        </p>
        <h1 className="font-heading font-bold text-2xl">{org?.organisation_name ?? 'Organisation'}</h1>
      </div>

      {isLoading ? (
        <div className="space-y-2"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
      ) : (
        <div className="space-y-2">
          <AdminLink
            to="/ops/admin/team"
            icon={Users}
            title="Team"
            detail={`${members?.length ?? 0} member${members?.length === 1 ? '' : 's'}`}
          />
          <AdminLink
            to="/ops/admin/team"
            icon={Mail}
            title="Pending invitations"
            detail={pendingInvites.length > 0 ? `${pendingInvites.length} awaiting response` : 'None pending'}
            highlight={pendingInvites.length > 0}
          />
          <AdminLink to="/ops/admin/permissions" icon={Shield} title="Permission Matrix" detail="Role-by-permission configuration" />
          <AdminLink
            to="/ops/admin/audit"
            icon={History}
            title="Audit Log"
            detail={`${recentAudit?.entries.length ?? 0} recent event${(recentAudit?.entries.length ?? 0) === 1 ? '' : 's'}`}
          />
          <AdminLink to="/ops/admin/settings" icon={Settings} title="Organisation Settings" detail="Industry mode, enabled modules, billing" />
        </div>
      )}
    </div>
  );
}

function AdminLink({
  to, icon: Icon, title, detail, highlight,
}: {
  to: string; icon: React.ComponentType<{ className?: string }>; title: string; detail: string; highlight?: boolean;
}) {
  return (
    <Link to={to} className="card !py-3 flex items-center gap-3">
      <div className="w-9 h-9 rounded-full bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-brand" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-sm">{title}</p>
        <p className={`text-xs ${highlight ? 'text-warning font-medium' : 'text-gray-500 dark:text-gray-400'}`}>{detail}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-gray-300 shrink-0" />
    </Link>
  );
}
