import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// Single read surface for "everything used on this work order / asset"
// regardless of whether it was recorded via the legacy per-job Parts &
// Labour form (job_parts) or the Ops inventory module (inventory_movements).
// Backed by the public.work_order_parts_unified view — see migrations
// unify_parts_job_parts_and_inventory_movements and
// add_asset_id_to_work_order_parts_unified_v2.
export function useWorkOrderParts(workOrderId: string | undefined) {
  return useQuery({
    queryKey: ['work-order-parts-unified', workOrderId],
    enabled: !!workOrderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_order_parts_unified')
        .select('*')
        .eq('work_order_id', workOrderId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

// Same view, filtered by asset instead of a single work order — feeds the
// Asset 360 Parts tab, which needs the full parts history across every
// work order ever logged against the asset.
export function useAssetParts(assetId: string | undefined) {
  return useQuery({
    queryKey: ['asset-parts-unified', assetId],
    enabled: !!assetId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_order_parts_unified')
        .select('*')
        .eq('asset_id', assetId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

