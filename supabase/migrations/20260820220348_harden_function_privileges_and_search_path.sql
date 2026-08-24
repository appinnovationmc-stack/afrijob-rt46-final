-- 1. Fix mutable search_path on the two flagged functions (prevents search_path hijacking)
alter function public.compute_document_status(date) set search_path = public;
alter function public.document_vault_set_status() set search_path = public;

-- 2. Defense-in-depth: revoke EXECUTE from anon on all business-mutation RPCs.
-- These all have internal has_permission()/auth.uid() checks already, so this isn't
-- fixing a live hole -- it removes the anon role's ability to even attempt the call,
-- so a future bug in one of these functions can't be reached by an unauthenticated caller.
revoke execute on function public.apply_inventory_movement() from anon;
revoke execute on function public.approve_purchase_order(uuid) from anon;
revoke execute on function public.attach_sla_to_work_order(uuid) from anon;
revoke execute on function public.escalate_incident_to_work_order(uuid, public.work_order_priority) from anon;
revoke execute on function public.receive_purchase_order_item(uuid, numeric) from anon;
revoke execute on function public.record_sla_resolution(uuid) from anon;
revoke execute on function public.record_sla_response(uuid) from anon;
revoke execute on function public.refresh_document_vault_statuses() from anon;
revoke execute on function public.run_due_maintenance_schedules(uuid) from anon;
revoke execute on function public.run_sla_breach_sweep(uuid) from anon;
revoke execute on function public.trigger_maintenance_schedule(uuid, public.work_order_priority) from anon;
revoke execute on function public.notify(uuid, uuid, public.notification_type, text, text, text, uuid) from anon;
revoke execute on function public.log_audit(uuid, text, uuid, text, uuid, jsonb, jsonb, jsonb) from anon;
revoke execute on function public.trg_audit_organisation_invitations() from anon;
revoke execute on function public.trg_audit_organisation_members() from anon;
revoke execute on function public.trg_audit_organisations() from anon;

-- accept_organisation_invitation legitimately needs to stay callable by authenticated
-- (a newly-signed-up user calls it right after signup) -- no change there, it already
-- requires an authenticated profile internally.
