-- Billing status/plan is an entitlement boundary. Organisation admins may
-- view their organisation's billing record, but must not be able to change
-- plan/status/provider themselves. Those values are platform-controlled
-- until a verified payment-provider webhook integration exists.

alter table public.billing_accounts enable row level security;

drop policy if exists "billing_accounts_manage_admin" on public.billing_accounts;
drop policy if exists "billing_accounts_admin_manage" on public.billing_accounts;

create policy "billing_accounts_select_member"
  on public.billing_accounts
  for select
  using (public.is_org_member(organisation_id));

create policy "billing_accounts_platform_admin_manage"
  on public.billing_accounts
  for all
  using (public.is_platform_admin())
  with check (public.is_platform_admin());
