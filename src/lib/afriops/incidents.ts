import { SupabaseClient } from '@supabase/supabase-js';
import { Incident, IncidentCategory, IncidentSeverity, WorkOrder, WorkOrderPriority } from './types';

export async function listIncidents(
  supabase: SupabaseClient,
  organisationId: string,
  status?: Incident['status']
): Promise<Incident[]> {
  let query = supabase
    .from('incidents')
    .select('*')
    .eq('organisation_id', organisationId)
    .order('occurred_at', { ascending: false });
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw error;
  return data as Incident[];
}

export async function reportIncident(
  supabase: SupabaseClient,
  incident: Pick<Incident, 'organisation_id' | 'category' | 'description'> &
    Partial<Pick<Incident, 'site_id' | 'asset_id' | 'severity' | 'latitude' | 'longitude' | 'occurred_at'>>
): Promise<Incident> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('incidents')
    .insert({ ...incident, reported_by: user?.id })
    .select()
    .single();
  if (error) throw error;
  return data as Incident;
}

// Escalation creates a real work order server-side and links it back — never create
// a work order manually and set linked_work_order_id yourself, the RPC's guard
// against double-escalation depends on going through this path.
export async function escalateIncidentToWorkOrder(
  supabase: SupabaseClient,
  incidentId: string,
  priority: WorkOrderPriority = 'high'
): Promise<WorkOrder> {
  const { data, error } = await supabase.rpc('escalate_incident_to_work_order', {
    p_incident_id: incidentId,
    p_priority: priority,
  });
  if (error) throw new Error(error.message);
  return data as WorkOrder;
}

export async function updateIncidentStatus(
  supabase: SupabaseClient,
  incidentId: string,
  status: Incident['status']
): Promise<void> {
  const updates: Partial<Incident> = { status };
  if (status === 'resolved' || status === 'closed') {
    updates.resolved_at = new Date().toISOString();
  }
  const { error } = await supabase.from('incidents').update(updates).eq('id', incidentId);
  if (error) throw error;
}

export function severityWeight(severity: IncidentSeverity): number {
  return { low: 0, medium: 1, high: 2, critical: 3 }[severity];
}

export const INCIDENT_CATEGORIES: IncidentCategory[] = [
  'breakdown',
  'safety',
  'accident',
  'security',
  'environmental',
  'other',
];

