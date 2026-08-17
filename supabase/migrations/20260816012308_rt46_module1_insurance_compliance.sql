-- RECONSTRUCTED from the live database schema — see note in
-- 20260816004251_create_rt46_fleet_allocation_schema.sql.

create type rt46.insurance_status as enum ('pending_verification','verified','rejected','expired');

create table rt46.merchant_insurance_policies (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references rt46.merchants(id) on delete cascade,
  policy_number text not null,
  insurer text not null,
  cover_type text not null,
  start_date date not null,
  expiry_date date not null,
  status rt46.insurance_status not null default 'pending_verification',
  document_storage_path text not null,
  uploaded_by uuid references public.profiles(id),
  verified_by uuid references public.profiles(id),
  verified_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table rt46.merchant_insurance_policies enable row level security;

create policy insurance_policies_admin_all on rt46.merchant_insurance_policies
  for all using (rt46.is_admin(auth.uid())) with check (rt46.is_admin(auth.uid()));

create policy insurance_policies_merchant_read on rt46.merchant_insurance_policies
  for select using (exists (
    select 1 from rt46.merchant_users mu
    where mu.merchant_id = merchant_insurance_policies.merchant_id and mu.profile_id = auth.uid()
  ));

create policy insurance_policies_merchant_insert on rt46.merchant_insurance_policies
  for insert with check (exists (
    select 1 from rt46.merchant_users mu
    where mu.merchant_id = merchant_insurance_policies.merchant_id and mu.profile_id = auth.uid()
  ));
