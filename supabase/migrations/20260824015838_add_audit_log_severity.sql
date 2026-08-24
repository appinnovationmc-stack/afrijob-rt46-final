-- Closes the last unbuilt item in Phase B's filter list (org/user/module/
-- entity/action/date/severity) — severity didn't exist as a concept at
-- all. Backward compatible: new column defaults to 'info', p_severity is
-- appended as a new trailing parameter with a default, so every existing
-- positional call site (12+ trigger functions) keeps working unchanged
-- unless explicitly updated below to pass something more specific.

alter table public.audit_log
  add column if not exists severity text not null default 'info'
  check (severity in ('info', 'warning', 'critical'));

create index if not exists audit_log_severity_idx on public.audit_log(organisation_id, severity, created_at desc);

create or replace function public.log_audit(
  p_organisation_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_actor uuid default auth.uid(),
  p_before jsonb default null,
  p_after jsonb default null,
  p_metadata jsonb default '{}'::jsonb,
  p_severity text default 'info'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.audit_log (organisation_id, entity_type, entity_id, action, actor_profile_id, before_data, after_data, metadata, severity)
  values (p_organisation_id, p_entity_type, p_entity_id, p_action, p_actor, p_before, p_after, p_metadata, p_severity)
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.log_audit(uuid, text, uuid, text, uuid, jsonb, jsonb, jsonb, text) to authenticated;

-- Elevate severity at the specific call sites where it's genuinely
-- security/risk-relevant, per Phase B's own list: role/permission changes,
-- membership removal, org settings, SLA breaches, work orders going to a
-- problem state, and service provider suspension. Every other trigger
-- keeps the 'info' default unchanged -- not rewriting all 12 for the sake
-- of it, only where the action itself signals risk.

create or replace function public.trg_audit_organisation_members()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_audit(new.organisation_id, 'organisation_member', new.id, 'member_added', auth.uid(), null, to_jsonb(new));
  elsif tg_op = 'UPDATE' then
    if new.role is distinct from old.role then
      perform public.log_audit(new.organisation_id, 'organisation_member', new.id, 'role_changed', auth.uid(), to_jsonb(old), to_jsonb(new), '{}'::jsonb, 'critical');
    end if;
  elsif tg_op = 'DELETE' then
    perform public.log_audit(old.organisation_id, 'organisation_member', old.id, 'member_removed', auth.uid(), to_jsonb(old), null, '{}'::jsonb, 'warning');
  end if;
  return coalesce(new, old);
end;
$$;

create or replace function public.trg_audit_organisations()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.enabled_modules is distinct from old.enabled_modules or new.settings is distinct from old.settings then
    perform public.log_audit(
      new.id, 'organisation', new.id, 'settings_changed', auth.uid(),
      jsonb_build_object('enabled_modules', old.enabled_modules, 'settings', old.settings),
      jsonb_build_object('enabled_modules', new.enabled_modules, 'settings', new.settings),
      '{}'::jsonb, 'warning'
    );
  end if;
  return new;
end;
$$;

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
      jsonb_build_object('work_order_id', new.work_order_id, 'metric', new.metric, 'minutes_over', new.minutes_over),
      '{}'::jsonb, 'warning'
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
        jsonb_build_object('status', old.status), jsonb_build_object('status', new.status),
        '{}'::jsonb,
        case when new.status in ('cancelled', 'disputed') then 'warning' else 'info' end
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
      jsonb_build_object('status', old.status), jsonb_build_object('status', new.status),
      '{}'::jsonb,
      case when new.status = 'suspended' then 'critical' else 'info' end
    );
  end if;
  return new;
end;
$function$;
