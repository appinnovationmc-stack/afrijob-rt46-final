-- Billing security hardening and server-side entitlement primitives.
-- Org administrators may read their billing account, but they must not be
-- able to grant themselves paid access by changing plan/status/provider.

create or replace function public.prevent_self_service_billing_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    if new.plan is distinct from old.plan
       or new.status is distinct from old.status
       or new.provider is distinct from old.provider
       or new.trial_ends_at is distinct from old.trial_ends_at then
      raise exception 'Billing plan, status, provider and trial dates are managed by the platform';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists billing_accounts_prevent_self_service on public.billing_accounts;
create trigger billing_accounts_prevent_self_service
before update on public.billing_accounts
for each row execute function public.prevent_self_service_billing_escalation();

-- A single server-side predicate for entitlement-aware RPCs and future RLS.
-- Module enablement remains organisation-owned configuration; billing status
-- is an additional platform-controlled gate. This deliberately does not
-- invent plan names or pricing rules that are not present in the schema.
create or replace function public.organisation_module_access(p_organisation_id uuid, p_module_key text)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select
    exists (
      select 1
      from public.organisation_members om
      where om.organisation_id = p_organisation_id
        and om.profile_id = auth.uid()
    )
    and coalesce(
      (
        select case
          when ba.status = 'cancelled' then false
          when ba.status = 'past_due' then true
          when ba.status = 'trial' then coalesce(ba.trial_ends_at > now(), true)
          else true
        end
        from public.billing_accounts ba
        where ba.organisation_id = p_organisation_id
      ), true
    )
    and coalesce(
      (
        select case
          when jsonb_typeof(o.enabled_modules) = 'object'
            then coalesce((o.enabled_modules ->> p_module_key)::boolean, true)
          when jsonb_typeof(o.enabled_modules) = 'array'
            then not (o.enabled_modules ? p_module_key)
          else true
        end
        from public.organisations o
        where o.id = p_organisation_id
      ), false
    );
$$;

revoke all on function public.organisation_module_access(uuid, text) from public;
grant execute on function public.organisation_module_access(uuid, text) to authenticated;

comment on function public.organisation_module_access(uuid, text) is
'RLS-safe entitlement predicate: caller must belong to the organisation, billing must not be cancelled/expired, and the module must not be explicitly disabled.';
