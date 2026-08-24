import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// Every hook here relies on RLS, not an app-level check, to actually gate
// access: the organisations_select_platform_admin and
// billing_accounts_select_platform_admin policies only return rows if
// is_platform_admin() is true for the calling user. A non-admin calling
// these gets an empty result, not an error — same as any other RLS-scoped
// query in this codebase.
export function useIsPlatformAdmin() {
  return useQuery({
    queryKey: ['platform', 'is-admin'],
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.rpc('is_platform_admin');
      if (error) throw error;
      return !!data;
    },
  });
}

export interface PlatformOrg {
  id: string;
  name: string;
  slug: string;
  industry_mode: string;
  created_at: string;
  billing_status: string | null;
  billing_plan: string | null;
  trial_ends_at: string | null;
}

export function usePlatformOrganisations() {
  const { data: isAdmin } = useIsPlatformAdmin();
  return useQuery({
    queryKey: ['platform', 'organisations'],
    enabled: !!isAdmin,
    queryFn: async (): Promise<PlatformOrg[]> => {
      const { data: orgs, error } = await supabase
        .from('organisations')
        .select('id, name, slug, industry_mode, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const { data: billing } = await supabase
        .from('billing_accounts')
        .select('organisation_id, status, plan, trial_ends_at');
      const billingByOrg = new Map((billing ?? []).map((b) => [b.organisation_id, b]));

      return (orgs ?? []).map((o) => {
        const b = billingByOrg.get(o.id);
        return {
          ...o,
          billing_status: b?.status ?? null,
          billing_plan: b?.plan ?? null,
          trial_ends_at: b?.trial_ends_at ?? null,
        };
      });
    },
  });
}

export const BILLING_STATUS_META: Record<string, { label: string; className: string }> = {
  trial: { label: 'Trial', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' },
  active: { label: 'Active', className: 'bg-success/15 text-success' },
  past_due: { label: 'Past Due', className: 'bg-warning/15 text-warning' },
  cancelled: { label: 'Cancelled', className: 'bg-danger/15 text-danger' },
};
