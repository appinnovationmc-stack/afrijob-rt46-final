-- Mirrors the existing trg_audit_organisations / trg_audit_organisation_members
-- pattern (public.log_audit SECURITY DEFINER helper) so asset lifecycle
-- changes are actually recorded — previously nothing wrote entity_type='asset'
-- rows to audit_log at all (confirmed empty before this migration), so the
-- new Asset 360 Lifecycle tab would otherwise read a table nothing ever
-- populates for assets, which is exactly the kind of dead UI this project
-- has been told not to ship.
create or replace function public.trg_audit_assets()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_audit(
      new.organisation_id, 'asset', new.id, 'created', auth.uid(),
      null,
      jsonb_build_object('status', new.status, 'site_id', new.site_id, 'meter_value', new.meter_value)
    );
    return new;
  end if;

  if tg_op = 'UPDATE' and (
    new.status is distinct from old.status
    or new.retired_at is distinct from old.retired_at
    or new.meter_value is distinct from old.meter_value
    or new.site_id is distinct from old.site_id
  ) then
    perform public.log_audit(
      new.organisation_id, 'asset', new.id, 'lifecycle_changed', auth.uid(),
      jsonb_build_object('status', old.status, 'retired_at', old.retired_at, 'meter_value', old.meter_value, 'site_id', old.site_id),
      jsonb_build_object('status', new.status, 'retired_at', new.retired_at, 'meter_value', new.meter_value, 'site_id', new.site_id)
    );
  end if;
  return new;
end;
$$;

create trigger audit_assets
after insert or update on public.assets
for each row execute function public.trg_audit_assets();
