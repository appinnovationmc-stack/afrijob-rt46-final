import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useOrganisation, type IndustryMode } from './useOrganisation';
import type { Json } from '@/types/database.types';

// Every module key actually gated by isModuleEnabled() across the app today
// (see OpsDashboard NAV_ITEMS) plus 'rt46', which the live
// "RT46 Government Fleet Programme" organisation already has set in its
// enabled_modules ({"rt46": true}) — confirmed against production data
// before adding it here, not guessed.
export const ORG_MODULE_KEYS = [
  'inventory', 'procurement', 'documents', 'incidents', 'maintenance', 'sla', 'notifications', 'rt46',
] as const;
export type OrgModuleKey = (typeof ORG_MODULE_KEYS)[number];

export const MODULE_LABELS: Record<OrgModuleKey, string> = {
  inventory: 'Inventory',
  procurement: 'Procurement',
  documents: 'Document Vault',
  incidents: 'Incidents',
  maintenance: 'Preventive Maintenance',
  sla: 'SLA Tracking',
  notifications: 'Notifications',
  rt46: 'RT46 Fleet Marketplace',
};

export const INDUSTRY_MODES: IndustryMode[] = ['general', 'mining', 'fleet', 'municipal', 'government', 'logistics'];

// Writes enabled_modules using the keyed-object shape ({ moduleKey: bool })
// confirmed live in both existing organisations rows — the ambiguous
// "array of disabled keys" shape that isModuleEnabled() also tolerates is
// legacy-read-only; nothing should write it going forward.
export function useUpdateOrgSettings() {
  const { data: org } = useOrganisation();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { industry_mode?: IndustryMode; enabled_modules?: Record<string, boolean> }) => {
      const { data, error } = await supabase
        .from('organisations')
        .update(input as { industry_mode?: IndustryMode; enabled_modules?: Json })
        .eq('id', org!.organisation_id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ops', 'organisation-memberships'] }),
  });
}

export function useUpdateOrgName() {
  const { data: org } = useOrganisation();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from('organisations')
        .update({ name })
        .eq('id', org!.organisation_id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ops', 'organisation-memberships'] }),
  });
}
