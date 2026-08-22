#!/usr/bin/env bash
set -euo pipefail

# Adds the SLA Engine module to src/lib/afriops/
# Run from the ROOT of your afrijob-rt46-final repo.

if [ ! -f "package.json" ]; then
  echo "Error: no package.json found here. cd into your repo root first, then re-run."
  exit 1
fi

if [ ! -d "src/lib/afriops" ]; then
  echo "Error: src/lib/afriops/ not found. Run install-afriops-modules.sh first (types.ts is a dependency)."
  exit 1
fi

cat > src/lib/afriops/slaEngine.ts << '__AFRIOPS_EOF_sla_ts__'
import { SupabaseClient } from '@supabase/supabase-js';
import { WorkOrder, WorkOrderPriority } from './types';

// ---------- Types ----------
// Mirrors sla_policies / sla_targets / sla_breaches tables
// (project wtbycozfoeiepvgortvx). Keep in sync if columns change.
//
// Model: an SLA policy is scoped to an organisation (optionally narrowed by
// business_unit/site/category). Each policy has per-priority targets for
// response time and resolution time. A work order is matched to the most
// specific applicable policy at creation time, and its computed deadlines are
// stored on sla_targets — never recomputed ad hoc in the UI.

export type SlaMetric = 'response' | 'resolution';
export type SlaBreachStatus = 'on_track' | 'at_risk' | 'breached' | 'met';

export interface SlaPolicy {
  id: string;
  organisation_id: string;
  business_unit_id: string | null; // null = applies org-wide
  site_id: string | null; // null = applies to all sites in scope
  category: string | null; // null = applies to all work order categories
  name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SlaPolicyTarget {
  id: string;
  policy_id: string;
  priority: WorkOrderPriority;
  response_minutes: number; // time to first assignment/acknowledgement
  resolution_minutes: number; // time to completed status
}

export interface SlaTarget {
  id: string;
  organisation_id: string;
  work_order_id: string;
  policy_id: string;
  priority: WorkOrderPriority;
  response_due_at: string;
  resolution_due_at: string;
  responded_at: string | null;
  resolved_at: string | null;
  response_status: SlaBreachStatus; // computed server-side, never write this field
  resolution_status: SlaBreachStatus; // computed server-side, never write this field
  created_at: string;
  updated_at: string;
}

export interface SlaBreach {
  id: string;
  organisation_id: string;
  work_order_id: string;
  sla_target_id: string;
  metric: SlaMetric;
  breached_at: string;
  minutes_over: number;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  created_at: string;
}

// ---------- Policies ----------

export async function listSlaPolicies(
  supabase: SupabaseClient,
  organisationId: string
): Promise<SlaPolicy[]> {
  const { data, error } = await supabase
    .from('sla_policies')
    .select('*')
    .eq('organisation_id', organisationId)
    .order('name');
  if (error) throw error;
  return data as SlaPolicy[];
}

export async function createSlaPolicy(
  supabase: SupabaseClient,
  policy: Pick<SlaPolicy, 'organisation_id' | 'name'> &
    Partial<Pick<SlaPolicy, 'business_unit_id' | 'site_id' | 'category' | 'active'>>,
  targets: Pick<SlaPolicyTarget, 'priority' | 'response_minutes' | 'resolution_minutes'>[]
): Promise<SlaPolicy> {
  const { data: createdPolicy, error: policyError } = await supabase
    .from('sla_policies')
    .insert(policy)
    .select()
    .single();
  if (policyError) throw policyError;

  if (targets.length > 0) {
    const { error: targetsError } = await supabase
      .from('sla_policy_targets')
      .insert(targets.map((t) => ({ ...t, policy_id: createdPolicy.id })));
    if (targetsError) throw targetsError;
  }

  return createdPolicy as SlaPolicy;
}

export async function listSlaPolicyTargets(
  supabase: SupabaseClient,
  policyId: string
): Promise<SlaPolicyTarget[]> {
  const { data, error } = await supabase
    .from('sla_policy_targets')
    .select('*')
    .eq('policy_id', policyId)
    .order('priority');
  if (error) throw error;
  return data as SlaPolicyTarget[];
}

export async function setSlaPolicyActive(
  supabase: SupabaseClient,
  policyId: string,
  active: boolean
): Promise<void> {
  const { error } = await supabase.from('sla_policies').update({ active }).eq('id', policyId);
  if (error) throw error;
}

// ---------- Work order SLA tracking ----------

// Matches the work order against the most specific applicable policy
// (category+site > site > business_unit > org-wide) and creates its
// sla_targets row with computed deadlines. Call this right after a work
// order is created — never hand-roll the policy matching logic client-side,
// the precedence rules live in the RPC so they stay consistent everywhere.
export async function attachSlaToWorkOrder(
  supabase: SupabaseClient,
  workOrderId: string
): Promise<SlaTarget | null> {
  const { data, error } = await supabase.rpc('attach_sla_to_work_order', {
    p_work_order_id: workOrderId,
  });
  if (error) throw new Error(error.message);
  return (data as SlaTarget) ?? null; // null if no applicable policy exists
}

export async function getSlaTargetForWorkOrder(
  supabase: SupabaseClient,
  workOrderId: string
): Promise<SlaTarget | null> {
  const { data, error } = await supabase
    .from('sla_targets')
    .select('*')
    .eq('work_order_id', workOrderId)
    .maybeSingle();
  if (error) throw error;
  return data as SlaTarget | null;
}

// Marks the response milestone (first assignment/acknowledgement). Recomputes
// response_status server-side against response_due_at — do not set
// response_status directly from the client.
export async function recordSlaResponse(supabase: SupabaseClient, workOrderId: string): Promise<SlaTarget> {
  const { data, error } = await supabase.rpc('record_sla_response', {
    p_work_order_id: workOrderId,
  });
  if (error) throw new Error(error.message);
  return data as SlaTarget;
}

// Marks the resolution milestone (work order completed). Recomputes
// resolution_status server-side against resolution_due_at.
export async function recordSlaResolution(supabase: SupabaseClient, workOrderId: string): Promise<SlaTarget> {
  const { data, error } = await supabase.rpc('record_sla_resolution', {
    p_work_order_id: workOrderId,
  });
  if (error) throw new Error(error.message);
  return data as SlaTarget;
}

// ---------- Breach monitoring ----------

export async function listOpenBreaches(
  supabase: SupabaseClient,
  organisationId: string
): Promise<SlaBreach[]> {
  const { data, error } = await supabase
    .from('sla_breaches')
    .select('*')
    .eq('organisation_id', organisationId)
    .is('acknowledged_at', null)
    .order('breached_at', { ascending: false });
  if (error) throw error;
  return data as SlaBreach[];
}

export async function acknowledgeBreach(supabase: SupabaseClient, breachId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('sla_breaches')
    .update({ acknowledged_by: user?.id, acknowledged_at: new Date().toISOString() })
    .eq('id', breachId)
    .is('acknowledged_at', null); // guard: avoid clobbering an existing ack
  if (error) throw error;
}

// Sweeps all open work orders for this organisation, flags any past-due
// targets as breached (writing sla_breaches rows + firing notifications via
// notifyViaRpc under the hood), and flags near-due targets as at_risk. Call
// this from a scheduled edge function / cron — safe to call repeatedly,
// won't double-insert a breach row for a target already breached.
export async function runSlaBreachSweep(
  supabase: SupabaseClient,
  organisationId: string
): Promise<SlaBreach[]> {
  const { data, error } = await supabase.rpc('run_sla_breach_sweep', {
    p_organisation_id: organisationId,
  });
  if (error) throw new Error(error.message);
  return data as SlaBreach[];
}

// ---------- Helpers ----------

export function minutesRemaining(dueAt: string): number {
  return Math.round((new Date(dueAt).getTime() - Date.now()) / 60000);
}

export function isAtRisk(dueAt: string, thresholdMinutes = 60): boolean {
  const remaining = minutesRemaining(dueAt);
  return remaining > 0 && remaining <= thresholdMinutes;
}

export function isPastDue(dueAt: string): boolean {
  return minutesRemaining(dueAt) < 0;
}

export const SLA_STATUS_COLOR: Record<SlaBreachStatus, string> = {
  on_track: 'green',
  at_risk: 'amber',
  breached: 'red',
  met: 'gray',
};

// Priority precedence used purely for client-side sorting/display — the
// authoritative response/resolution minutes per priority live in
// sla_policy_targets, not here.
export const PRIORITY_WEIGHT: Record<WorkOrderPriority, number> = {
  low: 0,
  normal: 1,
  high: 2,
  urgent: 3,
};

__AFRIOPS_EOF_sla_ts__
echo "Wrote src/lib/afriops/slaEngine.ts"

if command -v npx >/dev/null 2>&1 && [ -f "tsconfig.json" ]; then
  echo "Running typecheck..."
  npx tsc --noEmit --project tsconfig.json 2>&1 | grep "afriops/" || echo "No errors found in src/lib/afriops/ files."
else
  echo "Skipping typecheck (no tsconfig.json or npx found)."
fi
