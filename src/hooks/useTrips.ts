import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useOrganisation } from './useOrganisation';

// Mirrors public.trips.status check constraint.
export type TripStatus = 'in_progress' | 'completed' | 'cancelled';

export interface Trip {
  id: string;
  asset_id: string;
  driver_id: string | null;
  driver: { id: string; full_name: string } | null;
  started_at: string;
  ended_at: string | null;
  start_odometer: number | null;
  end_odometer: number | null;
  start_location: string | null;
  end_location: string | null;
  purpose: string | null;
  status: TripStatus;
}

const TRIP_SELECT = 'id, asset_id, driver_id, driver:drivers(id, full_name), started_at, ended_at, start_odometer, end_odometer, start_location, end_location, purpose, status';

export function useAssetTrips(assetId: string | undefined) {
  return useQuery({
    queryKey: ['ops', 'asset-trips', assetId],
    enabled: !!assetId,
    queryFn: async (): Promise<Trip[]> => {
      const { data, error } = await supabase
        .from('trips')
        .select(TRIP_SELECT)
        .eq('asset_id', assetId!)
        .order('started_at', { ascending: false });
      if (error) throw error;
      return data as unknown as Trip[];
    },
  });
}

// The one open trip for an asset, if any -- an asset should only ever have
// a single in_progress trip at a time (enforced at the UI level here, not
// a DB constraint, since that's a business rule rather than a data
// integrity one).
export function useActiveTrip(assetId: string | undefined) {
  return useQuery({
    queryKey: ['ops', 'active-trip', assetId],
    enabled: !!assetId,
    queryFn: async (): Promise<Trip | null> => {
      const { data, error } = await supabase
        .from('trips')
        .select(TRIP_SELECT)
        .eq('asset_id', assetId!)
        .eq('status', 'in_progress')
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Trip | null;
    },
  });
}

export function useStartTrip() {
  const { data: org } = useOrganisation();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      asset_id: string;
      driver_id?: string;
      start_odometer?: number;
      start_location?: string;
      purpose?: string;
    }) => {
      const { data, error } = await supabase
        .from('trips')
        .insert({ ...input, organisation_id: org!.organisation_id, status: 'in_progress' as TripStatus })
        .select(TRIP_SELECT)
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['ops', 'asset-trips', vars.asset_id] });
      qc.invalidateQueries({ queryKey: ['ops', 'active-trip', vars.asset_id] });
    },
  });
}

export function useEndTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      asset_id: string;
      end_odometer?: number;
      end_location?: string;
      status?: Extract<TripStatus, 'completed' | 'cancelled'>;
    }) => {
      const { id, asset_id, ...rest } = input;
      const { data, error } = await supabase
        .from('trips')
        .update({ ...rest, status: rest.status ?? 'completed', ended_at: new Date().toISOString() })
        .eq('id', id)
        .select(TRIP_SELECT)
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['ops', 'asset-trips', vars.asset_id] });
      qc.invalidateQueries({ queryKey: ['ops', 'active-trip', vars.asset_id] });
    },
  });
}
