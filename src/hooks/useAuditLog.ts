import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useOrganisation } from './useOrganisation';

export type AuditSeverity = 'info' | 'warning' | 'critical';

export interface AuditLogEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_profile_id: string | null;
  actor: { full_name: string | null } | null;
  before_data: unknown;
  after_data: unknown;
  metadata: unknown;
  created_at: string;
  severity: AuditSeverity;
}

export interface AuditLogFilters {
  entityType?: string;
  entityId?: string;
  action?: string;
  actorProfileId?: string;
  severity?: AuditSeverity;
  dateFrom?: string; // ISO date, inclusive
  dateTo?: string; // ISO date, inclusive
}

const PAGE_SIZE = 50;

// This reads the SAME audit_log table and RLS policy ("org members can
// view audit log for their org", gated on org.manage_members) that already
// protected assets/organisations/members audit rows — no new permission
// or parallel access path introduced for the entity types covered by
// tonight's migration (work_orders, incidents, purchase_orders,
// document_vault, sla_breaches, service_providers).
//
// NOTE — real gaps, not silently smoothed over:
// - "module" as a filter dimension (asked for in the spec) doesn't exist
//   as its own column on audit_log; entity_type is the closest equivalent
//   and is what's filterable here. severity now exists (info/warning/
//   critical, migration applied + backfilled on trigger writes) and is
//   filterable below. actorProfileId was already filterable in this hook
//   before this pass — it just wasn't wired into the AuditLog.tsx UI yet.
// - role_permissions changes (permission grants/revokes) are NOT audited
//   yet: that table has no organisation_id column, so it can't write into
//   this org-scoped audit_log without a schema change. Flagged, not faked.
export function useAuditLog(filters: AuditLogFilters, page: number = 0) {
  const { data: org } = useOrganisation();
  return useQuery({
    queryKey: ['ops', 'audit-log', org?.organisation_id, filters, page],
    enabled: !!org?.organisation_id,
    queryFn: async (): Promise<{ entries: AuditLogEntry[]; hasMore: boolean }> => {
      let query = supabase
        .from('audit_log')
        .select('id, entity_type, entity_id, action, actor_profile_id, before_data, after_data, metadata, created_at, severity, actor:profiles!audit_log_actor_profile_id_fkey(full_name)')
        .eq('organisation_id', org!.organisation_id)
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (filters.entityType) query = query.eq('entity_type', filters.entityType);
      if (filters.entityId) query = query.eq('entity_id', filters.entityId);
      if (filters.action) query = query.eq('action', filters.action);
      if (filters.actorProfileId) query = query.eq('actor_profile_id', filters.actorProfileId);
      if (filters.severity) query = query.eq('severity', filters.severity);
      if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
      if (filters.dateTo) query = query.lte('created_at', filters.dateTo);

      const { data, error } = await query;
      if (error) throw error;
      const entries = (data ?? []) as unknown as AuditLogEntry[];
      return { entries, hasMore: entries.length === PAGE_SIZE };
    },
  });
}

// Populates the entity-type filter dropdown from what's actually in the
// data for this org, rather than a hardcoded list that could drift from
// what the triggers actually emit.
export function useAuditLogEntityTypes() {
  const { data: org } = useOrganisation();
  return useQuery({
    queryKey: ['ops', 'audit-log-entity-types', org?.organisation_id],
    enabled: !!org?.organisation_id,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from('audit_log')
        .select('entity_type')
        .eq('organisation_id', org!.organisation_id);
      if (error) throw error;
      return Array.from(new Set((data ?? []).map((r) => r.entity_type))).sort();
    },
  });
}

// Populates the actor filter dropdown from the distinct set of profiles
// that have actually written audit rows for this org — same pattern as
// useAuditLogEntityTypes, avoids listing every org member (many of whom
// may never have triggered an audited action).
export function useAuditLogActors() {
  const { data: org } = useOrganisation();
  return useQuery({
    queryKey: ['ops', 'audit-log-actors', org?.organisation_id],
    enabled: !!org?.organisation_id,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<{ id: string; full_name: string | null }[]> => {
      const { data, error } = await supabase
        .from('audit_log')
        .select('actor_profile_id, actor:profiles!audit_log_actor_profile_id_fkey(full_name)')
        .eq('organisation_id', org!.organisation_id)
        .not('actor_profile_id', 'is', null);
      if (error) throw error;
      const seen = new Map<string, string | null>();
      for (const row of (data ?? []) as unknown as { actor_profile_id: string; actor: { full_name: string | null } | null }[]) {
        if (!seen.has(row.actor_profile_id)) seen.set(row.actor_profile_id, row.actor?.full_name ?? null);
      }
      return Array.from(seen.entries())
        .map(([id, full_name]) => ({ id, full_name }))
        .sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? ''));
    },
  });
}

export const AUDIT_SEVERITY_LABELS: Record<AuditSeverity, string> = {
  info: 'Info',
  warning: 'Warning',
  critical: 'Critical',
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  created: 'Created',
  status_changed: 'Status changed',
  assignment_changed: 'Assignment changed',
  severity_changed: 'Severity changed',
  approved: 'Approved',
  uploaded: 'Uploaded',
  breach_recorded: 'Breach recorded',
  acknowledged: 'Acknowledged',
  lifecycle_changed: 'Lifecycle changed',
  settings_changed: 'Settings changed',
  member_added: 'Member added',
  member_removed: 'Member removed',
  role_changed: 'Role changed',
  invitation_created: 'Invitation created',
  item_created: 'Item created',
  item_updated: 'Item updated',
  movement_recorded: 'Stock movement recorded',
  schedule_created: 'Schedule created',
  schedule_activated: 'Schedule activated',
  schedule_deactivated: 'Schedule deactivated',
  maintenance_triggered: 'Maintenance triggered',
};

export const AUDIT_ENTITY_LABELS: Record<string, string> = {
  asset: 'Asset',
  work_order: 'Work Order',
  incident: 'Incident',
  purchase_order: 'Purchase Order',
  document: 'Document',
  sla_breach: 'SLA Breach',
  service_provider: 'Service Provider',
  organisation: 'Organisation',
  organisation_member: 'Team Member',
  organisation_invitation: 'Invitation',
  inventory_item: 'Inventory Item',
  inventory_movement: 'Inventory Movement',
  maintenance_schedule: 'Maintenance Schedule',
  maintenance_schedule_run: 'Maintenance Run',
};
