#!/usr/bin/env bash
set -euo pipefail

# Adds the Preventive Maintenance module to src/lib/afriops/
# Run from the ROOT of your afrijob-rt46-final repo (same place you ran
# install-afriops-modules.sh before).

if [ ! -f "package.json" ]; then
  echo "Error: no package.json found here. cd into your repo root first, then re-run."
  exit 1
fi

if [ ! -d "src/lib/afriops" ]; then
  echo "Error: src/lib/afriops/ not found. Run install-afriops-modules.sh first (types.ts is a dependency)."
  exit 1
fi

cat > src/lib/afriops/preventiveMaintenance.ts << '__AFRIOPS_EOF_pm_ts__'
import { SupabaseClient } from '@supabase/supabase-js';
import { WorkOrder, WorkOrderPriority } from './types';

// ---------- Types ----------
// Mirrors maintenance_schedules / maintenance_schedule_runs tables
// (project wtbycozfoeiepvgortvx). Keep in sync if columns change.

export type MaintenanceTriggerType = 'interval_days' | 'interval_hours' | 'interval_km' | 'fixed_date';

export interface MaintenanceSchedule {
  id: string;
  organisation_id: string;
  asset_id: string;
  name: string;
  description: string | null;
  trigger_type: MaintenanceTriggerType;
  interval_value: number | null; // days / hours / km depending on trigger_type
  fixed_date: string | null; // used only when trigger_type = 'fixed_date'
  last_run_at: string | null;
  last_run_meter_reading: number | null;
  next_due_at: string | null; // computed server-side by trigger, never write this field
  next_due_meter_reading: number | null; // computed server-side, never write this field
  default_priority: WorkOrderPriority;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type ScheduleRunStatus = 'due' | 'work_order_created' | 'skipped';

export interface MaintenanceScheduleRun {
  id: string;
  organisation_id: string;
  schedule_id: string;
  work_order_id: string | null;
  status: ScheduleRunStatus;
  due_at: string;
  triggered_at: string | null;
  created_at: string;
}

// ---------- Schedules ----------

export async function listMaintenanceSchedules(
  supabase: SupabaseClient,
  organisationId: string,
  assetId?: string
): Promise<MaintenanceSchedule[]> {
  let query = supabase
    .from('maintenance_schedules')
    .select('*')
    .eq('organisation_id', organisationId)
    .order('next_due_at', { ascending: true, nullsFirst: false });
  if (assetId) query = query.eq('asset_id', assetId);

  const { data, error } = await query;
  if (error) throw error;
  return data as MaintenanceSchedule[];
}

export async function listDueSchedules(
  supabase: SupabaseClient,
  organisationId: string,
  withinDays = 7
): Promise<MaintenanceSchedule[]> {
  const cutoff = new Date(Date.now() + withinDays * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('maintenance_schedules')
    .select('*')
    .eq('organisation_id', organisationId)
    .eq('active', true)
    .lte('next_due_at', cutoff)
    .order('next_due_at', { ascending: true });
  if (error) throw error;
  return data as MaintenanceSchedule[];
}

// next_due_at / next_due_meter_reading are computed server-side by trigger from
// trigger_type + interval_value — never set them on insert.
export async function createMaintenanceSchedule(
  supabase: SupabaseClient,
  schedule: Pick<MaintenanceSchedule, 'organisation_id' | 'asset_id' | 'name' | 'trigger_type'> &
    Partial<
      Pick<
        MaintenanceSchedule,
        'description' | 'interval_value' | 'fixed_date' | 'default_priority' | 'active'
      >
    >
): Promise<MaintenanceSchedule> {
  const { data, error } = await supabase
    .from('maintenance_schedules')
    .insert(schedule)
    .select()
    .single();
  if (error) throw error;
  return data as MaintenanceSchedule;
}

export async function setMaintenanceScheduleActive(
  supabase: SupabaseClient,
  scheduleId: string,
  active: boolean
): Promise<void> {
  const { error } = await supabase
    .from('maintenance_schedules')
    .update({ active })
    .eq('id', scheduleId);
  if (error) throw error;
}

// ---------- Triggering work orders from schedules ----------

// Runs the due-schedule sweep server-side: for every active schedule whose
// next_due_at has passed, creates a work order, links it via a schedule_run row,
// and rolls next_due_at forward. Idempotent — safe to call repeatedly (e.g. from
// a daily cron / edge function), since a schedule already covered by an open
// work order won't be re-triggered.
export async function runDueMaintenanceSchedules(
  supabase: SupabaseClient,
  organisationId: string
): Promise<MaintenanceScheduleRun[]> {
  const { data, error } = await supabase.rpc('run_due_maintenance_schedules', {
    p_organisation_id: organisationId,
  });
  if (error) throw new Error(error.message);
  return data as MaintenanceScheduleRun[];
}

// Manually trigger a single schedule now, regardless of due date (e.g. "log this
// service early"). Still goes through the RPC so next_due_at rolls forward
// correctly instead of drifting.
export async function triggerMaintenanceScheduleNow(
  supabase: SupabaseClient,
  scheduleId: string,
  priority?: WorkOrderPriority
): Promise<WorkOrder> {
  const { data, error } = await supabase.rpc('trigger_maintenance_schedule', {
    p_schedule_id: scheduleId,
    p_priority: priority ?? null,
  });
  if (error) throw new Error(error.message);
  return data as WorkOrder;
}

export async function listScheduleRuns(
  supabase: SupabaseClient,
  scheduleId: string
): Promise<MaintenanceScheduleRun[]> {
  const { data, error } = await supabase
    .from('maintenance_schedule_runs')
    .select('*')
    .eq('schedule_id', scheduleId)
    .order('due_at', { ascending: false });
  if (error) throw error;
  return data as MaintenanceScheduleRun[];
}

// ---------- Helpers ----------

export function isOverdue(schedule: MaintenanceSchedule): boolean {
  if (!schedule.next_due_at) return false;
  return new Date(schedule.next_due_at).getTime() < Date.now();
}

export function daysUntilDue(schedule: MaintenanceSchedule): number | null {
  if (!schedule.next_due_at) return null;
  const diffMs = new Date(schedule.next_due_at).getTime() - Date.now();
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

export const TRIGGER_TYPE_LABELS: Record<MaintenanceTriggerType, string> = {
  interval_days: 'Every N days',
  interval_hours: 'Every N engine hours',
  interval_km: 'Every N km',
  fixed_date: 'Fixed date',
};

__AFRIOPS_EOF_pm_ts__
echo "Wrote src/lib/afriops/preventiveMaintenance.ts"

if command -v npx >/dev/null 2>&1 && [ -f "tsconfig.json" ]; then
  echo "Running typecheck..."
  npx tsc --noEmit --project tsconfig.json 2>&1 | grep "afriops/" || echo "No errors found in src/lib/afriops/ files."
else
  echo "Skipping typecheck (no tsconfig.json or npx found)."
fi
