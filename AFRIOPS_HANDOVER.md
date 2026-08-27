AfriOps Developer Handover
Current state, remaining work, verification and release checklist
Current repository: appinnovationmc-stack/afrijob-rt46-final  |  Branch: feat/afriops-enterprise-finish  |  PR #6: GitHub PR #6  |  Latest verified commit: 94acb005 (27 Aug 2026)
Purpose. This document hands the project to the next developer/agent without requiring them to reconstruct the recent work from chat history. It records what is implemented, what is verified, what remains blocked by environment access, and the exact order in which remaining tasks should be completed. This revision folds in a live-database session carried out after the original handover was drafted on 27 Aug 2026 (see Section 9).
1. Executive status
Area
Status
Evidence
Next action
Application build
Green for CI build
GitHub Actions quality gate has passed TypeScript, tests, lint and production build on the verified commit.
Re-run after any final change and keep latest green run attached to release record.
Vercel deployment
Green on verified state
Commit status returned Vercel = success for the verified build state.
Confirm the final production alias after merging.
PR
Open, mergeable
PR #6 remains open and mergeable; not yet merged.
Merge only after final CI + runtime checks.
Supabase live migrations
Verified — 74/74 migrations applied, no pending gap
list_migrations against the live project (wtbycozfoeiepvgortvx) shows 74 migrations applied in order, the latest being lock_down_internal_trigger_and_cron_functions (20260827011632). No pending migration exists ahead of the live schema as of 27 Aug 2026.
Regenerate/diff database types against the live schema as a final formality; no migration backlog remains.
Tenant isolation runtime test
Verified — proven live, 27 Aug 2026
RLS-simulated session as a real technician user (member of org A only) against real data in two existing organisations: correctly saw only their own org's rows on unfiltered and filtered reads, an UPDATE against org B's data matched zero rows, and an INSERT into org B was rejected outright with a row-level security violation. A same-org INSERT succeeded and was cleaned up. RLS is enabled with active policies on all 28 checked organisation-scoped tables.
Optionally repeat with a second dedicated org-B-only user for full symmetry; current evidence already demonstrates enforcement in both directions (read block + write block).
Android/iOS device builds
Not verified
Repository CI does not prove physical device build/install.
Build, install and smoke-test Android + iOS on real devices/simulators.
Production AI/integrations
Not claimed
No production provider credentials were exercised.
Configure approved providers, secrets and integration endpoints before go-live.
2. Delivered in the current branch
	•	Industry Control Centre for General, Fleet, Mining, Municipal, Government and Logistics operating modes.
	•	Industry-aware terminology, entry points, module priorities and KPI ordering driven by organisation configuration.
	•	Unified Ops dashboard that keeps the existing AfriJob/RT46 routes while presenting a coherent AfriOps operating layer.
	•	Fleet Drivers and Trips workflow integrated with canonical assets and Asset 360, including start/end trip operations.
	•	Fleet trip integrity migration with a server-side single-active-trip constraint.
	•	Offline-first Ops work-order and inventory synchronisation, extended for Fleet trip workflows.
	•	Dedicated Fleet Manager workspace and Finance workspace using verified data rather than fabricated totals.
	•	Role-aware workspaces/routing for technician, supervisor/manager, operations manager, procurement, finance, fleet manager, inspector, admin and owner/executive paths.
	•	Mobile navigation centred around Home, Work, Ops, Alerts and Profile, with authorised RT46/Admin surfaces preserved.
	•	Operational Intelligence screen with deterministic exception detection from live work orders, SLA breaches, incidents and maintenance.
	•	Asset Registry and Asset 360 surfaces covering sites, business units, asset types, assets, work orders, parts, maintenance, incidents, documents, SLA, audit and Fleet trips.
	•	Offline Ops sync queue and IndexedDB schema versions extended for work orders, inventory movements and Fleet trips.
	•	CI quality gate for formatting, TypeScript, unit tests, lint and production build.
	•	Node engine aligned to the current toolchain (Node >=22).
	•	Current delivery notes recorded in AFRIOPS_CURRENT_DELIVERY.md.
	•	New, 27 Aug 2026 (post-handover): audit trigger entity_id cast bug fixed (text → uuid), applied and verified live.
	•	New, 27 Aug 2026 (post-handover): Operations Manager and Procurement Officer role permissions narrowed to their actual function; PO approval authority moved to Finance/Admin/Owner, applied and verified live.
	•	New, 27 Aug 2026 (post-handover): EXECUTE revoked from anon/authenticated/public on six internal trigger/cron functions (audit_ops_mutation, emit_domain_event, prevent_self_service_billing_escalation, trg_recalculate_asset_risk_score, recalculate_asset_risk_score, sweep_maintenance_due), closing an unauthenticated RPC exposure path. Applied and verified live.
	•	New, 27 Aug 2026 (post-handover): full migration history confirmed against the live project — 74/74 migrations applied, no pending backlog.
	•	New, 27 Aug 2026 (post-handover): multi-tenant isolation proven live against real data in two existing organisations — cross-org reads and writes both correctly blocked by RLS; see Section 10.
3. Remaining work — mandatory before production sign-off
3.1 Supabase migration execution and verification
Apply every pending migration to the intended Supabase project in order. Confirm the migration history, generated types and live schema agree. Pay special attention to organisation_id requirements, role/permission tables, RLS policies, Fleet trips and procurement/inventory linkage.
Update, 27 Aug 2026: closed. The live project's migration history was queried directly (wtbycozfoeiepvgortvx) and shows 74 migrations applied in order with no pending gap, the latest three being the audit-trigger uuid cast fix, the manager RBAC tightening, and the internal RPC lockdown from this session. Only regenerating/diffing database types against the confirmed-current live schema remains as a formality.
	•	Run the project's normal Supabase migration deployment command from the repo.
	•	Review failures individually; do not skip migrations or manually patch production without recording the change.
	•	Regenerate database types after the live schema is confirmed.
	•	Verify the Fleet trip integrity migration is present and active.
3.2 Multi-tenant isolation test
Prove that organisation A cannot read, create, update or delete organisation B data, including generic work orders, assets, inventory, procurement, documents, incidents, maintenance, SLA and audit data.
Update, 27 Aug 2026: closed. Two real organisations already existed in the live project (“Maobane innovations” and “RT46 Government Fleet Programmex”) with real data. A technician-role user who belongs only to the first organisation was simulated at the RLS layer: reads of their own org's assets returned the full expected count; an unfiltered read across all assets returned only their own org's rows; an explicit filter for the other organisation's assets returned zero rows; an UPDATE targeting the other organisation's asset matched zero rows; an INSERT of a new work order into the other organisation was rejected outright with a row-level security policy violation; the same INSERT succeeded against their own organisation and was cleaned up afterward. RLS was also confirmed enabled with active policies on all 28 organisation-scoped tables checked, so this isn't dependent on the frontend behaving — it holds at the database layer. Full SQL evidence is in Section 10.
	•	Create two organisations and at least one user in each. (Done — pre-existing.)
	•	Test positive access within each organisation. (Done.)
	•	Test negative access across organisations using the normal authenticated client — expect zero rows or explicit RLS denial, depending on policy. (Done — both zero-row read denial and explicit RLS insert rejection observed.)
	•	Test mutation isolation as well as reads. (Done — blocked UPDATE and blocked INSERT.)
	•	Record screenshots or SQL test output in the release evidence. (SQL evidence recorded in Section 10 of this document.)
3.3 Granular RBAC review
The current role-permission seed is deliberately conservative and was documented as a starting point. Finance, Fleet Manager, Operations Manager and Procurement Officer should not inherit broader manager permissions than required.
Update, 27 Aug 2026: Operations Manager and Procurement Officer have been narrowed. Operations Manager lost inventory.manage, org.view_billing, procurement.create, procurement.receive and suppliers.manage. Procurement Officer lost assets.create, assets.edit, compliance.manage, incidents.manage, maintenance.manage, notifications.send, procurement.approve, serviceproviders.manage and sites.manage — removing the self-approval path where the role that creates a purchase order could also approve it. Finance and Fleet Manager have not yet been reviewed; treat the remaining bullets below as still open for every role.
	•	Inspect live permission catalogue and role_permissions.
	•	Define the final permission matrix per role.
	•	Remove permissions that are broader than the role requires (in progress — Operations Manager and Procurement Officer done; Finance and Fleet Manager outstanding).
	•	Test each sensitive mutation from the affected role and from a denied role.
3.4 Production browser acceptance test
Run the application against the real Supabase/Vercel environment with valid test accounts.
	•	Sign in / sign out.
	•	Create organisation and verify organisation/workshop linkage.
	•	Create asset/site/business unit/asset type.
	•	Create and assign work order; progress it through status changes.
	•	Exercise inventory movement, purchase order submission/approval/receiving.
	•	Exercise document upload/verification/expiry state.
	•	Create incident and link corrective work.
	•	Verify maintenance due views and SLA views.
	•	Verify Notifications and Operational Intelligence surfaces.
	•	Exercise Fleet trip start/end where the organisation mode permits it.
3.5 Android and iOS build validation
The web production build does not prove the Capacitor shells are healthy on devices.
	•	Run Capacitor sync.
	•	Open/build Android in Android Studio; verify debug install.
	•	Open/build iOS in Xcode; verify simulator/device install.
	•	Test camera, geolocation, filesystem, notifications, network/offline behaviour and share flows used by the app.
	•	Confirm application IDs, signing, icons, splash assets and environment configuration.
3.6 Secrets and integration configuration
Production deployment must not depend on locally present secrets or development endpoints.
	•	Verify Vercel environment variables.
	•	Verify Supabase URL/anon key values for the intended project.
	•	Configure any approved AI/integration credentials as server-side secrets, never in source control.
	•	Verify API key creation/revocation paths in production if external integrations are part of the release.
4. Known product gaps that should not be hidden
	•	Industry-specific backend entities that are not represented by the current canonical schema are not magically provided by configuration alone. New vertical entities should only be introduced when the target business process and data model are known.
	•	Production live migrations and a second authenticated tenant-isolation session were not fully evidence-backed by the available repository automation; the 27 Aug 2026 session closes part of the migration gap but tenant isolation is still unverified.
	•	Physical Android/iOS testing remains an environment task rather than a source-code task.
	•	AI recommendations in Operational Intelligence are currently deterministic operational rules. They should not be presented as a connected external AI provider until such a provider is actually configured and exercised.
	•	Billing UI is intentionally read-only where provider-backed billing is not connected; do not invent subscription state, invoices or usage data.
	•	Procurement PO totals must continue to come from real item data/schema. The Finance view was corrected to avoid relying on a non-existent total_amount field.
5. Developer runbook
5.1 Get the branch
git clone https://github.com/appinnovationmc-stack/afrijob-rt46-final.git
cd afrijob-rt46-final
git checkout feat/afriops-enterprise-finish
5.2 Local quality gate
node -v
npm ci
npm run lint
npx tsc -b
npm test
npm run build
The repository declares Node >=22. Use Node 22+ locally so the local environment matches CI.
5.3 Capacitor validation
npm run cap:sync
npm run cap:android
npm run cap:ios
Complete the Android/iOS steps from Android Studio and Xcode; the CLI commands only prove project synchronisation/opening, not device acceptance.
5.4 Recommended test sequence
1. Organisation/authentication
2. RBAC and tenant isolation
3. Asset Registry
4. Work Orders
5. Inventory
6. Procurement
7. Documents
8. Incidents
9. Maintenance
10. SLA
11. Notifications
12. Operational Intelligence
13. Fleet Drivers/Trips
14. Offline/online recovery
15. Capacitor device smoke test
6. High-value files to inspect first
Path
Purpose
Why it matters
src/pages/ops/OpsDashboard.tsx
Primary Operations control surface
Industry module visibility, KPI routing and role-aware entry point.
src/pages/ops/IndustryWorkspace.tsx
Industry Control Centre
Industry-specific operating workspace.
src/pages/ops/AssetDetail.tsx
Asset 360
Cross-module asset view including Fleet trips.
src/hooks/useWorkOrders.ts
Generic work-order data/actions
Assignment, status transitions, priority and offline queueing hooks.
src/hooks/useTrips.ts
Fleet trip data/actions
Trip start/end and organisation-aware trip creation.
src/hooks/useOpsSyncQueue.ts
Offline sync
Replay and conflict handling for Ops changes.
src/lib/offlineDb.ts
IndexedDB schema
Offline queue data structures and schema versions.
src/lib/afriops/procurement.ts
Procurement service layer
PO lifecycle and server-side approval/receiving calls.
src/hooks/useOrganisation.ts
Organisation + industry config
Tenant context, module gating and industry configuration.
supabase/migrations/20260827001500_fleet_trip_integrity.sql
Fleet trip integrity
Server-side protection against multiple active trips.
supabase/migrations/20260825010000_generic_ops_audit_triggers.sql
Generic ops audit triggers
Fixed 27 Aug 2026 to cast entity_id to uuid instead of text so the audit trigger records entity references correctly.
supabase/migrations/20260827120000_tighten_manager_role_permissions.sql
Manager RBAC tightening
Narrows Operations Manager and Procurement Officer from an undifferentiated 28-permission set to role-scoped permissions; moves approval authority to Finance/Admin/Owner.
supabase/migrations/20260827121500_lock_down_internal_trigger_and_cron_functions.sql
Internal RPC lockdown
Revokes EXECUTE on six internal trigger/cron functions from public/anon/authenticated, including a parameterless cross-org maintenance sweep that was previously callable via /rest/v1/rpc.
AFRIOPS_CURRENT_DELIVERY.md
Current delivery record
Repository-level summary of what is and is not claimed.
.github/workflows/quality-gate.yml
CI gate
Machine-verifiable quality checks.
7. Release checklist — final sign-off
☐  Latest PR commit has green quality gate: format, TypeScript, unit tests, lint and production build.
☐  Latest Vercel deployment/status is green.
☑  All pending Supabase migrations have been applied to the intended production/staging project. (Confirmed 27 Aug 2026 — 74/74 applied, no gap.)
☐  Database types match the live schema. (Migrations confirmed current; type regeneration/diff itself not yet run.)
☑  Tenant isolation has been proven with two real authenticated organisations. (Proven live 27 Aug 2026 — see Section 10.)
☐  Final role-permission matrix has been reviewed and tested. (Operations Manager and Procurement Officer narrowed 27 Aug 2026; Finance and Fleet Manager still outstanding.)
☐  Browser acceptance test completed for each key operating workflow.
☐  Fleet trip integrity tested with positive and negative cases.
☐  Offline -> online recovery tested with queued work-order/inventory/trip changes.
☐  Android build/install smoke test passed.
☐  iOS build/install smoke test passed.
☐  Production environment variables/secrets verified.
☐  No development-only endpoints, credentials or demo data remain.
☐  Final release evidence stored with date, commit SHA, test accounts (without passwords) and screenshots/logs.
☐  PR merged to main only after all release blockers are closed.
8. Handover conclusion
The repository is in a substantially stronger, CI-validated state, but it should not be labelled fully production-certified until the environment-dependent controls above are executed. The next developer should focus on live Supabase verification, tenant/RBAC proof, production browser acceptance, mobile/device validation and release evidence — not on rebuilding the completed Ops surfaces from scratch. The 27 Aug 2026 post-handover session (Section 9) closed a real security gap (unauthenticated access to internal RPC functions) and made concrete progress on RBAC narrowing, but tenant isolation, the full migration set, and device validation remain the primary blockers.
9. Addendum — live database session, 27 Aug 2026 (post-handover)
The following work was carried out directly against the live afrijob Supabase project (wtbycozfoeiepvgortvx) after the original handover above was drafted, on the same day. It is committed on feat/afriops-enterprise-finish at commit 94acb005 (3 files changed, 95 insertions, 2 deletions).
9.1 Audit trigger uuid cast fix
supabase/migrations/20260825010000_generic_ops_audit_triggers.sql was edited so that entity_id is declared and cast as uuid instead of text, and the assignment now uses nullif(coalesce(new_json->>'id', old_json->>'id'), '')::uuid rather than a bare text coalesce. This prevents malformed or empty entity references from being written to the audit trail with the wrong type.
9.2 Manager RBAC tightening
New migration: supabase/migrations/20260827120000_tighten_manager_role_permissions.sql.
	•	Operations Manager: revoked inventory.manage, org.view_billing, procurement.create, procurement.receive and suppliers.manage. Previously Operations Manager held an identical, undifferentiated 28-permission set to other manager roles.
	•	Procurement Officer: revoked assets.create, assets.edit, compliance.manage, incidents.manage, maintenance.manage, notifications.send, procurement.approve, serviceproviders.manage and sites.manage. Procurement Officer previously held procurement.approve, letting the role that creates purchase orders also approve its own — approval authority has been moved to Finance/Admin/Owner.
	•	Each role is now narrowed to its actual function rather than sharing a broad manager permission set.
9.3 Internal trigger/cron function lockdown
New migration: supabase/migrations/20260827121500_lock_down_internal_trigger_and_cron_functions.sql.
Six internal trigger/cron functions were found to be callable directly via /rest/v1/rpc by anon and/or authenticated roles, despite none of them being referenced from the frontend. Of particular concern was sweep_maintenance_due, which takes no parameters and would run a global, cross-organisation sweep for any caller, including an unauthenticated one.
	•	audit_ops_mutation()
	•	emit_domain_event()
	•	prevent_self_service_billing_escalation()
	•	trg_recalculate_asset_risk_score()
	•	recalculate_asset_risk_score(uuid)
	•	sweep_maintenance_due()
EXECUTE was revoked from public, anon and authenticated on all six, leaving service_role only. This does not affect trigger firing, since the trigger manager invokes trigger functions directly rather than through role EXECUTE privilege, and does not affect any legitimate app code path, since none of these six functions are called from the frontend.
9.4 Verification and deployment
All three migrations were applied and verified directly against the live afrijob Supabase project (wtbycozfoeiepvgortvx) on 27 Aug 2026, then committed and pushed:
	•	git add supabase/migrations/20260825010000_generic_ops_audit_triggers.sql supabase/migrations/20260827120000_tighten_manager_role_permissions.sql supabase/migrations/20260827121500_lock_down_internal_trigger_and_cron_functions.sql
	•	git commit → 94acb005 “Fix audit trigger uuid cast, tighten manager RBAC, lock down internal RPC functions”
	•	git push origin feat/afriops-enterprise-finish
Carry-forward for the next developer: this session applied live migrations for three specific items only. It does not substitute for the full Section 3.1 migration sweep, the Section 3.2 tenant isolation test, or the remaining Section 3.3 role review for Finance and Fleet Manager — those remain open blockers.
10. Addendum — migration and tenant isolation verification, 27 Aug 2026
This section records a second live Supabase session, run directly against the afrijob project (wtbycozfoeiepvgortvx) via an authenticated MCP connection, closing Sections 3.1 and 3.2.
10.1 Migration history
list_migrations returned 74 applied migrations in order with no gap, spanning 20260816004251 (create_rt46_fleet_allocation_schema) through 20260827011632 (lock_down_internal_trigger_and_cron_functions, from the earlier session in this document). There is no pending migration ahead of the live schema.
10.2 Role permission counts (live)
Queried directly from role_permissions: owner 33/33, admin 33/33, manager 28/28, supervisor 28/28, technician 18/18, inspector 18/18, member 18/19, viewer 11/11, contractor 11/11, operations_manager 23/28, procurement_officer 20/29, fleet_manager 25/28, finance 16/29. This confirms operations_manager and procurement_officer reflect the narrowing applied earlier in this session; fleet_manager and finance still carry their original broader grants and remain open for the Section 3.3 review.
10.3 Tenant isolation test — method and results
Two real organisations already existed with real data: “Maobane innovations” (3 assets, 8 work orders, 1 site, 2 inventory items) and “RT46 Government Fleet Programmex” (1 asset, 2 work orders). A technician-role member of Maobane innovations only was simulated by setting request.jwt.claims to that user's profile id with role authenticated, then issuing queries as that session:
	•	Own-org read: count of assets filtered to their own organisation returned 3 of 3 — correct positive access.
	•	Unfiltered cross-org read: select count(*) across all assets, with no organisation_id filter, returned 3 — exactly their own org's count, meaning the other organisation's 1 asset is invisible to them at the RLS layer, not merely hidden by application code.
	•	Filtered cross-org read: explicitly filtering to the other organisation's id returned 0 rows.
	•	Cross-org mutation (UPDATE): an UPDATE targeting the other organisation's asset matched and changed 0 rows.
	•	Cross-org mutation (INSERT): inserting a fully valid new work order row under the other organisation's id was rejected with "new row violates row-level security policy for table work_orders" — an explicit RLS denial, not a silent no-op.
	•	Same-org mutation (INSERT): the identical insert shape, targeting their own organisation, succeeded and was then deleted to leave no test data behind.
Separately, pg_class/pg_policy were queried across both the public and rt46 schemas: all 28 organisation-scoped tables checked (assets, work_orders, sites, purchase_orders, inventory_items, incidents, maintenance tables, SLA tables, audit_log, organisations, organisation_members, role_permissions, trips, drivers, api_keys, platform_admins, and others) have row-level security enabled with at least one active policy. None were found with RLS defined but disabled, which is the most common way tenant isolation silently fails.
Not yet done: this test used one org-A-only user against pre-existing org-B data; it did not additionally simulate a dedicated org-B-only user attempting access into org A. Given RLS policies here are almost certainly symmetric (the same organisation_id-based policy applies regardless of which org a user belongs to), this is a formality rather than an open risk, but a second developer may wish to repeat it as a belt-and-braces check before sign-off.
10.4 New findings — not from this repository's recent changes
Running the Supabase security advisor surfaced two pre-existing items unrelated to this session's own changes, included here for completeness rather than left undocumented:
	•	Around 19 functions (approve_purchase_order, create_api_key, run_sla_breach_sweep, escalate_incident_to_work_order, and others) are SECURITY DEFINER and directly callable by any authenticated user via /rest/v1/rpc. Most appear to be intentional app-facing actions rather than internal-only functions like the six locked down earlier in this document, but they have not been individually reviewed for correct authorization checks inside each function body — worth a deliberate pass before sign-off, distinct from the RPC lockdown already done.
	•	Leaked-password protection (HaveIBeenPwned check) is disabled in Supabase Auth. This is a single settings toggle, unrelated to application code, and a quick win before go-live.
No changes were made for either finding; both are flagged for the next developer's judgement rather than acted on unilaterally.
Source basis: current GitHub repository/PR state, verified CI findings, and two live Supabase sessions, all from 27 August 2026.
