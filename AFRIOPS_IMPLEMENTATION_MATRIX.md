# AfriOps Implementation Matrix

Status as of this session, against the target architecture diagram. Every row below is backed by either a live query against the production Supabase project (`wtbycozfoeiepvgortvx`) or a direct code check in `afrijob-rt46-final` — not inferred from naming or memory. Where I couldn't verify something (mobile builds, most RLS boundary testing), it's marked UNVERIFIED rather than guessed at.

Legend: **DONE** = backend + UI + permissions + workflow all real and working · **PARTIAL** = some real layers exist, others don't · **NOT STARTED** = no evidence found anywhere.

## Core operating model

| Item | Status | Evidence |
|---|---|---|
| Organisation | DONE | `organisations` table live, `useOrganisation()` hook resolves membership + role + industry_mode + enabled_modules, used throughout Ops UI. |
| Sites / Business Units | DONE | `sites`, `business_units` tables live; Asset Registry page has working create forms for both, wired to real hooks. |
| Teams (members/roles) | DONE | `organisation_members`, `role_permissions`, 13-role RBAC, Team page with invite/role-change/remove — built and live-verified this session. |
| Industry Mode (enum) | DONE | Live enum has all 5 values: mining, fleet, municipal, government, logistics. |
| Industry Mode (actually controls the app) | **PARTIAL** | Only effect right now: a text badge on the Ops dashboard header, and `enabled_modules`-based nav filtering (defensive, unverified shape). No mode-specific terminology, asset types, work-order categories, dashboards, or KPIs anywhere — this is the single biggest gap between current state and the target diagram. |
| Assets | DONE | `assets` table live with full identity/meter/lifecycle fields; Asset Registry list + create form; Asset 360 detail page built this session. |
| Asset 360 as canonical record | **PARTIAL** | Overview, Work Orders (unified), Maintenance, Incidents, Documents tabs are real and live. Parts, Procurement, and Financial-history tabs are **not built yet** — schema partially supports parts (see below) but no UI surfaces it on the asset. |
| Work Orders — unified table | DONE (backend) | `work_orders` has a `source_system` column (`afrijob`/`rt46`/`native`); live data confirms 5/5 rows tagged, and the one legacy job is linked via `jobs.generic_work_order_id`. Confirmed live, not assumed. |
| Work Orders — unified UI | **PARTIAL** | Only exposed today via Asset 360's Work Orders tab. No standalone canonical Work Order list/detail page yet. RT46 pages (`Rt46WorkOrders.tsx`) still query RT46's own tables directly rather than the unified view. |
| Maintenance | **PARTIAL** | `maintenance_schedules` real, shown in Asset 360. Auto-generation of a real work order from a due schedule — **not verified**; no code found that does this. |
| Incidents | **PARTIAL** | `incidents` table real, shown in Asset 360 (category/severity/status/description). No investigation/corrective-action/root-cause workflow found — current shape is report + status only. |
| Parts | **PARTIAL, fragmented** | Two separate homes: `job_parts` (linked only to legacy `jobs`) and `inventory_movements` (has `work_order_id`, linked to generic work orders). Neither is surfaced in Asset 360 yet. This is a concrete, real instance of the "two systems" problem — not fixed by the work_orders unification alone. |
| Documents | DONE | `document_vault` is polymorphic (`entity_type`/`entity_id`), already works for assets with zero schema change — built and shown in Asset 360 this session. |
| Cost / Performance | **PARTIAL** | Asset 360 sums `work_orders.actual_cost` for a running total. No performance/utilisation metrics, no cross-asset cost analytics. |
| Analytics + AI | NOT STARTED | No analytics tables/pages beyond the basic Ops dashboard KPI tiles built earlier this session (SLA breaches, maintenance due, incidents, low stock counts). No AI-related code or architecture anywhere. |

## Underlying layer

| Item | Status | Evidence |
|---|---|---|
| RBAC | DONE | `has_permission()` confirmed live to do a dynamic `role_permissions` lookup (pulled and read the actual function body this session) — not hardcoded. 13 roles, all seeded, all functional. |
| RLS | **DONE for what was checked** | Verified live, not assumed: RLS is enabled on all 20 organisation-scoped tables checked (assets, work_orders, organisations, organisation_members, role_permissions, audit_log, document_vault, incidents, maintenance_schedules, inventory_items/movements, purchase_orders/items, suppliers, service_providers, notifications, billing_accounts, sites, business_units, asset_types, organisation_invitations). Pulled actual policy definitions (not just "RLS enabled"): every SELECT/UPDATE/DELETE/INSERT policy checked genuinely gates on `is_org_member()` or `has_permission()` — none are permissive (`using (true)`) except `role_permissions` SELECT, which is intentionally global (it's a role→permission reference table with no tenant data in it, not a leak). Read both `is_org_member()` and `is_org_admin()` function bodies directly — both correctly check `auth.uid()` against real membership rows, not stubbed. **Not yet done:** no actual test as a second, different authenticated user confirming a real cross-org read is blocked in practice — this checks the policies are *written* correctly, not that they behave correctly end-to-end under a live second tenant. |
| Audit | **PARTIAL** | `audit_log` table is real, well-shaped (actor/entity/before/after/metadata), and has live rows — but only `useRt46.ts` writes to it. Nothing in Ops/AfriJob writes to it. Not the generic, all-actions audit system section 22/25 asks for. |
| Notifications | **PARTIAL** | `notifications` and `notification_preferences` tables exist, there's an Ops Notifications page — depth (which events actually trigger a notification) not verified this session. |
| Offline | **PARTIAL, fragmented** | Legacy AfriJob (Dexie/`offlineDb.ts`) has real offline queueing. Ops modules (inventory, procurement, incidents, maintenance) have **none** — confirmed no offline logic in any Ops hook. |
| Integrations | NOT STARTED | No integration/webhook/external-API tables or code found. |
| Billing | **PARTIAL** | `billing_accounts` table is real and genuinely provider-abstract (`provider`, `plan`, `status`, `trial_ends_at`, `external_account_ref` — no USC Pay coupling at the schema level, matches the mandate's requirement). No UI anywhere reads or writes it. |
| Super Admin | NOT STARTED | No super-admin table, route, page, or reference anywhere in the codebase. |
| API | NOT STARTED (as a deliberate product surface) | The app talks to Supabase's auto-generated REST/RPC API directly from the client — there's no separate, versioned, documented AfriOps API for external integration. |
| Global Search | NOT STARTED | No search table, index, or UI component anywhere in the codebase (confirmed by grep — one false-positive match was `useSearchParams`, unrelated). |
| Role-specific dashboards | NOT STARTED | 4 dashboards exist (`Dashboard.tsx`, `OpsDashboard.tsx`, `SlaDashboard.tsx`, `Rt46Dashboard.tsx`) — all are **feature-specific**, not **role-specific**. No Technician/Procurement/Compliance/Executive dashboard variants exist. |
| Mobile / Capacitor | UNVERIFIED | `capacitor.config.ts` present, referenced in prior sessions per project history — this sandbox has no Android/iOS SDKs, so I cannot verify `npx cap sync` or a real device/simulator build succeeds. Genuinely unknown from here. |

## What this matrix implies about priority

The single highest-leverage gap is **industry mode actually controlling anything** — it's real in the schema, inert in the product. Second: **Parts is split exactly like work orders used to be** (`job_parts` vs `inventory_movements`), and nobody's unified it yet — Asset 360 can't show a real parts history until that's resolved, one way or the other. Third: **RLS/cross-org isolation is untested**, which is a security question, not a features question, and probably shouldn't wait behind everything else on this list.
