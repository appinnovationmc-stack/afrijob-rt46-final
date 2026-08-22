-- Expands organisation_role from the original 5 generic values
-- (owner/admin/manager/member/viewer) to include role-specific personas
-- the platform needs (mining/fleet/municipal/government/logistics all
-- share these). Purely additive — no existing value is renamed or
-- removed, so no existing organisation_members row or RLS policy that
-- switches on the old 5 values breaks.
--
-- ASSUMPTION (stated explicitly, not verified against live code): this
-- repo has no tracked SQL source for has_permission() or the
-- role_permissions table — both were applied directly to production
-- outside version control (same situation as organisation_members). The
-- in-repo comment on useOrganisation.ts's usePermissions() says
-- has_permission() and RLS both check role_permissions dynamically by
-- (role, permission_code) rather than hard-coding role names in
-- function bodies. This migration is written on that assumption. If
-- has_permission() (or any RLS policy) instead has role names
-- hard-coded — e.g. `where role in ('owner','admin')` — the new roles
-- below will exist but grant nothing until that function/policy is
-- also updated to look them up dynamically. Verify against the live
-- function body before treating new-role permissions as working.
--
-- ALTER TYPE ... ADD VALUE cannot be used in the same transaction as a
-- statement that references the new value, so the values are added
-- here only; role_permissions seeding for these roles is a separate,
-- later-numbered migration file.

alter type public.organisation_role add value if not exists 'supervisor';
alter type public.organisation_role add value if not exists 'technician';
alter type public.organisation_role add value if not exists 'inspector';
alter type public.organisation_role add value if not exists 'procurement_officer';
alter type public.organisation_role add value if not exists 'finance';
alter type public.organisation_role add value if not exists 'fleet_manager';
alter type public.organisation_role add value if not exists 'operations_manager';
alter type public.organisation_role add value if not exists 'contractor';
