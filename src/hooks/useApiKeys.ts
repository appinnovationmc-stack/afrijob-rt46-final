import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useOrganisation } from './useOrganisation';
import type { Database } from '@/types/database.types';

// key_hash is intentionally not selected here - the list view has no use
// for it (see useBillingAccount.ts / api_keys RLS comment for why leaving
// it selectable via RLS at all is still low-risk; not selecting it here
// is just not sending bytes the UI never renders).
export type ApiKeySummary = Pick<
  Database['public']['Tables']['api_keys']['Row'],
  'id' | 'name' | 'key_prefix' | 'scopes' | 'last_used_at' | 'revoked_at' | 'created_at'
>;

export const API_KEY_SCOPES = ['work_orders:read', 'costs:write'] as const;
export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

export const API_KEY_SCOPE_LABELS: Record<ApiKeyScope, string> = {
  'work_orders:read': 'Read work orders',
  'costs:write': 'Write work order costs',
};

export function useApiKeys() {
  const { data: org } = useOrganisation();
  return useQuery({
    queryKey: ['ops', 'api-keys', org?.organisation_id],
    enabled: !!org?.organisation_id,
    queryFn: async (): Promise<ApiKeySummary[]> => {
      const { data, error } = await supabase
        .from('api_keys')
        .select('id, name, key_prefix, scopes, last_used_at, revoked_at, created_at')
        .eq('organisation_id', org!.organisation_id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

// Returns the raw key exactly once - the caller (CreateApiKeyDialog) is
// responsible for showing it to the admin and making clear it won't be
// retrievable again. Nothing in this hook or the DB ever stores it.
export function useCreateApiKey() {
  const { data: org } = useOrganisation();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, scopes }: { name: string; scopes: ApiKeyScope[] }) => {
      if (!org?.organisation_id) throw new Error('no active organisation');
      const { data, error } = await supabase.rpc('create_api_key', {
        p_organisation_id: org.organisation_id,
        p_name: name,
        p_scopes: scopes,
      });
      if (error) throw error;
      // create_api_key is declared RETURNS TABLE, so the client gets an
      // array back even though it's always exactly one row.
      const row = Array.isArray(data) ? data[0] : data;
      return row as { id: string; raw_key: string; key_prefix: string };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ops', 'api-keys'] }),
  });
}

export function useRevokeApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (keyId: string) => {
      const { error } = await supabase.rpc('revoke_api_key', { p_key_id: keyId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ops', 'api-keys'] }),
  });
}
