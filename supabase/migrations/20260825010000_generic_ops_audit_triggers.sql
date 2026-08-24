-- AfriOps generic audit trail
-- Captures INSERT/UPDATE/DELETE mutations for organisation-scoped operational
-- tables. The actor is taken from auth.uid(); no service-role bypass is used.
-- Safe to apply repeatedly and intentionally excludes audit_log itself.

create or replace function public.audit_ops_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_json jsonb;
  old_json jsonb;
  row_json jsonb;
  org_id uuid;
  entity_id text;
  action_name text;
begin
  new_json := case when TG_OP in ('INSERT','UPDATE') then to_jsonb(NEW) else null end;
  old_json := case when TG_OP in ('UPDATE','DELETE') then to_jsonb(OLD) else null end;
  row_json := coalesce(new_json, old_json);

  org_id := nullif(coalesce(new_json->>'organisation_id', old_json->>'organisation_id'), '')::uuid;
  entity_id := coalesce(new_json->>'id', old_json->>'id');

  if org_id is null or entity_id is null then
    return coalesce(NEW, OLD);
  end if;

  action_name := lower(TG_OP) || ':' || TG_TABLE_NAME;

  insert into public.audit_log (
    actor_profile_id,
    organisation_id,
    entity_type,
    entity_id,
    action,
    severity,
    before_data,
    after_data,
    metadata
  ) values (
    auth.uid(),
    org_id,
    TG_TABLE_NAME,
    entity_id,
    action_name,
    case when TG_OP = 'DELETE' then 'warning' else 'info' end,
    old_json,
    new_json,
    jsonb_build_object('source', 'generic_ops_trigger', 'table', TG_TABLE_NAME)
  );

  return coalesce(NEW, OLD);
exception when others then
  -- Auditing must never make the underlying operational transaction fail.
  -- The mutation remains authoritative; audit failures can be monitored
  -- separately without turning the audit table into a single point of failure.
  return coalesce(NEW, OLD);
end;
$$;

-- Replace existing trigger definitions so this migration is idempotent.
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'assets',
    'work_orders',
    'incidents',
    'maintenance_schedules',
    'inventory_items',
    'inventory_movements',
    'purchase_orders',
    'purchase_order_items',
    'suppliers',
    'service_providers',
    'document_vault',
    'notifications',
    'sites',
    'business_units',
    'api_keys',
    'billing_accounts'
  ] LOOP
    IF to_regclass('public.' || table_name) IS NOT NULL THEN
      EXECUTE format('drop trigger if exists trg_audit_ops_mutation on public.%I', table_name);
      EXECUTE format(
        'create trigger trg_audit_ops_mutation after insert or update or delete on public.%I for each row execute function public.audit_ops_mutation()',
        table_name
      );
    END IF;
  END LOOP;
END $$;

revoke all on function public.audit_ops_mutation() from public;
