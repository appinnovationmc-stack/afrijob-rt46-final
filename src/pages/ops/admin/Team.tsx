import { useState } from 'react';
import { Users, Info, Trash2, Copy, X } from 'lucide-react';
import {
  useOrgMembers, useSetMemberRole, useRemoveMember, ORG_ROLES,
  useOrgInvitations, useCreateInvitation, useRevokeInvitation,
} from '@/hooks/useTeam';
import { useOrganisation, usePermissions } from '@/hooks/useOrganisation';
import { useAuthStore } from '@/store/authStore';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToastStore } from '@/components/ui/Toast';
import { formatDate } from '@/lib/utils';

export default function Team() {
  const { data: org } = useOrganisation();
  const { data: members, isLoading } = useOrgMembers();
  const { data: invitations } = useOrgInvitations();
  const { can } = usePermissions();
  const setRole = useSetMemberRole();
  const remove = useRemoveMember();
  const createInvitation = useCreateInvitation();
  const revokeInvitation = useRevokeInvitation();
  const push = useToastStore((s) => s.push);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const canManage = can('org.manage_members');

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<(typeof ORG_ROLES)[number]>('member');
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);

  const pendingInvitations = (invitations ?? []).filter((i) => i.status === 'pending');

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    try {
      const invite = await createInvitation.mutateAsync({ email: inviteEmail, role: inviteRole });
      const link = `${window.location.origin}/accept-invite?token=${invite.token}`;
      setLastInviteLink(link);
      setInviteEmail('');
      push('Invite created — copy the link below to send it', 'success');
    } catch (err: any) {
      push(err.message ?? 'Failed to create invite', 'error');
    }
  }

  async function copyLink(token: string) {
    const link = `${window.location.origin}/accept-invite?token=${token}`;
    try {
      await navigator.clipboard.writeText(link);
      push('Invite link copied', 'success');
    } catch {
      setLastInviteLink(link); // fall back to showing it for manual copy
    }
  }

  return (
    <div className="px-4 pt-6 pb-24">
      <h1 className="font-heading font-bold text-2xl mb-1">Team & Roles</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        {org?.organisation_name ?? 'Organisation'} members and their access level.
      </p>

      <div className="card mb-4 flex gap-2.5 items-start bg-blue-50 dark:bg-blue-950/30 border-none">
        <Info className="w-4 h-4 text-blue-600 dark:text-blue-300 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 dark:text-blue-300">
          Inviting someone creates a link below that you copy and send yourself (WhatsApp, email, etc.) — automatic
          invite emails aren't wired up yet. Whoever opens the link signs up (or signs in) and is added automatically.
        </p>
      </div>

      {canManage && (
        <div className="card mb-4">
          <p className="font-semibold text-sm mb-3">Invite someone</p>
          <form onSubmit={handleInvite} className="flex flex-col gap-2">
            <input
              type="email"
              required
              placeholder="their@email.com"
              className="input"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
            <div className="flex gap-2">
              <select
                className="input flex-1 !py-2"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as (typeof ORG_ROLES)[number])}
              >
                {ORG_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <button type="submit" className="btn-primary !py-2 !px-4" disabled={createInvitation.isPending}>
                Invite
              </button>
            </div>
          </form>
          {lastInviteLink && (
            <div className="mt-3 flex items-center gap-2 bg-gray-50 dark:bg-gray-900 rounded-lg px-3 py-2">
              <p className="text-xs font-mono truncate flex-1">{lastInviteLink}</p>
              <button
                type="button"
                className="btn-secondary !py-1 !px-2"
                onClick={async () => {
                  await navigator.clipboard.writeText(lastInviteLink);
                  push('Copied', 'success');
                }}
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button type="button" className="btn-secondary !py-1 !px-2" onClick={() => setLastInviteLink(null)}>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {canManage && pendingInvitations.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
            Pending invites
          </p>
          <div className="space-y-2">
            {pendingInvitations.map((inv) => (
              <div key={inv.id} className="card flex items-center justify-between !py-3">
                <div>
                  <p className="text-sm font-medium">{inv.email}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {inv.role} · expires {formatDate(inv.expires_at)}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <button className="btn-secondary !py-1.5 !px-2.5" onClick={() => copyLink(inv.token)}>
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    className="btn-secondary !py-1.5 !px-2.5 !text-danger"
                    disabled={revokeInvitation.isPending}
                    onClick={async () => {
                      try {
                        await revokeInvitation.mutateAsync(inv.id);
                        push('Invite revoked', 'success');
                      } catch (err: any) {
                        push(err.message ?? 'Failed to revoke invite', 'error');
                      }
                    }}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <SkeletonCard key={i} />)}</div>
      ) : !members?.length ? (
        <EmptyState icon={Users} title="No members found" />
      ) : (
        <div className="space-y-3">
          {members.map((m) => {
            const isSelf = m.profile_id === currentUserId;
            return (
              <div key={m.id} className="card">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-sm">{m.profile_name ?? 'Unnamed member'}{isSelf ? ' (you)' : ''}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {m.joined_at ? `Joined ${formatDate(m.joined_at)}` : 'Invitation pending'}
                    </p>
                  </div>
                </div>
                {canManage ? (
                  <div className="flex gap-2 items-center pt-2 border-t border-gray-100 dark:border-gray-800">
                    <select
                      className="input flex-1 !py-2"
                      value={m.role}
                      disabled={setRole.isPending || isSelf}
                      onChange={async (e) => {
                        try {
                          await setRole.mutateAsync({ memberId: m.id, role: e.target.value as any });
                          push('Role updated', 'success');
                        } catch (err: any) {
                          push(err.message ?? 'Failed to update role', 'error');
                        }
                      }}
                    >
                      {ORG_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    {!isSelf && (
                      <button
                        className="btn-secondary !py-2 !px-3 !text-danger"
                        disabled={remove.isPending}
                        onClick={async () => {
                          try {
                            await remove.mutateAsync(m.id);
                            push('Member removed', 'success');
                          } catch (err: any) {
                            push(err.message ?? 'Failed to remove member', 'error');
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-xs font-semibold capitalize text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-800">
                    {m.role}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
