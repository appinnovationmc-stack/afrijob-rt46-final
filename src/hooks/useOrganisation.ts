import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { supabase } from '@/lib/supabase';
import type { OrganisationRole } from '@/lib/afriops/types';
import type { Json } from '@/types/database.types';

export type IndustryMode = 'general' | 'mining' | 'fleet' | 'municipal' | 'government' | 'logistics';

export const INDUSTRY_LABELS: Record<IndustryMode, string> = {
  general: 'General',
  mining: 'Mining',
  fleet: 'Fleet',
  municipal: 'Municipal',
  government: 'Government',
  logistics: 'Logistics',
};

export interface OrganisationMembership {
  organisation_id: string;
  role: OrganisationRole;
  organisation_name: string;
  industry_mode: IndustryMode;
  enabled_modules: Json;
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

// Resolves the current profile's organisation membership. Mirrors the
// single-workshop-per-user assumption already made in App.tsx for the legacy
// workshop model — takes the first membership found. If/when a user can
// belong to multiple organisations, this is the one place to add an org
// switcher; every ops hook and page below reads through this hook so nothing
// else needs to change.
export function useOrganisation() {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery({
    queryKey: ['ops', 'organisation', userId],
    enabled: !!userId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<OrganisationMembership | null> => {
      const { data, error } = await supabase
        .from('organisation_members')
        .select('organisation_id, role, organisations(name, industry_mode, enabled_modules)')
        .eq('profile_id', userId!)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        organisation_id: data.organisation_id,
        role: data.role as OrganisationRole,
        organisation_name: (data as any).organisations?.name ?? 'Organisation',
        industry_mode: ((data as any).organisations?.industry_mode ?? 'general') as IndustryMode,
        enabled_modules: (data as any).organisations?.enabled_modules ?? null,
      };
    },
  });
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
