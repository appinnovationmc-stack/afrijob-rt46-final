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
// Creating an invitation (useCreateInvitation) just writes the pending
// row and returns its token - always available as a manual copy-link
// fallback. Actually emailing it (useSendInvitationEmail below) is a
// separate step via the send-invitation-email edge function, which uses
// Supabase Auth's built-in inviteUserByEmail - no third-party email
// provider is configured or available in this environment. See that
// edge function's source comments for the real constraints this comes
// with (Redirect URLs allow-list, Supabase's built-in email rate limit,
// "already registered" not being emailable this way).

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

export type SendInvitationEmailResult =
  | { sent: true }
  | { sent: false; reason: 'already_registered' | 'rate_limited'; message: string };

// Actually emails the invite via send-invitation-email (Supabase Auth's
// inviteUserByEmail under the hood). Distinguishes "genuinely failed"
// from two known, non-error outcomes the UI should treat as informational
// rather than a failure toast: the person already has an account (email
// can't go through this path - share the link directly instead), or
// Supabase's built-in email sending hit its rate limit (same fallback).
export function useSendInvitationEmail() {
  return useMutation({
    mutationFn: async (invitationId: string): Promise<SendInvitationEmailResult> => {
      const { data, error } = await supabase.functions.invoke('send-invitation-email', {
        body: { invitation_id: invitationId, redirect_origin: window.location.origin },
      });
      if (error) {
        // supabase-js wraps any non-2xx edge function response in a
        // generic FunctionsHttpError whose own .message is NOT the JSON
        // body the function actually returned ({ error: "..." }) - that
        // has to be read from error.context (the raw Response), or every
        // failure here would show a useless generic message instead of
        // the real reason (e.g. "This invitation is 'revoked', not
        // pending").
        let message = error.message;
        const ctx = (error as any)?.context;
        if (ctx && typeof ctx.json === 'function') {
          try {
            const body = await ctx.json();
            if (body?.error) message = body.error;
          } catch {
            // response body wasn't JSON - fall back to the generic message
          }
        }
        throw new Error(message);
      }
      return data as SendInvitationEmailResult;
    },
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
