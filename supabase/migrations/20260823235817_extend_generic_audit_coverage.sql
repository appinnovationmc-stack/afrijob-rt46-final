-- Extends the existing log_audit()/trigger pattern (already used by
-- assets, organisations, organisation_members, organisation_invitations)
-- to the operational tables Phase B calls for. Same function, same
-- audit_log table — no parallel audit system.

-- WORK ORDERS: creation, status changes, assignment changes, provider changes
create or replace function public.trg_audit_work_orders()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if tg_op = 'INSERT' then
    perform public.log_audit(
      new.organisation_id, 'work_order', new.id, 'created', auth.uid(),
      null,
      jsonb_build_object('status', new.status, 'category', new.category, 'priority', new.priority, 'asset_id', new.asset_id)
    );
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      perform public.log_audit(
        new.organisation_id, 'work_order', new.id, 'status_changed', auth.uid(),
        jsonb_build_object('status', old.status), jsonb_build_object('status', new.status)
      );
    end if;
    if new.assignee_profile_id is distinct from old.assignee_profile_id
       or new.service_provider_id is distinct from old.service_provider_id then
      perform public.log_audit(
        new.organisation_id, 'work_order', new.id, 'assignment_changed', auth.uid(),
        jsonb_build_object('assignee_profile_id', old.assignee_profile_id, 'service_provider_id', old.service_provider_id),
        jsonb_build_object('assignee_profile_id', new.assignee_profile_id, 'service_provider_id', new.service_provider_id)
      );
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists audit_work_orders on public.work_orders;
create trigger audit_work_orders
  after insert or update on public.work_orders
  for each row execute function public.trg_audit_work_orders();

-- INCIDENTS: creation, status changes, severity changes
create or replace function public.trg_audit_incidents()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if tg_op = 'INSERT' then
    perform public.log_audit(
      new.organisation_id, 'incident', new.id, 'created', auth.uid(),
      null,
      jsonb_build_object('category', new.category, 'severity', new.severity, 'status', new.status, 'asset_id', new.asset_id)
    );
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      perform public.log_audit(
        new.organisation_id, 'incident', new.id, 'status_changed', auth.uid(),
        jsonb_build_object('status', old.status), jsonb_build_object('status', new.status)
      );
    end if;
    if new.severity is distinct from old.severity then
      perform public.log_audit(
        new.organisation_id, 'incident', new.id, 'severity_changed', auth.uid(),
        jsonb_build_object('severity', old.severity), jsonb_build_object('severity', new.severity)
      );
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists audit_incidents on public.incidents;
create trigger audit_incidents
  after insert or update on public.incidents
  for each row execute function public.trg_audit_incidents();

-- PURCHASE ORDERS: creation, status changes (covers submission/rejection),
-- approval specifically (approved_by set)
create or replace function public.trg_audit_purchase_orders()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if tg_op = 'INSERT' then
    perform public.log_audit(
      new.organisation_id, 'purchase_order', new.id, 'created', auth.uid(),
      null,
      jsonb_build_object('status', new.status, 'supplier_id', new.supplier_id)
    );
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      perform public.log_audit(
        new.organisation_id, 'purchase_order', new.id, 'status_changed', auth.uid(),
        jsonb_build_object('status', old.status), jsonb_build_object('status', new.status)
      );
    end if;
    if new.approved_by is distinct from old.approved_by and new.approved_by is not null then
      perform public.log_audit(
        new.organisation_id, 'purchase_order', new.id, 'approved', auth.uid(),
        null, jsonb_build_object('approved_by', new.approved_by, 'approved_at', new.approved_at)
      );
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists audit_purchase_orders on public.purchase_orders;
create trigger audit_purchase_orders
  after insert or update on public.purchase_orders
  for each row execute function public.trg_audit_purchase_orders();

-- DOCUMENT VAULT: upload, status changes (covers verified/expired/rejected)
create or replace function public.trg_audit_document_vault()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if tg_op = 'INSERT' then
    perform public.log_audit(
      new.organisation_id, 'document', new.id, 'uploaded', auth.uid(),
      null,
      jsonb_build_object('doc_type', new.doc_type, 'entity_type', new.entity_type, 'entity_id', new.entity_id, 'status', new.status)
    );
    return new;
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    perform public.log_audit(
      new.organisation_id, 'document', new.id, 'status_changed', auth.uid(),
      jsonb_build_object('status', old.status), jsonb_build_object('status', new.status, 'rejection_reason', new.rejection_reason)
    );
  end if;
  return new;
end;
$function$;

drop trigger if exists audit_document_vault on public.document_vault;
create trigger audit_document_vault
  after insert or update on public.document_vault
  for each row execute function public.trg_audit_document_vault();

-- SLA BREACHES: recorded, acknowledged
create or replace function public.trg_audit_sla_breaches()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if tg_op = 'INSERT' then
    perform public.log_audit(
      new.organisation_id, 'sla_breach', new.id, 'breach_recorded', auth.uid(),
      null,
      jsonb_build_object('work_order_id', new.work_order_id, 'metric', new.metric, 'minutes_over', new.minutes_over)
    );
    return new;
  end if;

  if tg_op = 'UPDATE' and new.acknowledged_at is distinct from old.acknowledged_at and new.acknowledged_at is not null then
    perform public.log_audit(
      new.organisation_id, 'sla_breach', new.id, 'acknowledged', auth.uid(),
      null, jsonb_build_object('acknowledged_by', new.acknowledged_by, 'acknowledged_at', new.acknowledged_at)
    );
  end if;
  return new;
end;
$function$;

drop trigger if exists audit_sla_breaches on public.sla_breaches;
create trigger audit_sla_breaches
  after insert or update on public.sla_breaches
  for each row execute function public.trg_audit_sla_breaches();

-- SERVICE PROVIDERS: creation, status changes (onboarding/suspension)
create or replace function public.trg_audit_service_providers()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if tg_op = 'INSERT' then
    perform public.log_audit(
      new.organisation_id, 'service_provider', new.id, 'created', auth.uid(),
      null, jsonb_build_object('status', new.status, 'primary_type', new.primary_type)
    );
    return new;
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    perform public.log_audit(
      new.organisation_id, 'service_provider', new.id, 'status_changed', auth.uid(),
      jsonb_build_object('status', old.status), jsonb_build_object('status', new.status)
    );
  end if;
  return new;
end;
$function$;

drop trigger if exists audit_service_providers on public.service_providers;
create trigger audit_service_providers
  after insert or update on public.service_providers
  for each row execute function public.trg_audit_service_providers();
