-- P0 audit hardening
-- The semantic lifecycle triggers previously handled INSERT/UPDATE only.
-- The generic mutation trigger catches DELETE, but its raw CRUD shape is not
-- equivalent to the semantic lifecycle trail. Add explicit semantic DELETE
-- events so the domain audit history is complete and self-describing.

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
  elsif tg_op = 'UPDATE' then
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
    return new;
  elsif tg_op = 'DELETE' then
    perform public.log_audit(
      old.organisation_id, 'work_order', old.id, 'deleted', auth.uid(),
      to_jsonb(old), null
    );
    return old;
  end if;
  return coalesce(new, old);
end;
$function$;

drop trigger if exists audit_work_orders on public.work_orders;
create trigger audit_work_orders
  after insert or update or delete on public.work_orders
  for each row execute function public.trg_audit_work_orders();

create or replace function public.trg_audit_assets()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if tg_op = 'INSERT' then
    perform public.log_audit(
      new.organisation_id, 'asset', new.id, 'created', auth.uid(),
      null,
      jsonb_build_object('status', new.status, 'site_id', new.site_id, 'meter_value', new.meter_value)
    );
    return new;
  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status
       or new.retired_at is distinct from old.retired_at
       or new.meter_value is distinct from old.meter_value
       or new.site_id is distinct from old.site_id then
      perform public.log_audit(
        new.organisation_id, 'asset', new.id, 'lifecycle_changed', auth.uid(),
        jsonb_build_object('status', old.status, 'retired_at', old.retired_at, 'meter_value', old.meter_value, 'site_id', old.site_id),
        jsonb_build_object('status', new.status, 'retired_at', new.retired_at, 'meter_value', new.meter_value, 'site_id', new.site_id)
      );
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    perform public.log_audit(
      old.organisation_id, 'asset', old.id, 'deleted', auth.uid(),
      to_jsonb(old), null
    );
    return old;
  end if;
  return coalesce(new, old);
end;
$function$;

drop trigger if exists audit_assets on public.assets;
create trigger audit_assets
  after insert or update or delete on public.assets
  for each row execute function public.trg_audit_assets();

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
  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      perform public.log_audit(
        new.organisation_id, 'service_provider', new.id, 'status_changed', auth.uid(),
        jsonb_build_object('status', old.status), jsonb_build_object('status', new.status)
      );
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    perform public.log_audit(
      old.organisation_id, 'service_provider', old.id, 'deleted', auth.uid(),
      to_jsonb(old), null
    );
    return old;
  end if;
  return coalesce(new, old);
end;
$function$;

drop trigger if exists audit_service_providers on public.service_providers;
create trigger audit_service_providers
  after insert or update or delete on public.service_providers
  for each row execute function public.trg_audit_service_providers();

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
  elsif tg_op = 'UPDATE' then
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
    return new;
  elsif tg_op = 'DELETE' then
    perform public.log_audit(
      old.organisation_id, 'incident', old.id, 'deleted', auth.uid(),
      to_jsonb(old), null
    );
    return old;
  end if;
  return coalesce(new, old);
end;
$function$;

drop trigger if exists audit_incidents on public.incidents;
create trigger audit_incidents
  after insert or update or delete on public.incidents
  for each row execute function public.trg_audit_incidents();

-- Separate audit visibility from membership administration. This is least
-- privilege: operational managers can inspect their operational audit trail
-- without being able to manage organisation membership.
insert into public.role_permissions (role, permission_code, granted)
select role_name::organisation_role, 'audit.view', true
from unnest(array[
  'owner', 'admin', 'manager', 'supervisor', 'operations_manager'
]) as role_name
on conflict (role, permission_code) do update set granted = excluded.granted;

drop policy if exists "org members can view audit log for their org" on public.audit_log;
create policy "roles with audit view can view audit log"
  on public.audit_log for select
  using (public.has_permission(organisation_id, 'audit.view'));
