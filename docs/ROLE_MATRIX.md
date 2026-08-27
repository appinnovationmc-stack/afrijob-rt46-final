# Role matrix — 2026-08-27

Authoritative source: live `role_permissions` table on `wtbycozfoeiepvgortvx`,
cross-checked against `src/config/roleConfig.ts` (frontend nav) and
`ModuleGuard.tsx` (route guards). RLS policies (audited separately, see
commits `31aeb637` and `b55f555c`) are what actually enforces these grants;
`role_permissions` is the source both RLS's `has_permission()` and the
frontend read from, so it is the correct single source of truth.

## 13 organisation roles (from the `organisation_role` enum) + 1 separate role

owner, admin, manager, supervisor, member, viewer, technician, inspector,
procurement_officer, finance, fleet_manager, operations_manager, contractor
— all governed by `role_permissions`.

`rt46_admin` is **not** in `organisation_role` at all — RT46 admin access is
governed by a separate `rt46.admins` table (`rt46.is_admin()`), unconnected
to the permission matrix below. Confirmed via `roleConfig.ts` line 6
(`rt46_admin` listed in the `OrganisationRole` TS type even though it's not
a real Postgres enum value — the frontend type is slightly wider than the
DB enum; harmless since `rt46_admin` never appears in `organisation_members`,
but worth knowing if that type is used for anything DB-facing).

## Permission × role grid (● = granted, · = not granted)

18 modules exist as permission codes. Columns abbreviated:
O=owner A=admin Mgr=manager Sup=supervisor Mem=member V=viewer
T=technician I=inspector PO=procurement_officer F=finance
FM=fleet_manager OM=operations_manager C=contractor

| permission | O | A | Mgr | Sup | Mem | V | T | I | PO | F | FM | OM | C |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| workorders.view | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| workorders.create | ● | ● | ● | ● | ● | · | ● | ● | ● | · | ● | ● | · |
| workorders.edit | ● | ● | ● | ● | ● | · | ● | ● | ● | · | ● | ● | · |
| assets.view | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| assets.create | ● | ● | ● | ● | ● | · | ● | ● | · | · | ● | ● | · |
| assets.edit | ● | ● | ● | ● | ● | · | ● | ● | · | · | ● | ● | · |
| fleet.view | ● | ● | ● | ● | ● | · | ● | ● | · | · | ● | ● | · |
| fleet.manage | ● | ● | ● | ● | · | · | · | · | · | · | ● | ● | · |
| inventory.view | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| inventory.issue | ● | ● | ● | ● | ● | · | ● | ● | ● | · | ● | ● | · |
| inventory.manage | ● | ● | ● | ● | · | · | · | · | ● | · | ● | · | · |
| procurement.view | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| procurement.create | ● | ● | ● | ● | ● | · | ● | ● | ● | · | · | · | · |
| procurement.approve | ● | ● | · | · | · | · | · | · | · | ● | · | · | · |
| procurement.receive | ● | ● | ● | ● | · | · | · | · | ● | ● | · | · | · |
| maintenance.view | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| maintenance.manage | ● | ● | ● | ● | · | · | · | · | · | · | ● | ● | · |
| incidents.view | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| incidents.report | ● | ● | ● | ● | ● | · | ● | ● | ● | ● | ● | ● | · |
| incidents.manage | ● | ● | ● | ● | · | · | · | · | · | · | ● | ● | · |
| compliance.view | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| compliance.manage | ● | ● | ● | ● | · | · | · | · | · | · | ● | ● | · |
| sites.view | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| sites.manage | ● | ● | ● | ● | · | · | · | · | · | · | ● | ● | · |
| suppliers.view | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| suppliers.manage | ● | ● | ● | ● | · | · | · | · | ● | · | · | · | · |
| serviceproviders.view | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | · |
| serviceproviders.manage | ● | ● | ● | ● | · | · | · | · | · | · | ● | ● | · |
| sla.view | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| sla.manage | ● | ● | · | · | · | · | · | · | · | · | · | · | · |
| notifications.send | ● | ● | ● | ● | · | · | · | · | · | · | ● | ● | · |
| org.manage_members | ● | ● | · | · | · | · | · | · | · | · | · | · | · |
| org.manage_settings | ● | ● | · | · | · | · | · | · | · | · | · | · | · |
| org.manage_billing | ● | ● | · | · | · | · | · | · | · | · | · | · | · |
| org.view_billing | ● | ● | · | ● | · | · | · | · | ● | ● | · | · | · |

## Consistency check: backend permissions vs. frontend nav (`roleConfig.ts`)

**Not a security issue** — RLS enforces at the DB layer regardless of what's
in the nav. This IS a functional/UX gap: several roles are granted
permissions they have no UI path to use.

### Finding 1 — 4 modules have zero nav entry, for ANY role

`sites`, `compliance`, `suppliers`, `serviceproviders` all have real,
correctly-seeded permission codes (`sites.manage`, `compliance.manage`,
etc.) and real RLS policies, but **no `moduleKey` or nav item exists for
them anywhere in `roleConfig.ts`** — confirmed by grepping every
`moduleKey:` in the file (15 found: admin_team, assets, documents, drivers,
finance, incidents, intelligence, inventory, maintenance, notifications,
procurement, sla, trips, work_orders, workspace — none of the 4 above).
Even `owner`/`admin` with full permissions have no menu path to these.
Whatever manages suppliers/sites/compliance/service-providers today must be
happening through generic/undocumented routes, not the persona nav.

### Finding 2 — `manager` and `supervisor` have broad `.manage` grants but a 3-item nav

`manager` nav: workspace, work_orders, intelligence, notifications.
`supervisor` nav: workspace, work_orders, notifications.

Both roles hold `.manage`/`.edit`/`.create` on: incidents, maintenance,
inventory, assets, procurement, fleet, sites, compliance, suppliers — none
of which have a nav item for these roles. They can only reach these via the
generic `/ops/workspace` screen, if that screen surfaces them at all
(not verified in this pass — would need to read the workspace component).

### Finding 3 — `owner`/`admin` nav omits work_orders, incidents, maintenance, fleet

`owner` nav: workspace, intelligence, procurement, assets, notifications,
admin_team. `admin` nav: admin_team, assets, documents, notifications,
intelligence. Both hold full permissions across every module but have no
direct nav entry to work_orders, incidents, maintenance, sla, trips, or
drivers — same "must go through workspace" pattern as Finding 2.

### Finding 4 — smaller, role-specific gaps

- `fleet_manager`: no procurement nav despite `procurement.view=true`
- `procurement_officer`: no work_orders nav despite full workorders.*=true; no incidents nav despite `incidents.report=true`
- `inspector`: no work_orders nav despite full workorders.*=true; no assets nav despite `assets.create/edit=true`
- `technician`: no incidents nav despite `incidents.report=true`
- `member`: only workspace+notifications, despite `workorders.create/edit`, `assets.create/edit`, `procurement.create`, `incidents.report` all granted

## What this does NOT mean

RLS is the real enforcement layer and was already audited (see
`MIGRATION_RECONCILIATION.md` and the two RLS-fix commits). A missing nav
item does not mean a role *can't* do something — it means they'd have to
find an undocumented route to do it, which is a discoverability/UX defect
(matches audit doc section 8, "Role UX", correctly flagged there as P1,
separate from this P0 matrix). Not fixed in this pass — fixing nav is a
product/UX decision (which modules each role should see, not just which
they're technically permitted to touch) that needs your call on which
findings above should become new nav items vs. stay workspace-only by
design.
