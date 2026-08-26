import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface GlobalSearchResult {
  entity_type:
    | 'asset'
    | 'work_order'
    | 'incident'
    | 'supplier'
    | 'service_provider'
    | 'document'
    | 'purchase_order'
    | 'maintenance_schedule'
    | 'rt46_merchant'
    | 'rt46_vehicle';
  entity_id: string;
  title: string;
  subtitle: string | null;
}

// Backed by the global_search() RPC (SECURITY INVOKER — runs as the calling
// user, so each underlying table's RLS applies exactly as if queried
// directly; no separate permission model here to drift out of sync).
export function useGlobalSearch(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: ['ops', 'global-search', trimmed],
    enabled: trimmed.length >= 2,
    queryFn: async (): Promise<GlobalSearchResult[]> => {
      const { data, error } = await supabase.rpc('global_search', { p_query: trimmed, p_limit: 6 });
      if (error) throw error;
      return (data ?? []) as GlobalSearchResult[];
    },
  });
}

// Entities without a per-record detail route (incident, supplier, document,
// purchase_order, maintenance_schedule, rt46_merchant, rt46_vehicle) link to
// their existing list/management page rather than a fabricated deep link —
// none of those routes exist in App.tsx yet. Only asset and work_order have
// :id detail routes today.
export const SEARCH_RESULT_HREF: Record<GlobalSearchResult['entity_type'], (id: string) => string> = {
  asset: (id) => `/ops/admin/assets/${id}`,
  work_order: (id) => `/ops/work-orders/${id}`,
  incident: () => '/ops/incidents',
  supplier: () => '/ops/procurement',
  service_provider: () => '/ops/admin/service-providers',
  document: () => '/ops/documents',
  purchase_order: () => '/ops/procurement',
  maintenance_schedule: () => '/ops/maintenance',
  rt46_merchant: () => '/rt46/merchants',
  rt46_vehicle: () => '/rt46/work-orders',
};

export const SEARCH_RESULT_TYPE_LABELS: Record<GlobalSearchResult['entity_type'], string> = {
  asset: 'Asset',
  work_order: 'Work Order',
  incident: 'Incident',
  supplier: 'Supplier',
  service_provider: 'Service Provider',
  document: 'Document',
  purchase_order: 'Purchase Order',
  maintenance_schedule: 'Maintenance',
  rt46_merchant: 'RT46 Merchant',
  rt46_vehicle: 'RT46 Vehicle',
};
