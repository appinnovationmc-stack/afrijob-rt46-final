-- Security review (handover doc section 3.6 / Supabase security advisor):
-- six internal-only functions were directly callable via
-- /rest/v1/rpc/<function_name> by anon and/or authenticated, even though
-- none of them are referenced anywhere in the application and none take
-- the kind of caller-scoping parameter that would make direct RPC access
-- safe.
--
--   * audit_ops_mutation, emit_domain_event, prevent_self_service_billing_escalation,
--     trg_recalculate_asset_risk_score -- return type `trigger`; can only be
--     invoked correctly by the trigger manager, never directly.
--   * recalculate_asset_risk_score, sweep_maintenance_due -- internal batch
--     jobs. sweep_maintenance_due in particular takes no parameters at all
--     and would run a global, cross-organisation sweep for any caller,
--     including an unauthenticated one.
--
-- Revoking EXECUTE from anon/authenticated/public does not affect trigger
-- firing (the trigger manager invokes trigger functions directly, not
-- through role EXECUTE privilege) and does not affect any legitimate app
-- code path -- none of these six functions are called from the frontend.

revoke all on function public.audit_ops_mutation() from public, anon, authenticated;
revoke all on function public.emit_domain_event() from public, anon, authenticated;
revoke all on function public.prevent_self_service_billing_escalation() from public, anon, authenticated;
revoke all on function public.trg_recalculate_asset_risk_score() from public, anon, authenticated;
revoke all on function public.recalculate_asset_risk_score(uuid) from public, anon, authenticated;
revoke all on function public.sweep_maintenance_due() from public, anon, authenticated;
