import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useOrganisation } from './useOrganisation';

// Mirrors public.drivers.status check constraint.
export type DriverStatus = 'active' | 'suspended' | 'inactive';

export const DRIVER_STATUSES: DriverStatus[] = ['active', 'suspended', 'inactive'];

export interface Driver {
  id: string;
  full_name: string;
  license_number: string | null;
  license_class: string | null;
  license_expiry: string | null;
  phone: string | null;
  status: DriverStatus;
  created_at: string;
}

export function useDrivers() {
  const { data: org } = useOrganisation();
  return useQuery({
    queryKey: ['ops', 'drivers', org?.organisation_id],
    enabled: !!org?.organisation_id,
    queryFn: async (): Promise<Driver[]> => {
      const { data, error } = await supabase
        .from('drivers')
        .select('id, full_name, license_number, license_class, license_expiry, phone, status, created_at')
        .eq('organisation_id', org!.organisation_id)
        .order('full_name');
      if (error) throw error;
      return data as unknown as Driver[];
    },
  });
}

export function useDriver(id: string | undefined) {
  return useQuery({
    queryKey: ['ops', 'driver', id],
    enabled: !!id,
    queryFn: async (): Promise<Driver> => {
      const { data, error } = await supabase
        .from('drivers')
        .select('id, full_name, license_number, license_class, license_expiry, phone, status, created_at')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as unknown as Driver;
    },
  });
}

// Drivers whose license_expiry is within the next 30 days (or already
// expired) -- surfaced on the dashboard the same way maintenance_due and
// expiring_documents already are, so a lapsed license doesn't just sit
// unnoticed until a roadside stop.
export function useExpiringDriverLicenses() {
  const { data: org } = useOrganisation();
  return useQuery({
    queryKey: ['ops', 'drivers-license-expiry', org?.organisation_id],
    enabled: !!org?.organisation_id,
    queryFn: async (): Promise<Driver[]> => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + 30);
      const { data, error } = await supabase
        .from('drivers')
        .select('id, full_name, license_number, license_class, license_expiry, phone, status, created_at')
        .eq('organisation_id', org!.organisation_id)
        .eq('status', 'active')
        .not('license_expiry', 'is', null)
        .lte('license_expiry', cutoff.toISOString().slice(0, 10))
        .order('license_expiry');
      if (error) throw error;
      return data as unknown as Driver[];
    },
  });
}

export function useCreateDriver() {
  const { data: org } = useOrganisation();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      full_name: string;
      license_number?: string;
      license_class?: string;
      license_expiry?: string;
      phone?: string;
    }) => {
      const { data, error } = await supabase
        .from('drivers')
        .insert({ ...input, organisation_id: org!.organisation_id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ops', 'drivers'] });
      qc.invalidateQueries({ queryKey: ['ops', 'drivers-license-expiry'] });
    },
  });
}

export function useUpdateDriver() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      full_name?: string;
      license_number?: string;
      license_class?: string;
      license_expiry?: string;
      phone?: string;
      status?: DriverStatus;
    }) => {
      const { id, ...rest } = input;
      const { data, error } = await supabase.from('drivers').update(rest).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['ops', 'drivers'] });
      qc.invalidateQueries({ queryKey: ['ops', 'driver', data.id] });
      qc.invalidateQueries({ queryKey: ['ops', 'drivers-license-expiry'] });
    },
  });
}
