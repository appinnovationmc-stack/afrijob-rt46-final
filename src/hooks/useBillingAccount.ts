import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useOrganisation } from './useOrganisation';
import type { Database } from '@/types/database.types';

export type BillingAccount = Database['public']['Tables']['billing_accounts']['Row'];

export const BILLING_PROVIDER_LABELS: Record<BillingAccount['provider'], string> = {
  none: 'No provider configured',
  usc_pay: 'USC Pay',
  stripe: 'Stripe',
  manual_invoice: 'Manual invoice',
};

// Read-only by design. billing_accounts_manage_admin (RLS) technically
// permits an org admin to UPDATE this row directly, but this app has no
// payment provider actually wired up (provider is 'none' on both live
// orgs) — a self-service "change my plan to active" control here would
// let any org admin grant their own organisation paid access for free.
// Real plan/status changes belong behind an actual provider integration
// (Stripe checkout webhook, USC Pay callback, or a platform-admin action
// in Super Admin) — none of which exist yet. Flagging that RLS gap
// rather than quietly building a form that exploits it.
export function useBillingAccount() {
  const { data: org } = useOrganisation();
  return useQuery({
    queryKey: ['ops', 'billing-account', org?.organisation_id],
    enabled: !!org?.organisation_id,
    staleTime: 60_000,
    queryFn: async (): Promise<BillingAccount | null> => {
      const { data, error } = await supabase
        .from('billing_accounts')
        .select('*')
        .eq('organisation_id', org!.organisation_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
