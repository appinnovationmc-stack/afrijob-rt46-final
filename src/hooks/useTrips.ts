import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useOrganisation } from './useOrganisation';
import { offlineDb } from '@/lib/offlineDb';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

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

function localTrip(input: { id: string; asset_id: string; driver_id?: string; start_odometer?: number; start_location?: string; purpose?: string; started_at: string }): Trip {
  return {
    id: input.id,
    asset_id: input.asset_id,
    driver_id: input.driver_id ?? null,
    driver: null,
    started_at: input.started_at,
    ended_at: null,
    start_odometer: input.start_odometer ?? null,
    end_odometer: null,
    start_location: input.start_location ?? null,
    end_location: null,
    purpose: input.purpose ?? null,
    status: 'in_progress',
  };
}

export function useStartTrip() {
  const { data: org } = useOrganisation();
  const qc = useQueryClient();
  const online = useNetworkStatus();
  return useMutation({
    mutationFn: async (input: {
      asset_id: string;
      driver_id?: string;
      start_odometer?: number;
      start_location?: string;
      purpose?: string;
    }) => {
      if (!org?.organisation_id) throw new Error('No active organisation selected.');
      const id = crypto.randomUUID();
      const startedAt = new Date().toISOString();
      if (!online) {
        const trip = localTrip({ id, ...input, started_at: startedAt });
        await offlineDb.queuedOpsTripMutations.add({
          localId: `local:${crypto.randomUUID()}`,
          action: 'start',
          tripId: id,
          organisationId: org.organisation_id,
          assetId: input.asset_id,
          ...(input.driver_id ? { driverId: input.driver_id } : {}),
          ...(input.start_odometer !== undefined ? { startOdometer: input.start_odometer } : {}),
          ...(input.start_location ? { startLocation: input.start_location } : {}),
          ...(input.purpose ? { purpose: input.purpose } : {}),
          startedAt,
          createdAt: startedAt,
          synced: false,
        });
        return trip;
      }
      const { data, error } = await supabase
        .from('trips')
        .insert({ id, ...input, organisation_id: org.organisation_id, status: 'in_progress' as TripStatus, started_at: startedAt })
        .select(TRIP_SELECT)
        .single();
      if (error) throw error;
      return data as unknown as Trip;
    },
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: ['ops', 'asset-trips', vars.asset_id] });
      qc.invalidateQueries({ queryKey: ['ops', 'active-trip', vars.asset_id] });
      if (!online) {
        const existing = qc.getQueryData<Trip[]>(['ops', 'asset-trips', vars.asset_id]) ?? [];
        qc.setQueryData(['ops', 'asset-trips', vars.asset_id], [data, ...existing]);
        qc.setQueryData(['ops', 'active-trip', vars.asset_id], data);
      }
    },
  });
}

export function useEndTrip() {
  const { data: org } = useOrganisation();
  const qc = useQueryClient();
  const online = useNetworkStatus();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      asset_id: string;
      end_odometer?: number;
      end_location?: string;
      status?: Extract<TripStatus, 'completed' | 'cancelled'>;
    }) => {
      if (!org?.organisation_id) throw new Error('No active organisation selected.');
      const endedAt = new Date().toISOString();
      const nextStatus = input.status ?? 'completed';
      if (!online) {
        await offlineDb.queuedOpsTripMutations.add({
          localId: `local:${crypto.randomUUID()}`,
          action: 'end',
          tripId: input.id,
          organisationId: org.organisation_id,
          assetId: input.asset_id,
          ...(input.end_odometer !== undefined ? { endOdometer: input.end_odometer } : {}),
          ...(input.end_location ? { endLocation: input.end_location } : {}),
          status: nextStatus,
          endedAt,
          createdAt: endedAt,
          synced: false,
        });
        const existing = qc.getQueryData<Trip[]>(['ops', 'asset-trips', input.asset_id]) ?? [];
        const updated = existing.map((trip) => trip.id === input.id ? { ...trip, end_odometer: input.end_odometer ?? trip.end_odometer, end_location: input.end_location ?? trip.end_location, ended_at: endedAt, status: nextStatus } : trip);
        const current = updated.find((trip) => trip.id === input.id) ?? null;
        return current;
      }
      const { id, asset_id, ...rest } = input;
      const { data, error } = await supabase
        .from('trips')
        .update({ ...rest, status: nextStatus, ended_at: endedAt })
        .eq('id', id)
        .eq('organisation_id', org.organisation_id)
        .select(TRIP_SELECT)
        .single();
      if (error) throw error;
      return data as unknown as Trip;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['ops', 'asset-trips', vars.asset_id] });
      qc.invalidateQueries({ queryKey: ['ops', 'active-trip', vars.asset_id] });
    },
  });
}
