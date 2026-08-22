import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useOrganisation } from './useOrganisation';
import * as sla from '@/lib/afriops/slaEngine';
import type { WorkOrderPriority } from '@/lib/afriops/types';

export function useSlaPolicies() {
  const { data: org } = useOrganisation();
  return useQuery({
    queryKey: ['ops', 'sla-policies', org?.organisation_id],
    enabled: !!org?.organisation_id,
    queryFn: () => sla.listSlaPolicies(supabase, org!.organisation_id),
  });
}

export function useSlaPolicyTargets(policyId: string | undefined) {
  return useQuery({
    queryKey: ['ops', 'sla-policy-targets', policyId],
    enabled: !!policyId,
    queryFn: () => sla.listSlaPolicyTargets(supabase, policyId!),
  });
}

export function useCreateSlaPolicy() {
  const { data: org } = useOrganisation();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      name,
      category,
      targets,
    }: {
      name: string;
      category?: string;
      targets: { priority: WorkOrderPriority; response_minutes: number; resolution_minutes: number }[];
    }) => sla.createSlaPolicy(supabase, { organisation_id: org!.organisation_id, name, category: category ?? null } as any, targets),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ops', 'sla-policies'] }),
  });
}

export function useSetSlaPolicyActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ policyId, active }: { policyId: string; active: boolean }) => sla.setSlaPolicyActive(supabase, policyId, active),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ops', 'sla-policies'] }),
  });
}

export function useOpenSlaBreaches() {
  const { data: org } = useOrganisation();
  return useQuery({
    queryKey: ['ops', 'sla-breaches', org?.organisation_id],
    enabled: !!org?.organisation_id,
    refetchInterval: 60_000,
    queryFn: () => sla.listOpenBreaches(supabase, org!.organisation_id),
  });
}

export function useAcknowledgeBreach() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (breachId: string) => sla.acknowledgeBreach(supabase, breachId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ops', 'sla-breaches'] }),
  });
}

export function useRunSlaBreachSweep() {
  const { data: org } = useOrganisation();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => sla.runSlaBreachSweep(supabase, org!.organisation_id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ops', 'sla-breaches'] }),
  });
}

export function useSlaTargetForWorkOrder(workOrderId: string | undefined) {
  return useQuery({
    queryKey: ['ops', 'sla-target', workOrderId],
    enabled: !!workOrderId,
    queryFn: () => sla.getSlaTargetForWorkOrder(supabase, workOrderId!),
  });
}

export {
  minutesRemaining,
  isAtRisk,
  isPastDue,
  SLA_STATUS_COLOR,
  PRIORITY_WEIGHT,
} from '@/lib/afriops/slaEngine';
export type { SlaPolicy, SlaPolicyTarget, SlaTarget, SlaBreach, SlaBreachStatus, SlaMetric } from '@/lib/afriops/slaEngine';
