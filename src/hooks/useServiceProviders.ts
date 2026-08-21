import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useOrganisation } from './useOrganisation';

// Mirrors public.service_providers.primary_type / service_provider_capabilities.capability
export type ServiceProviderType =
  | 'workshop' | 'contractor' | 'maintenance_provider' | 'supplier' | 'technician_org' | 'other';

export type ServiceProviderStatus = 'pending_onboarding' | 'active' | 'suspended' | 'terminated';

export const SERVICE_PROVIDER_TYPES: ServiceProviderType[] = [
  'workshop', 'contractor', 'maintenance_provider', 'supplier', 'technician_org', 'other',
];

export const SERVICE_PROVIDER_STATUSES: ServiceProviderStatus[] = [
  'pending_onboarding', 'active', 'suspended', 'terminated',
];

export interface ServiceProvider {
  id: string;
  trading_name: string;
  legal_name: string | null;
  registration_number: string | null;
  primary_type: ServiceProviderType;
  status: ServiceProviderStatus;
  contact_email: string | null;
  contact_phone: string | null;
  regions: string[];
  created_at: string;
}

export interface ServiceProviderCapability {
  id: string;
  service_provider_id: string;
  capability: ServiceProviderType;
  service_category: string | null;
}

// ---------- list / detail ----------

export function useServiceProviders() {
  const { data: org } = useOrganisation();
  return useQuery({
    queryKey: ['ops', 'service-providers', org?.organisation_id],
    enabled: !!org?.organisation_id,
    queryFn: async (): Promise<ServiceProvider[]> => {
      const { data, error } = await supabase
        .from('service_providers')
        .select('id, trading_name, legal_name, registration_number, primary_type, status, contact_email, contact_phone, regions, created_at')
        .eq('organisation_id', org!.organisation_id)
        .order('trading_name');
      if (error) throw error;
      return data;
    },
  });
}

export function useServiceProvider(id: string | undefined) {
  return useQuery({
    queryKey: ['ops', 'service-provider', id],
    enabled: !!id,
    queryFn: async (): Promise<ServiceProvider> => {
      const { data, error } = await supabase
        .from('service_providers')
        .select('id, trading_name, legal_name, registration_number, primary_type, status, contact_email, contact_phone, regions, created_at')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

// ---------- capabilities ----------

export function useServiceProviderCapabilities(serviceProviderId: string | undefined) {
  return useQuery({
    queryKey: ['ops', 'service-provider-capabilities', serviceProviderId],
    enabled: !!serviceProviderId,
    queryFn: async (): Promise<ServiceProviderCapability[]> => {
      const { data, error } = await supabase
        .from('service_provider_capabilities')
        .select('id, service_provider_id, capability, service_category')
        .eq('service_provider_id', serviceProviderId!)
        .order('capability');
      if (error) throw error;
      return data;
    },
  });
}

export function useAddCapability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { service_provider_id: string; capability: ServiceProviderType; service_category?: string }) => {
      const { data, error } = await supabase
        .from('service_provider_capabilities')
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: ['ops', 'service-provider-capabilities', vars.service_provider_id] }),
  });
}

export function useRemoveCapability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; service_provider_id: string }) => {
      const { error } = await supabase.from('service_provider_capabilities').delete().eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: ['ops', 'service-provider-capabilities', vars.service_provider_id] }),
  });
}

// ---------- mutations ----------

export function useCreateServiceProvider() {
  const { data: org } = useOrganisation();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      trading_name: string;
      legal_name?: string;
      registration_number?: string;
      primary_type: ServiceProviderType;
      contact_email?: string;
      contact_phone?: string;
      regions?: string[];
    }) => {
      const { data, error } = await supabase
        .from('service_providers')
        .insert({ ...input, organisation_id: org!.organisation_id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ops', 'service-providers'] }),
  });
}

export function useUpdateServiceProviderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; status: ServiceProviderStatus }) => {
      const { data, error } = await supabase
        .from('service_providers')
        .update({ status: input.status })
        .eq('id', input.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['ops', 'service-providers'] });
      qc.invalidateQueries({ queryKey: ['ops', 'service-provider', data.id] });
    },
  });
}
