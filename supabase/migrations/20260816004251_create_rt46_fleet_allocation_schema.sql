-- RECONSTRUCTED from the live database schema (this file did not exist in the repo;
-- the original was applied directly to production in an earlier session). Verified
-- column-for-column and policy-for-policy against information_schema / pg_policies
-- on project wtbycozfoeiepvgortvx. Safe to run against a fresh database.

create schema if not exists rt46;
create extension if not exists pgcrypto;
create extension if not exists pg_cron;

create type rt46.bbbee_level as enum (
  'level_1','level_2','level_3','level_4','level_5','level_6','level_7','level_8','non_compliant'
);
create type rt46.merchant_status as enum ('pending_onboarding','active','suspended','terminated');
create type rt46.work_order_status as enum (
  'pending_allocation','allocated','accepted','in_progress','completed','disputed','cancelled'
);

create table rt46.regions (
  id uuid primary key default gen_random_uuid(),
  province text not null,
  district text,
  created_at timestamptz not null default now()
);

create table rt46.vehicles (
  id uuid primary key default gen_random_uuid(),
  fleet_number text not null,
  registration text not null,
  department text,
  region_id uuid references rt46.regions(id),
  make text,
  model text,
  created_at timestamptz not null default now()
);

create table rt46.merchants (
  id uuid primary key default gen_random_uuid(),
  trading_name text not null,
  registration_number text,
  bbbee_level rt46.bbbee_level not null default 'non_compliant',
  region_id uuid not null references rt46.regions(id),
  categories text[] not null default '{}',
  declared_capacity_per_month int not null default 10,
  status rt46.merchant_status not null default 'pending_onboarding',
  contact_email text,
  contact_phone text,
  insurance_valid_until date,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  quality_score numeric not null default 1.0,
  last_allocated_at timestamptz
);

create table rt46.merchant_users (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references rt46.merchants(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'staff',
  created_at timestamptz not null default now(),
  unique (merchant_id, profile_id)
);

create table rt46.admins (
  profile_id uuid primary key references public.profiles(id) on delete cascade
);

create table rt46.audit_log (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  actor_profile_id uuid,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table rt46.work_orders (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references rt46.vehicles(id),
  category text not null,
  region_id uuid not null references rt46.regions(id),
  priority text not null default 'normal',
  description text,
  status rt46.work_order_status not null default 'pending_allocation',
  allocated_merchant_id uuid references rt46.merchants(id),
  estimated_value numeric,
  created_at timestamptz not null default now(),
  allocated_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

-- ---------- helper functions ----------
create or replace function rt46.is_admin(p_profile_id uuid)
returns boolean language sql stable as $$
  select exists (select 1 from rt46.admins a where a.profile_id = p_profile_id);
$$;

create or replace function rt46.is_admin()
returns boolean language sql stable security definer set search_path to 'rt46','public' as $$
  select exists (select 1 from rt46.admins where profile_id = auth.uid());
$$;

create or replace function rt46.is_merchant_staff(target_merchant_id uuid)
returns boolean language sql stable security definer set search_path to 'rt46','public' as $$
  select exists (
    select 1 from rt46.merchant_users mu
    where mu.merchant_id = target_merchant_id and mu.profile_id = auth.uid()
  );
$$;

create or replace function rt46.log_audit(
  p_entity_type text, p_entity_id uuid, p_action text, p_actor uuid, p_reason text, p_metadata jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path to 'public','rt46' as $$
declare v_id uuid;
begin
  insert into rt46.audit_log (entity_type, entity_id, action, actor_profile_id, reason, metadata)
  values (p_entity_type, p_entity_id, p_action, p_actor, p_reason, p_metadata)
  returning id into v_id;
  return v_id;
end; $$;

create or replace function rt46.enforce_merchant_active_for_allocation()
returns trigger language plpgsql as $$
declare v_status rt46.merchant_status;
begin
  if new.allocated_merchant_id is not null and
     (tg_op = 'INSERT' or new.allocated_merchant_id is distinct from old.allocated_merchant_id) then
    select status into v_status from rt46.merchants where id = new.allocated_merchant_id;
    if v_status is distinct from 'active' then
      raise exception 'cannot allocate work order to merchant %: status is %', new.allocated_merchant_id, v_status
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists trg_enforce_merchant_active on rt46.work_orders;
create trigger trg_enforce_merchant_active
  before insert or update on rt46.work_orders
  for each row execute function rt46.enforce_merchant_active_for_allocation();

-- ---------- indexes ----------
create index if not exists idx_work_orders_status on rt46.work_orders(status);
create index if not exists idx_work_orders_merchant on rt46.work_orders(allocated_merchant_id);
create index if not exists idx_merchants_status on rt46.merchants(status);
create index if not exists idx_merchant_users_profile on rt46.merchant_users(profile_id);
create index if not exists idx_audit_log_entity on rt46.audit_log(entity_type, entity_id);

-- ---------- RLS ----------
alter table rt46.regions enable row level security;
alter table rt46.vehicles enable row level security;
alter table rt46.merchants enable row level security;
alter table rt46.merchant_users enable row level security;
alter table rt46.admins enable row level security;
alter table rt46.audit_log enable row level security;
alter table rt46.work_orders enable row level security;

create policy regions_select_all on rt46.regions for select using (auth.uid() is not null);
create policy regions_admin_write on rt46.regions for all using (rt46.is_admin()) with check (rt46.is_admin());

create policy vehicles_select_all on rt46.vehicles for select using (auth.uid() is not null);
create policy vehicles_admin_write on rt46.vehicles for all using (rt46.is_admin()) with check (rt46.is_admin());

create policy merchants_select on rt46.merchants for select using (rt46.is_admin() or rt46.is_merchant_staff(id));
create policy merchants_admin_write on rt46.merchants for insert with check (rt46.is_admin());
create policy merchants_admin_update on rt46.merchants for update using (rt46.is_admin());

create policy merchant_users_select on rt46.merchant_users for select using (rt46.is_admin() or profile_id = auth.uid());
create policy merchant_users_admin_write on rt46.merchant_users for all using (rt46.is_admin()) with check (rt46.is_admin());

create policy admins_select_self on rt46.admins for select using (profile_id = auth.uid());

create policy audit_log_admin_read on rt46.audit_log for select using (rt46.is_admin(auth.uid()));

create policy work_orders_select on rt46.work_orders for select using (rt46.is_admin() or rt46.is_merchant_staff(allocated_merchant_id));
create policy work_orders_admin_write on rt46.work_orders for insert with check (rt46.is_admin());
create policy work_orders_update on rt46.work_orders for update using (rt46.is_admin() or rt46.is_merchant_staff(allocated_merchant_id));
