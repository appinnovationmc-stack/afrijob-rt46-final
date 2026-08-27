# P0 Audit / RBAC / Lifecycle Hardening

Date: 2026-08-28

## Scope

This change set closes the repo-side items that could be implemented without
inventing missing production data or silently deleting legacy schemas.

## Work-order audit

The production audit found no fully-audited normal human work-order lifecycle.
`public.work_orders` contains real rows, but the most complete traced order was
already `completed` at the first audit entry. `jobs`, `job_parts`, and the
`rt46` schema were empty in production. `purchase_orders`, `sla_targets`, and
`document_vault` were also empty, so the downstream lifecycle remains
unexercised in live data.

The repository therefore does **not** drop `jobs`, `job_parts`, or `rt46.*` in
this patch. That is a data-retention / migration decision requiring explicit
production confirmation. The existing lifecycle trace remains the source of
truth until a real work order is exercised end-to-end.

## Audit logging

There are two audit layers:

1. semantic lifecycle events (`created`, `status_changed`, `assignment_changed`,
   etc.); and
2. generic mutation events (`insert:<table>`, `update:<table>`,
   `delete:<table>`).

The semantic triggers for work orders, assets, service providers and incidents
previously did not handle DELETE. The new migration adds explicit semantic
`deleted` events with the deleted row in `before_data`.

The generic trigger remains in place for raw mutation coverage. This means a
delete now has both generic and semantic evidence rather than relying on the
generic trigger alone.

## Audit visibility

`audit_log` read access was previously coupled to `org.manage_members`. That
made membership administration a prerequisite for operational audit review.
The new `audit.view` permission separates those concerns. It is seeded for:

- owner
- admin
- manager
- supervisor
- operations_manager

The database remains authoritative; the frontend only exposes the audit route
where the persona configuration explicitly allows it.

## Role UX / route guards

The role configuration now exposes existing operational screens to roles that
already have the corresponding backend capability, instead of hiding them
behind the generic workspace.

Two important route-guard defects were also removed:

- `/ops/admin/drivers` is now guarded by `drivers`, not `assets`.
- `/ops/admin/service-providers` is now guarded by `serviceproviders`, not
  `admin_team`.
- `/ops/compliance` was added using the existing `ComplianceDashboard` page and
  a dedicated `compliance` module guard.
- `/ops/admin/audit` is guarded by the new `audit` module.

This does not weaken RLS. Direct API access remains governed by the database.

## Deliberately not fabricated

There are no dedicated Suppliers or Sites pages in the current repository.
The existing Procurement / Asset workflows may surface those concepts, but
this patch does not create pretend CRUD screens merely to satisfy a menu
matrix. A dedicated Suppliers or Sites module should be built when its UX and
underlying workflow are defined.

## Remaining production blocker

P0 role E2E testing still requires eight additional authenticated test
accounts: manager, member, viewer, technician, inspector,
procurement_officer, operations_manager and contractor. The current database
only had four real testable accounts and this repository connector cannot
create Supabase Auth users. Once those accounts exist, the role-by-role
lifecycle test can be completed against the live project.

## Migration application

`supabase/migrations/20260828010000_fix_semantic_audit_delete_and_audit_read.sql`
must be applied to the target Supabase project through the normal migration
pipeline. Repository changes do not imply that the production database has
already executed the migration.
