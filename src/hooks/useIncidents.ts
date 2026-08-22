import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useOrganisation } from './useOrganisation';
import { useAuthStore } from '@/store/authStore';
import type { Incident, IncidentCategory, IncidentSeverity, IncidentStatus } from '@/lib/afriops/types';

export function useIncidents(status?: IncidentStatus) {
  const { data: org } = useOrganisation();
  return useQuery({
    queryKey: ['ops', 'incidents', org?.organisation_id, status],
    enabled: !!org?.organisation_id,
    queryFn: async () => {
      let query = supabase
        .from('incidents')
        .select('*')
        .eq('organisation_id', org!.organisation_id)
        .order('occurred_at', { ascending: false });
      if (status) query = query.eq('status', status);
      const { data, error } = await query;
      if (error) throw error;
      return data as Incident[];
    },
  });
}

export function useCreateIncident() {
  const { data: org } = useOrganisation();
  const userId = useAuthStore((s) => s.user?.id);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (incident: {
      category: IncidentCategory;
      severity: IncidentSeverity;
      description: string;
      occurred_at?: string;
      site_id?: string;
      asset_id?: string;
      latitude?: number;
      longitude?: number;
    }) => {
      const { data, error } = await supabase
        .from('incidents')
        .insert({
          ...incident,
          organisation_id: org!.organisation_id,
          reported_by: userId,
          occurred_at: incident.occurred_at ?? new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      return data as Incident;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ops', 'incidents'] }),
  });
}

export function useUpdateIncidentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ incidentId, status }: { incidentId: string; status: IncidentStatus }) => {
      const { error } = await supabase
        .from('incidents')
        .update({ status, ...(status === 'resolved' || status === 'closed' ? { resolved_at: new Date().toISOString() } : {}) })
        .eq('id', incidentId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ops', 'incidents'] }),
  });
}

export const INCIDENT_CATEGORY_LABELS: Record<IncidentCategory, string> = {
  breakdown: 'Breakdown',
  safety: 'Safety',
  accident: 'Accident',
  security: 'Security',
  environmental: 'Environmental',
  other: 'Other',
};

export const INCIDENT_SEVERITY_META: Record<IncidentSeverity, { label: string; className: string }> = {
  low: { label: 'Low', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' },
  medium: { label: 'Medium', className: 'bg-warning/15 text-warning' },
  high: { label: 'High', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200' },
  critical: { label: 'Critical', className: 'bg-danger/15 text-danger' },
};

export const INCIDENT_STATUS_META: Record<IncidentStatus, { label: string; className: string }> = {
  reported: { label: 'Reported', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' },
  investigating: { label: 'Investigating', className: 'bg-warning/15 text-warning' },
  resolved: { label: 'Resolved', className: 'bg-success/15 text-success' },
  closed: { label: 'Closed', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' },
};
