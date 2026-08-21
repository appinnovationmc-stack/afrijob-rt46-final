import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { OrganisationRole, Permission, RolePermission } from '@/lib/afriops/types';

export type { Permission, RolePermission };

// role_permissions and permissions have NO organisation_id column — this is
// one global RBAC table shared by every organisation on the platform, not
// per-tenant config (confirmed against the live schema before building
// this). Gate this screen at owner level, not org.manage_settings: an org
// admin changing a role's permissions here would change that role for
// every organisation, not just their own.

export function usePermissionCatalogue() {
  return useQuery({
    queryKey: ['platform', 'permissions'],
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<Permission[]> => {
      const { data, error } = await supabase.from('permissions').select('code, module, description').order('module');
      if (error) throw error;
      return data;
    },
  });
}

export function useRolePermissions() {
  return useQuery({
    queryKey: ['platform', 'role-permissions'],
    staleTime: 60_000,
    queryFn: async (): Promise<RolePermission[]> => {
      const { data, error } = await supabase.from('role_permissions').select('role, permission_code, granted');
      if (error) throw error;
      return data as RolePermission[];
    },
  });
}

export function useSetRolePermission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { role: OrganisationRole; permission_code: string; granted: boolean }) => {
      const { data, error } = await supabase
        .from('role_permissions')
        .upsert(input, { onConflict: 'role,permission_code' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform', 'role-permissions'] }),
  });
}
