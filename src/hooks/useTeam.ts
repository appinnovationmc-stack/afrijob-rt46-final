import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useOrganisation } from './useOrganisation';
import type { OrganisationRole } from '@/lib/afriops/types';

export interface OrgMember {
  id: string;
  profile_id: string;
  role: OrganisationRole;
  joined_at: string | null;
  invited_at: string;
  profile_name: string | null;
}

export function useOrgMembers() {
  const { data: org } = useOrganisation();
  return useQuery({
    queryKey: ['ops', 'org-members', org?.organisation_id],
    enabled: !!org?.organisation_id,
    queryFn: async (): Promise<OrgMember[]> => {
      const { data, error } = await supabase
        .from('organisation_members')
        .select('id, profile_id, role, joined_at, invited_at, profiles!organisation_members_profile_id_fkey(full_name)')
        .eq('organisation_id', org!.organisation_id)
        .order('invited_at');
      if (error) throw error;
      return (data ?? []).map((m: any) => ({
        id: m.id,
        profile_id: m.profile_id,
        role: m.role,
        joined_at: m.joined_at,
        invited_at: m.invited_at,
        profile_name: m.profiles?.full_name ?? null,
      }));
    },
  });
}

export function useSetMemberRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: OrganisationRole }) => {
      const { error } = await supabase.from('organisation_members').update({ role }).eq('id', memberId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ops', 'org-members'] }),
  });
}

export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase.from('organisation_members').delete().eq('id', memberId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ops', 'org-members'] }),
  });
}

export const ORG_ROLES: OrganisationRole[] = [
  'viewer',
  'contractor',
  'technician',
  'inspector',
  'member',
  'procurement_officer',
  'finance',
  'fleet_manager',
  'operations_manager',
  'supervisor',
  'manager',
  'admin',
  'owner',
];

// ---------- Invitations (pending, not-yet-registered users) ----------
// Note: this creates the pending-invite row and returns its token, which is
// enough for the org.manage_members flow to show/copy an invite link. It
// does NOT send an email — that requires a Supabase Edge Function calling
// an email provider, which needs to be deployed against the live project
// and isn't something this environment can do. See
// AFRIOPS_PRODUCTION_READINESS.md for the exact remaining step.

export interface OrgInvitation {
  id: string;
  email: string;
  role: OrganisationRole;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  token: string;
  created_at: string;
  expires_at: string;
}

export function useOrgInvitations() {
  const { data: org } = useOrganisation();
  return useQuery({
    queryKey: ['ops', 'org-invitations', org?.organisation_id],
    enabled: !!org?.organisation_id,
    queryFn: async (): Promise<OrgInvitation[]> => {
      const { data, error } = await supabase
        .from('organisation_invitations')
        .select('id, email, role, status, token, created_at, expires_at')
        .eq('organisation_id', org!.organisation_id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as OrgInvitation[];
    },
  });
}

export function useCreateInvitation() {
  const { data: org } = useOrganisation();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ email, role }: { email: string; role: OrganisationRole }) => {
      if (!org?.organisation_id) throw new Error('no active organisation');
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const { data, error } = await supabase
        .from('organisation_invitations')
        .insert({
          organisation_id: org.organisation_id,
          email: email.trim().toLowerCase(),
          role,
          invited_by: userData.user!.id,
        })
        .select('id, email, role, status, token, created_at, expires_at')
        .single();
      if (error) throw error;
      return data as OrgInvitation;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ops', 'org-invitations'] }),
  });
}

export function useRevokeInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await supabase
        .from('organisation_invitations')
        .update({ status: 'revoked' })
        .eq('id', invitationId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ops', 'org-invitations'] }),
  });
}

// Called right after signup/login when the URL carries an invite token
// (e.g. /accept-invite?token=...), to convert a pending invitation into
// real organisation membership for the now-authenticated user.
export function useAcceptInvitation() {
  return useMutation({
    mutationFn: async (token: string) => {
      const { data, error } = await supabase.rpc('accept_organisation_invitation', { p_token: token });
      if (error) throw error;
      return data;
    },
  });
}
