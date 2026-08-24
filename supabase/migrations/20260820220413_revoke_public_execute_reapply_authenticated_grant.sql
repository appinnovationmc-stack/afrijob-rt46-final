-- The earlier REVOKE ... FROM anon didn't clear the advisor because Postgres grants
-- EXECUTE to the PUBLIC pseudo-role by default, and anon inherits through PUBLIC
-- regardless of a role-specific revoke. Need to revoke from PUBLIC directly, then
-- explicitly re-grant to authenticated (and service_role, which always has it).

revoke execute on function public.apply_inventory_movement() from public;
revoke execute on function public.approve_purchase_order(uuid) from public;
revoke execute on function public.attach_sla_to_work_order(uuid) from public;
revoke execute on function public.escalate_incident_to_work_order(uuid, public.work_order_priority) from public;
revoke execute on function public.receive_purchase_order_item(uuid, numeric) from public;
revoke execute on function public.record_sla_resolution(uuid) from public;
revoke execute on function public.record_sla_response(uuid) from public;
revoke execute on function public.refresh_document_vault_statuses() from public;
revoke execute on function public.run_due_maintenance_schedules(uuid) from public;
revoke execute on function public.run_sla_breach_sweep(uuid) from public;
revoke execute on function public.trigger_maintenance_schedule(uuid, public.work_order_priority) from public;
revoke execute on function public.notify(uuid, uuid, public.notification_type, text, text, text, uuid) from public;
revoke execute on function public.log_audit(uuid, text, uuid, text, uuid, jsonb, jsonb, jsonb) from public;
revoke execute on function public.trg_audit_organisation_invitations() from public;
revoke execute on function public.trg_audit_organisation_members() from public;
revoke execute on function public.trg_audit_organisations() from public;
revoke execute on function public.has_permission(uuid, text) from public;
revoke execute on function public.is_org_admin(uuid) from public;
revoke execute on function public.is_org_member(uuid) from public;
revoke execute on function public.is_workshop_admin(uuid) from public;
revoke execute on function public.is_workshop_member(uuid) from public;
revoke execute on function public.accept_organisation_invitation(uuid) from public;

-- Re-grant to authenticated -- these are all normal app-usage functions that
-- signed-in users need to call directly or that RLS policies rely on.
grant execute on function public.apply_inventory_movement() to authenticated;
grant execute on function public.approve_purchase_order(uuid) to authenticated;
grant execute on function public.attach_sla_to_work_order(uuid) to authenticated;
grant execute on function public.escalate_incident_to_work_order(uuid, public.work_order_priority) to authenticated;
grant execute on function public.receive_purchase_order_item(uuid, numeric) to authenticated;
grant execute on function public.record_sla_resolution(uuid) to authenticated;
grant execute on function public.record_sla_response(uuid) to authenticated;
grant execute on function public.refresh_document_vault_statuses() to authenticated;
grant execute on function public.run_due_maintenance_schedules(uuid) to authenticated;
grant execute on function public.run_sla_breach_sweep(uuid) to authenticated;
grant execute on function public.trigger_maintenance_schedule(uuid, public.work_order_priority) to authenticated;
grant execute on function public.notify(uuid, uuid, public.notification_type, text, text, text, uuid) to authenticated;
grant execute on function public.log_audit(uuid, text, uuid, text, uuid, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.trg_audit_organisation_invitations() to authenticated;
grant execute on function public.trg_audit_organisation_members() to authenticated;
grant execute on function public.trg_audit_organisations() to authenticated;
grant execute on function public.has_permission(uuid, text) to authenticated;
grant execute on function public.is_org_admin(uuid) to authenticated;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.is_workshop_admin(uuid) to authenticated;
grant execute on function public.is_workshop_member(uuid) to authenticated;
grant execute on function public.accept_organisation_invitation(uuid) to authenticated;
