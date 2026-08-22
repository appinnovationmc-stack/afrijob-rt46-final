import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useOrganisation } from './useOrganisation';

export interface AssetOption {
  id: string;
  label: string;
}

export interface SiteOption {
  id: string;
  name: string;
}

export function useAssetOptions() {
  const { data: org } = useOrganisation();
  return useQuery({
    queryKey: ['ops', 'asset-options', org?.organisation_id],
    enabled: !!org?.organisation_id,
    queryFn: async (): Promise<AssetOption[]> => {
      const { data, error } = await supabase
        .from('assets')
        .select('id, asset_number, registration, manufacturer, model')
        .eq('organisation_id', org!.organisation_id)
        .order('asset_number', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []).map((a) => {
        const joined = [a.manufacturer, a.model].filter(Boolean).join(' ');
        const label = a.asset_number ?? a.registration ?? (joined || a.id.slice(0, 8));
        return { id: a.id, label };
      });
    },
  });
}

export function useSiteOptions() {
  const { data: org } = useOrganisation();
  return useQuery({
    queryKey: ['ops', 'site-options', org?.organisation_id],
    enabled: !!org?.organisation_id,
    queryFn: async (): Promise<SiteOption[]> => {
      const { data, error } = await supabase
        .from('sites')
        .select('id, name')
        .eq('organisation_id', org!.organisation_id)
        .order('name');
      if (error) throw error;
      return data as SiteOption[];
    },
  });
}
