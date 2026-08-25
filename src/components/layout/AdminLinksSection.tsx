import { Link } from 'react-router-dom';
import { Users, Mail, Shield, History, Settings, ShieldAlert, ArrowRight, CreditCard, Key, Truck } from 'lucide-react';
import { useOrgMembers, useOrgInvitations } from '@/hooks/useTeam';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useIsPlatformAdmin, BILLING_STATUS_META } from '@/hooks/useSuperAdmin';
import { useBillingAccount } from '@/hooks/useBillingAccount';
import { usePermissions } from '@/hooks/useOrganisation';
import { SkeletonCard } from '@/components/ui/SkeletonCard';

// Every organisation-administration entry point in one place, so it can
// be dropped into any role's dashboard rather than only existing inside
// OrgAdminDashboard. Previously 'owner' — the highest-privilege role —
// had no in-app path to Team/Billing/Settings/etc at all, because those
// links only lived on the 'admin' role's dashboard and nothing else
// referenced them. Fixed by making this reusable and rendering it from
// both OrgAdminDashboard and ExecutiveDashboard.
export function AdminLinksSection() {
  const { data: members, isLoading: membersLoading } = useOrgMembers();
  const { data: invitations, isLoading: invitesLoading } = useOrgInvitations();
  const { data: recentAudit, isLoading: auditLoading } = useAuditLog({}, 0);
  const { data: isPlatformAdmin } = useIsPlatformAdmin();
  const { data: billing, isLoading: billingLoading } = useBillingAccount();
  const { can } = usePermissions();

  const pendingInvites = (invitations ?? []).filter((i) => i.status === 'pending');
  const isLoading = membersLoading || invitesLoading || auditLoading || billingLoading;

  if (isLoading) {
    return <div className="space-y-2"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>;
  }

  return (
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
      <AdminLink to="/ops/admin/settings" icon={Settings} title="Organisation Settings" detail="Industry mode, enabled modules" />
      <AdminLink
        to="/ops/admin/billing"
        icon={CreditCard}
        title="Billing"
        detail={billing ? `${billing.plan} · ${BILLING_STATUS_META[billing.status]?.label ?? billing.status}` : 'No billing account'}
      />
      <AdminLink to="/ops/admin/api-keys" icon={Key} title="API Keys" detail="External system integrations" />
      {can('serviceproviders.view') && (
        <AdminLink to="/ops/admin/service-providers" icon={Truck} title="Service Providers" detail="External workshops and their capabilities" />
      )}
      {isPlatformAdmin && (
        <AdminLink to="/ops/admin/super-admin" icon={ShieldAlert} title="Platform Administration" detail="Cross-organisation visibility" />
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
