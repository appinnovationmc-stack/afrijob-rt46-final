import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { useActiveOrgStore } from '@/store/activeOrgStore';
import { supabase } from '@/lib/supabase';
import type { OrganisationRole } from '@/lib/afriops/types';
import type { Json } from '@/types/database.types';

// When a profile belongs to multiple organisations, this decides which one
// is picked automatically (only used until the person explicitly switches,
// see useActiveOrgStore). Ranked so the membership that gives the most
// administrative control surfaces by default, rather than whatever order
// Postgres happens to return.
const ROLE_DEFAULT_PRIORITY: OrganisationRole[] = [
  'owner', 'admin', 'manager', 'operations_manager', 'fleet_manager',
  'supervisor', 'finance', 'procurement_officer', 'inspector', 'contractor',
  'member', 'technician', 'viewer',
];

function rankRole(role: OrganisationRole): number {
  const i = ROLE_DEFAULT_PRIORITY.indexOf(role);
  return i === -1 ? ROLE_DEFAULT_PRIORITY.length : i;
}

export type IndustryMode = 'general' | 'mining' | 'fleet' | 'municipal' | 'government' | 'logistics';

export const INDUSTRY_LABELS: Record<IndustryMode, string> = {
  general: 'General',
  mining: 'Mining',
  fleet: 'Fleet',
  municipal: 'Municipal',
  government: 'Government',
  logistics: 'Logistics',
};

// Real config, not decoration: this is what makes industry_mode actually
// change the product rather than just showing a badge. It drives asset
// terminology, which Ops modules are surfaced first on the dashboard,
// and — as of this pass — which KPI tiles the dashboard leads with.
// priorityModules values must match the moduleKey strings used in
// OpsDashboard's NAV_ITEMS, and kpiOrder values must match the `key`
// fields in OpsDashboard's KPI_DEFINITIONS — both cross-checked against
// that file rather than invented.
export interface IndustryConfig {
  assetLabelSingular: string;
  assetLabelPlural: string;
  tagline: string;
  priorityModules: string[];
  kpiOrder: string[];
  // Overrides for work_order_category display text, keyed by the DB enum
  // value (breakdown/maintenance/inspection/repair/service/incident/other).
  // Deliberately Partial: this only relabels how a category reads for this
  // industry — the underlying enum value, and therefore every query,
  // filter, and RLS policy built on it, is completely unchanged. Any
  // category not listed here falls back to WORK_ORDER_CATEGORY_LABELS'
  // default text via getCategoryLabel() in useWorkOrders.ts.
  categoryLabels?: Partial<Record<string, string>>;
  // Suggested asset_types.category values to seed/surface first when an
  // org in this industry sets up its Asset Registry. Matched against the
  // free-text `category` column on asset_types (see AssetRegistry.tsx) —
  // not an enum, so this is guidance for the UI, not a constraint.
  suggestedAssetCategories: string[];
  // ---- Agent / co-pilot hooks (Phase 1) ----
  // Short phrases fed into the co-pilot's system prompt so it uses this
  // industry's vocabulary instead of generic CMMS language. Deliberately
  // short — this is prompt context, not a taxonomy the code branches on.
  entityGlossary: string[];
  // Names of the recommendation types this industry's co-pilot should lean
  // on first. Informational only right now (surfaced in the prompt and in
  // suggestedPrompts below) — there is no per-skill routing logic yet;
  // that's a later phase once there's more than one real skill.
  agentSkills: string[];
  // Replaces the old hardcoded 3-prompt list in AIAssistant.tsx. This is
  // the visible, checkable proof that industry mode changes the co-pilot,
  // not just a badge.
  suggestedPrompts: string[];
}

export const INDUSTRY_CONFIG: Record<IndustryMode, IndustryConfig> = {
  general: {
    assetLabelSingular: 'Asset',
    assetLabelPlural: 'Assets',
    tagline: 'Operations overview',
    priorityModules: [],
    kpiOrder: ['open_work_orders', 'sla_breaches', 'maintenance_due', 'open_incidents'],
    suggestedAssetCategories: ['Equipment', 'Vehicle', 'Facility', 'Other'],
    entityGlossary: ['asset', 'work order', 'maintenance schedule'],
    agentSkills: ['general_risk_summary'],
    suggestedPrompts: [
      'What are the biggest operational risks right now?',
      'Where are we losing time on work orders?',
      'What should the operations manager prioritise today?',
    ],
  },
  mining: {
    assetLabelSingular: 'Equipment',
    assetLabelPlural: 'Equipment',
    tagline: 'Mobile equipment, safety and site maintenance',
    priorityModules: ['maintenance', 'incidents', 'inventory', 'procurement', 'documents'],
    kpiOrder: ['open_incidents', 'maintenance_due', 'open_work_orders', 'low_stock'],
    categoryLabels: {
      breakdown: 'Breakdown',
      incident: 'Safety Incident',
      inspection: 'Site Inspection',
      maintenance: 'Scheduled Maintenance',
      repair: 'Repair',
    },
    suggestedAssetCategories: ['Heavy/Mobile Equipment', 'Drilling Equipment', 'Loader', 'Excavator', 'Haul Truck'],
    entityGlossary: ['haul truck', 'pit site', 'safety incident', 'scheduled maintenance', 'breakdown'],
    agentSkills: ['flag_high_risk_equipment', 'safety_incident_pattern'],
    suggestedPrompts: [
      'Which equipment is at the highest breakdown risk right now?',
      'Summarise safety incidents from the last 30 days',
      'What maintenance is overdue across the pit sites?',
    ],
  },
  fleet: {
    assetLabelSingular: 'Vehicle',
    assetLabelPlural: 'Vehicles',
    tagline: 'Vehicles, maintenance and parts',
    priorityModules: ['maintenance', 'inventory', 'procurement', 'documents', 'sla'],
    kpiOrder: ['maintenance_due', 'open_work_orders', 'low_stock', 'sla_breaches'],
    categoryLabels: {
      breakdown: 'Breakdown',
      incident: 'Accident',
      inspection: 'Vehicle Inspection',
      maintenance: 'Service',
      repair: 'Repair',
    },
    suggestedAssetCategories: ['Light Vehicle', 'Heavy Vehicle', 'Trailer', 'Motorcycle'],
    entityGlossary: ['vehicle', 'service', 'accident', 'vehicle inspection', 'parts'],
    agentSkills: ['predict_service_due', 'flag_high_cost_vehicle'],
    suggestedPrompts: [
      'Which vehicles are due for service this week?',
      'Which vehicles cost the most to maintain this quarter?',
      'Any vehicles with repeat breakdowns?',
    ],
  },
  municipal: {
    assetLabelSingular: 'Asset',
    assetLabelPlural: 'Assets',
    tagline: 'Service requests, work and SLA performance',
    priorityModules: ['sla', 'incidents', 'procurement', 'documents', 'maintenance'],
    kpiOrder: ['sla_breaches', 'open_work_orders', 'open_incidents', 'maintenance_due'],
    categoryLabels: {
      breakdown: 'Service Request',
      incident: 'Public Incident',
      inspection: 'Compliance Inspection',
      maintenance: 'Scheduled Maintenance',
      repair: 'Repair',
    },
    suggestedAssetCategories: ['Road/Infrastructure', 'Facility', 'Municipal Vehicle', 'Public Utility'],
    entityGlossary: ['service request', 'SLA', 'public incident', 'compliance inspection'],
    agentSkills: ['sla_breach_forecast', 'service_request_backlog'],
    suggestedPrompts: [
      'Which SLAs are at risk of breaching this week?',
      'What is the current service request backlog by ward or site?',
      'Any recurring public incidents worth escalating?',
    ],
  },
  government: {
    assetLabelSingular: 'Asset',
    assetLabelPlural: 'Assets',
    tagline: 'Procurement, compliance and SLA performance',
    priorityModules: ['procurement', 'documents', 'sla', 'incidents', 'maintenance'],
    kpiOrder: ['sla_breaches', 'expiring_documents', 'open_work_orders', 'open_incidents'],
    categoryLabels: {
      breakdown: 'Service Request',
      incident: 'Reportable Incident',
      inspection: 'Compliance Inspection',
      maintenance: 'Scheduled Maintenance',
      repair: 'Repair',
    },
    suggestedAssetCategories: ['Government Vehicle', 'Facility', 'IT Equipment', 'Other'],
    entityGlossary: ['procurement', 'compliance', 'reportable incident', 'SLA'],
    agentSkills: ['compliance_expiry_watch', 'procurement_bottleneck'],
    suggestedPrompts: [
      'What compliance documents are expiring soon?',
      'Where is procurement causing the biggest delays?',
      'Which SLAs need attention this month?',
    ],
  },
  logistics: {
    assetLabelSingular: 'Vehicle',
    assetLabelPlural: 'Vehicles',
    tagline: 'Routes, maintenance and incidents',
    priorityModules: ['maintenance', 'incidents', 'procurement', 'documents', 'inventory'],
    kpiOrder: ['open_incidents', 'open_work_orders', 'maintenance_due', 'low_stock'],
    categoryLabels: {
      breakdown: 'Breakdown',
      incident: 'Route Incident',
      inspection: 'Pre-Trip Inspection',
      maintenance: 'Service',
      repair: 'Repair',
    },
    suggestedAssetCategories: ['Truck', 'Trailer', 'Delivery Vehicle'],
    entityGlossary: ['route incident', 'pre-trip inspection', 'delivery vehicle', 'breakdown'],
    agentSkills: ['route_incident_pattern', 'fleet_availability_risk'],
    suggestedPrompts: [
      'Which routes have the most incidents this month?',
      'What is our delivery fleet availability looking like?',
      'Any vehicles flagged in pre-trip inspections repeatedly?',
    ],
  },
};

export interface OrganisationMembership {
  organisation_id: string;
  role: OrganisationRole;
  organisation_name: string;
  industry_mode: IndustryMode;
  enabled_modules: Json;
  /** True when this profile has more than one organisation membership. */
  has_multiple_memberships: boolean;
}

// Returns whether a module should be shown for this organisation.
// enabled_modules has no tracked SQL source anywhere in this repo (see
// note on the organisations table) — its real shape is only known from
// live data. Rather than assume a shape and risk hiding a module an
// existing org already relies on if the assumption is wrong, this
// defaults to "enabled" and only hides a module on an explicit,
// unambiguous opt-out, tolerating two plausible shapes:
//   { "inventory": false, ... }  — keyed object, module explicitly off
//   ["inventory", "procurement"] — array of *disabled* module keys
// If enabled_modules is null, not an object/array, or doesn't mention
// the module at all, the module is treated as enabled. Verify against a
// real organisations.enabled_modules value before relying on this for
// anything more than a UI convenience.
export function isModuleEnabled(enabledModules: Json | null | undefined, moduleKey: string): boolean {
  if (enabledModules == null) return true;
  if (Array.isArray(enabledModules)) {
    // treat array membership as "explicitly disabled"
    return !enabledModules.includes(moduleKey as any);
  }
  if (typeof enabledModules === 'object') {
    const val = (enabledModules as Record<string, unknown>)[moduleKey];
    return val !== false;
  }
  return true;
}

interface RawMembershipRow {
  organisation_id: string;
  role: OrganisationRole;
  invited_at: string | null;
  joined_at: string | null;
  organisations: { name: string; industry_mode: IndustryMode; enabled_modules: Json } | null;
}

function toMembership(row: RawMembershipRow, hasMultiple: boolean): OrganisationMembership {
  return {
    organisation_id: row.organisation_id,
    role: row.role,
    organisation_name: row.organisations?.name ?? 'Organisation',
    industry_mode: row.organisations?.industry_mode ?? 'general',
    enabled_modules: row.organisations?.enabled_modules ?? null,
    has_multiple_memberships: hasMultiple,
  };
}

// All of a profile's organisation memberships, for building an org switcher.
// Sorted by the same deterministic default order useOrganisation() uses, so
// "first in this list" always matches "what useOrganisation() picks by
// default" instead of the two silently disagreeing.
export function useOrganisationMemberships() {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery({
    queryKey: ['ops', 'organisation-memberships', userId],
    enabled: !!userId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<OrganisationMembership[]> => {
      const { data, error } = await supabase
        .from('organisation_members')
        .select('organisation_id, role, invited_at, joined_at, organisations(name, industry_mode, enabled_modules)')
        .eq('profile_id', userId!);
      if (error) throw error;
      const rows = (data ?? []) as unknown as RawMembershipRow[];
      const sorted = [...rows].sort((a, b) => {
        const roleDiff = rankRole(a.role) - rankRole(b.role);
        if (roleDiff !== 0) return roleDiff;
        // Tie-broken by whichever membership has existed longest, so the
        // default doesn't shuffle as new invites are accepted later.
        const aTime = a.joined_at ?? a.invited_at ?? '';
        const bTime = b.joined_at ?? b.invited_at ?? '';
        return aTime.localeCompare(bTime);
      });
      return sorted.map((row) => toMembership(row, rows.length > 1));
    },
  });
}

// Resolves the profile's CURRENT organisation membership: the one explicitly
// selected via useActiveOrgStore if it's still valid, otherwise a
// deterministic default (see ROLE_DEFAULT_PRIORITY) rather than whatever row
// Postgres happened to return first. Every ops hook and page reads through
// this hook, so switching orgs here is all that's needed anywhere else.
export function useOrganisation() {
  const activeOrgId = useActiveOrgStore((s) => s.activeOrgId);
  const memberships = useOrganisationMemberships();

  const resolved: OrganisationMembership | null = (() => {
    const list = memberships.data;
    if (!list || list.length === 0) return null;
    if (activeOrgId) {
      const match = list.find((m) => m.organisation_id === activeOrgId);
      if (match) return match;
    }
    // No stored selection (or it no longer applies, e.g. removed from that
    // org) — list is already sorted by ROLE_DEFAULT_PRIORITY, so [0] is the
    // deterministic default.
    return list[0];
  })();

  return {
    ...memberships,
    data: resolved,
  };
}

// Ranks are coarse and deliberately mirror the role_permissions seed
// migration's "copy from nearest existing role" mapping (see
// 20260820130100_seed_role_permissions_new_roles.sql) rather than
// representing a real seniority hierarchy — several of these roles
// (e.g. finance vs. fleet_manager) aren't actually comparable in
// authority, they just share a permission tier for now. roleAtLeast()
// is only meaningful for comparisons against the original 5 base roles;
// avoid using it to compare two specialist roles against each other.
const ROLE_RANK: Record<OrganisationRole, number> = {
  viewer: 0,
  contractor: 0,
  member: 1,
  technician: 1,
  inspector: 1,
  manager: 2,
  supervisor: 2,
  procurement_officer: 2,
  finance: 2,
  fleet_manager: 2,
  operations_manager: 2,
  admin: 3,
  owner: 4,
};

export function roleAtLeast(role: OrganisationRole | undefined, minimum: OrganisationRole): boolean {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

// Loads the exact set of permission codes granted to the current org role,
// straight from role_permissions — the same table the server-side
// has_permission() RPC and RLS policies already check. This is UI-only
// convenience (hide/disable actions the person can't take) layered on top
// of enforcement that already exists at the database level; it is not
// itself the security boundary.
export function usePermissions() {
  const { data: org } = useOrganisation();

  const query = useQuery({
    queryKey: ['ops', 'permissions', org?.role],
    enabled: !!org?.role,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('permission_code')
        .eq('role', org!.role)
        .eq('granted', true);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.permission_code));
    },
  });

  const can = (code: string) => query.data?.has(code) ?? false;
  return { ...query, can };
}
