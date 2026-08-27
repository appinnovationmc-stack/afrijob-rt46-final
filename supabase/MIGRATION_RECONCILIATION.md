# Migration reconciliation — 2026-08-27

## What's confirmed

Live Supabase project `wtbycozfoeiepvgortvx` has **79 applied migrations**
(`supabase migration list` equivalent via MCP `list_migrations`). This repo
had **43** migration files before this audit. That's a **36-migration gap**
between what's enforcing behaviour in production and what's in git — on top
of at least one prior instance of this same drift (`RT46_STATUS.md` already
flagged 17 migrations reconstructed from schema introspection once before).

Several "matching" filenames also don't match live timestamps exactly
(e.g. `add_procurement_linkage_to_parts_unified` is `20260824040000` in this
repo but applied live as `20260824031816`) — meaning even the files that
exist here are reconstructions, not the byte-for-byte SQL that ran.

## Why this wasn't fully reconstructed in this session

This sandbox's outbound network allowlist does not include `supabase.com` /
`supabase.co`, so `supabase db pull` / `supabase db diff` cannot be run from
here — only the Supabase MCP tool (`execute_sql`, `apply_migration`,
`list_migrations`) is reachable, and that tool does not expose the original
SQL text of already-applied migrations, only current object state via
`pg_catalog`. Hand-transcribing ~65 function bodies, 100+ RLS policies, and
80+ triggers into a single migration file by copy-paste in one sitting was
judged too error-prone for security-relevant SQL to ship without static
verification — the exact shortcut this project has already flagged once.

## What to actually run to close this gap

From a machine with real network access to Supabase (i.e. **not** this
sandbox):

```bash
supabase link --project-ref wtbycozfoeiepvgortvx
supabase db pull
```

This will pull the true current schema (tables, functions, policies,
triggers, grants) and either generate a single reconciling migration or
show exactly what's missing from `supabase/migrations/`. Commit whatever
it generates as `<timestamp>_reconcile_live_schema.sql`.

## Full list of the 79 migrations live in production, for cross-reference

(name — version)

create_rt46_fleet_allocation_schema — 20260816004251
rt46_module1_insurance_compliance — 20260816012308
rt46_module1_insurance_functions — 20260816012327
rt46_module2_fair_allocation — 20260816012914
rt46_quality_checklists_and_rework — 20260816014713
rt46_sla_tracking — 20260816104609
rt46_fraud_expansion_and_suspend — 20260816104636
rt46_merchant_verification — 20260816104718
rt46_parts_pricing_integrity — 20260816104737
rt46_evidence_storage_bucket — 20260816105050
rt46_fix_sla_status_bug_and_delay_attribution — 20260816223214
rt46_fix_price_variance_format_bug — 20260817000000
rt46_fix_completed_at_and_grants — 20260817000100
organisation_invitations — 20260820120000
expand_organisation_roles — 20260820130000
seed_role_permissions_new_roles — 20260820130100
platform_audit_log — 20260820170459
harden_function_privileges_and_search_path — 20260820220348
revoke_public_execute_reapply_authenticated_grant — 20260820220413
revoke_remaining_anon_grants — 20260820220437
optimize_rls_auth_calls_batch1 — 20260820220603
optimize_rls_auth_calls_batch2_rt46 — 20260820223822
fix_rt46_vehicles_and_allocation_config_rls — 20260821230214
unify_parts_job_parts_and_inventory_movements — 20260821230502
add_asset_id_to_work_order_parts_unified_v2 — 20260821231427
rt46bridge_audit_assets_lifecycle — 20260822000502
extend_generic_audit_coverage — 20260823235817
fix_parts_unified_double_count — 20260824005254
rt46_audit_inventory_and_maintenance — 20260824013022
link_inventory_receipts_to_purchase_order_items — 20260824015006
add_audit_log_severity — 20260824015838
platform_audit_role_permissions — 20260824030243
harden_role_permission_audit_function — 20260824030329
fix_role_permission_audit_function_anon_grant — 20260824030420
add_procurement_linkage_to_parts_unified — 20260824031816
global_search — 20260824112804
platform_admins — 20260824113413
phase_k_api_keys_foundation — 20260824115723
phase_k_lock_down_validate_api_key — 20260824115745
phase_k_fix_validate_api_key_no_match_bug — 20260824115819
lock_billing_accounts_writes_to_platform_admin — 20260824121208
extend_global_search_entity_coverage — 20260824172343
fix_accept_invitation_email_lookup — 20260824234150
drop_duplicate_log_audit_overload — 20260824234248
lock_down_security_definer_functions — 20260825000116
fix_work_order_parts_unified_security_definer — 20260825000127
lock_down_security_definer_functions_v2 — 20260825000207
lock_down_security_definer_functions_v3 — 20260825000234
fix_global_search_search_path — 20260825000300
lock_down_refresh_document_vault_statuses — 20260825000355
lock_down_apply_inventory_movement_trigger_fn — 20260825000417
auto_accept_invitations_on_email_confirmation — 20260825000449
auto_accept_invitations_on_insert_if_already_confirmed — 20260825000501
add_missing_fk_indexes — 20260825001813
drop_redundant_unique_constraint_role_permissions — 20260825001844
fix_platform_admins_rls_recursion — 20260825001955
consolidate_multiple_permissive_policies — 20260825002441
fix_platform_audit_log_rls_initplan — 20260825002936
restrict_billing_accounts_select_to_admins — 20260825003912
accept_invitation_also_grants_workshop_membership — 20260825004541
backfill_workshop_membership_for_invited_members — 20260825004552
gate_jobs_write_by_org_permission — 20260825004601
revoke_public_execute_on_trigger_functions — 20260825114530
fleet_drivers_and_trips — 20260825222121
fleet_vehicle_insurance — 20260826171509
secure_billing_entitlements — 20260826191216
revoke_public_execute_billing_escalation_trigger — 20260826200008
domain_events_layer — 20260826223127
work_order_created_via_and_risk_scoring — 20260826223207
generic_ops_audit_triggers — 20260827010918
fleet_trip_integrity — 20260827010926
tighten_manager_role_permissions — 20260827011434
lock_down_internal_trigger_and_cron_functions — 20260827011632
remove_finance_procurement_create_self_approval — 20260827015212
fix_ambiguous_organisation_id_in_rls_policies — 20260827051602
fix_accept_invitation_ambiguous_organisation_id — 20260827051828
link_purchase_orders_to_work_orders — 20260827124952
reinforce_finance_fleet_permissions — 20260827144350
gate_work_orders_write_by_org_permission — 20260827150529   (this session — file present)

## Verified NOT a gap, this session

- RLS is enabled on 100% of tables in `public` and `rt46` schemas.
- Core authorization functions (`is_org_member`, `is_org_admin`,
  `is_platform_admin`, `has_permission`) are `SECURITY DEFINER`, search_path
  locked, and correctly exclude pending invitees (`joined_at is not null`).
- `work_orders` write policies now gate on `has_permission(...)`, matching
  `jobs` (fixed and verified this session — see migration above).
