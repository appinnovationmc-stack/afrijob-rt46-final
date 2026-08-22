import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useOrganisation } from './useOrganisation';
import * as pm from '@/lib/afriops/preventiveMaintenance';
import type { WorkOrderPriority } from '@/lib/afriops/types';
import type { MaintenanceTriggerType } from '@/lib/afriops/preventiveMaintenance';

export function useMaintenanceSchedules(assetId?: string) {
  const { data: org } = useOrganisation();
  return useQuery({
    queryKey: ['ops', 'maintenance-schedules', org?.organisation_id, assetId],
    enabled: !!org?.organisation_id,
    queryFn: () => pm.listMaintenanceSchedules(supabase, org!.organisation_id, assetId),
  });
}

export function useDueMaintenanceSchedules(withinDays = 7) {
  const { data: org } = useOrganisation();
  return useQuery({
    queryKey: ['ops', 'maintenance-due', org?.organisation_id, withinDays],
    enabled: !!org?.organisation_id,
    queryFn: () => pm.listDueSchedules(supabase, org!.organisation_id, withinDays),
  });
}

export function useScheduleRuns(scheduleId: string | undefined) {
  return useQuery({
    queryKey: ['ops', 'maintenance-runs', scheduleId],
    enabled: !!scheduleId,
    queryFn: () => pm.listScheduleRuns(supabase, scheduleId!),
  });
}

export function useCreateMaintenanceSchedule() {
  const { data: org } = useOrganisation();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (schedule: {
      asset_id: string;
      name: string;
      trigger_type: MaintenanceTriggerType;
      description?: string;
      interval_value?: number;
      fixed_date?: string;
      default_priority?: WorkOrderPriority;
    }) => pm.createMaintenanceSchedule(supabase, { ...schedule, organisation_id: org!.organisation_id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ops', 'maintenance-schedules'] }),
  });
}

export function useSetMaintenanceScheduleActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ scheduleId, active }: { scheduleId: string; active: boolean }) =>
      pm.setMaintenanceScheduleActive(supabase, scheduleId, active),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ops', 'maintenance-schedules'] });
      qc.invalidateQueries({ queryKey: ['ops', 'maintenance-due'] });
    },
  });
}

export function useTriggerMaintenanceScheduleNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ scheduleId, priority }: { scheduleId: string; priority?: WorkOrderPriority }) =>
      pm.triggerMaintenanceScheduleNow(supabase, scheduleId, priority),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ops', 'maintenance-schedules'] });
      qc.invalidateQueries({ queryKey: ['ops', 'maintenance-due'] });
      qc.invalidateQueries({ queryKey: ['ops', 'maintenance-runs'] });
    },
  });
}

export function useRunDueMaintenanceSchedules() {
  const { data: org } = useOrganisation();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => pm.runDueMaintenanceSchedules(supabase, org!.organisation_id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ops', 'maintenance-schedules'] });
      qc.invalidateQueries({ queryKey: ['ops', 'maintenance-due'] });
    },
  });
}

export { isOverdue, daysUntilDue, TRIGGER_TYPE_LABELS } from '@/lib/afriops/preventiveMaintenance';
export type { MaintenanceSchedule, MaintenanceTriggerType } from '@/lib/afriops/preventiveMaintenance';
