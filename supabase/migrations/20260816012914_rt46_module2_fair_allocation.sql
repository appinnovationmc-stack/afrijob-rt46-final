-- RECONSTRUCTED from the live database schema — see note in
-- 20260816004251_create_rt46_fleet_allocation_schema.sql.
--
-- Note: rt46.allocate_work_order() below is written as it exists LIVE TODAY, which
-- already includes the verification-hold check added by
-- 20260816104718_rt46_merchant_verification.sql (that later migration does
-- `create or replace function`, so the live function body is the merged, current
-- version, not the original module-2 version). Applying migrations in this repo in
-- order still produces the identical end state.

create type rt46.fraud_flag_type as enum (
  'self_invoicing','price_anomaly','duplicate_claim','collusion_pattern','insurance_lapse','other'
);
create type rt46.fraud_flag_status as enum ('open','under_review','confirmed','dismissed');

create table rt46.allocation_config (
  id boolean primary key default true,
  weight_capacity numeric not null default 0.40,
  weight_bbbee numeric not null default 0.25,
  weight_region numeric not null default 0.15,
  weight_performance numeric not null default 0.20,
  capacity_window_days int not null default 90,
  capacity_multiplier numeric not null default 3.0,
  cooldown_hours int not null default 24,
  updated_at timestamptz not null default now(),
  constraint allocation_config_singleton check (id)
);
insert into rt46.allocation_config (id) values (true) on conflict (id) do nothing;

create table rt46.allocation_log (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references rt46.work_orders(id) on delete cascade,
  merchant_id uuid not null references rt46.merchants(id),
  score numeric not null,
  trailing_90d_volume int not null,
  capacity_ratio numeric not null,
  bbbee_weight numeric not null,
  was_selected boolean not null default false,
  created_at timestamptz not null default now(),
  eligible boolean not null default true,
  exclusion_reason text,
  quality_score numeric,
  region_match boolean not null default true
);

create table rt46.fraud_flags (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references rt46.merchants(id) on delete cascade,
  work_order_id uuid references rt46.work_orders(id) on delete cascade,
  flag_type rt46.fraud_flag_type not null,
  status rt46.fraud_flag_status not null default 'open',
  detail text,
  raised_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table rt46.parts_price_reference (
  id uuid primary key default gen_random_uuid(),
  part_name text not null,
  benchmark_price numeric not null,
  updated_at timestamptz not null default now()
);

create table rt46.work_order_parts (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references rt46.work_orders(id) on delete cascade,
  part_name text not null,
  quantity numeric not null default 1,
  billed_unit_cost numeric not null,
  reference_id uuid references rt46.parts_price_reference(id),
  variance_pct numeric,
  created_at timestamptz not null default now()
);

create or replace function rt46.check_parts_price_variance()
returns trigger
language plpgsql
security definer
set search_path to 'rt46','public'
as $$
declare
  v_ref_price numeric(10,2);
  v_merchant_id uuid;
begin
  select benchmark_price into v_ref_price
  from rt46.parts_price_reference where id = new.reference_id;

  if v_ref_price is not null and v_ref_price > 0 then
    new.variance_pct := round(((new.billed_unit_cost - v_ref_price) / v_ref_price) * 100, 2);

    if new.variance_pct > 25 then
      select allocated_merchant_id into v_merchant_id
      from rt46.work_orders where id = new.work_order_id;

      insert into rt46.fraud_flags (merchant_id, work_order_id, flag_type, detail)
      values (
        v_merchant_id, new.work_order_id, 'price_anomaly',
        format('Part "%s" billed at %.2f vs benchmark %.2f (+%.1f%%)', new.part_name, new.billed_unit_cost, v_ref_price, new.variance_pct)
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_check_parts_price_variance on rt46.work_order_parts;
create trigger trg_check_parts_price_variance
  before insert or update on rt46.work_order_parts
  for each row execute function rt46.check_parts_price_variance();

-- fair allocation: transparent scoring across capacity, B-BBEE, region, and quality;
-- every candidate (eligible or excluded, with reason) is logged to allocation_log.
create or replace function rt46.allocate_work_order(p_work_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public', 'rt46'
as $$
declare
  v_wo rt46.work_orders%rowtype;
  v_cfg rt46.allocation_config%rowtype;
  cand record;
  v_best_merchant uuid;
  v_best_score numeric := -1;
  v_any_eligible boolean := false;
  v_cap_90d numeric;
  v_ratio numeric;
  v_bbbee_weight numeric;
  v_region_match boolean;
  v_score numeric;
  v_eligible boolean;
  v_reason text;
  v_cooldown_cutoff timestamptz;
begin
  if not rt46.is_admin(auth.uid()) then
    raise exception 'only admins can trigger allocation';
  end if;

  select * into v_wo from rt46.work_orders where id = p_work_order_id for update;
  if v_wo.id is null then raise exception 'work order not found'; end if;
  if v_wo.status <> 'pending_allocation' then
    raise exception 'work order is not pending allocation (status: %)', v_wo.status;
  end if;

  select * into v_cfg from rt46.allocation_config where id = true;
  delete from rt46.allocation_log where work_order_id = p_work_order_id;

  for cand in select m.* from rt46.merchants m where v_wo.category = any (m.categories) loop
    v_eligible := true;
    v_reason := null;

    if cand.status <> 'active' then
      v_eligible := false;
      v_reason := format('merchant status is %s (must be active)', cand.status);
    elsif cand.insurance_valid_until is null or cand.insurance_valid_until < current_date then
      v_eligible := false;
      v_reason := 'insurance not valid';
    elsif cand.verification_hold_until is not null and cand.verification_hold_until > now() then
      v_eligible := false;
      v_reason := format('verification hold active until %s (%s)', cand.verification_hold_until, cand.verification_hold_reason);
    end if;

    select count(*) into v_cap_90d
      from rt46.work_orders wo
      where wo.allocated_merchant_id = cand.id
        and wo.allocated_at >= now() - make_interval(days => v_cfg.capacity_window_days);

    v_ratio := v_cap_90d / greatest(cand.declared_capacity_per_month * v_cfg.capacity_multiplier, 1);

    if v_eligible and v_ratio >= 1 then
      v_eligible := false;
      v_reason := format('at declared capacity (%s / %s in last %s days)', v_cap_90d,
        cand.declared_capacity_per_month * v_cfg.capacity_multiplier, v_cfg.capacity_window_days);
    end if;

    v_cooldown_cutoff := now() - make_interval(hours => v_cfg.cooldown_hours);
    if v_eligible and cand.last_allocated_at is not null and cand.last_allocated_at > v_cooldown_cutoff then
      v_eligible := false;
      v_reason := format('cooldown active until %s', cand.last_allocated_at + make_interval(hours => v_cfg.cooldown_hours));
    end if;

    v_region_match := (cand.region_id = v_wo.region_id);
    v_bbbee_weight := case cand.bbbee_level
      when 'level_1' then 1.0 when 'level_2' then 0.9 when 'level_3' then 0.8 when 'level_4' then 0.7
      when 'level_5' then 0.6 when 'level_6' then 0.5 when 'level_7' then 0.4 when 'level_8' then 0.3
      else 0.0 end;

    v_score := v_cfg.weight_capacity * (1 - least(v_ratio, 1))
             + v_cfg.weight_bbbee * v_bbbee_weight
             + v_cfg.weight_region * (case when v_region_match then 1 else 0.3 end)
             + v_cfg.weight_performance * cand.quality_score;

    insert into rt46.allocation_log
      (work_order_id, merchant_id, score, trailing_90d_volume, capacity_ratio, bbbee_weight,
       quality_score, region_match, eligible, exclusion_reason, was_selected)
    values
      (p_work_order_id, cand.id, round(v_score, 4), v_cap_90d, round(v_ratio, 4), v_bbbee_weight,
       cand.quality_score, v_region_match, v_eligible, v_reason, false);

    if v_eligible then
      v_any_eligible := true;
      if v_score > v_best_score then
        v_best_score := v_score;
        v_best_merchant := cand.id;
      end if;
    end if;
  end loop;

  if not v_any_eligible then
    perform rt46.log_audit('work_order', p_work_order_id, 'allocation_failed', auth.uid(), 'no eligible merchant', '{}'::jsonb);
    return null;
  end if;

  update rt46.allocation_log set was_selected = true where work_order_id = p_work_order_id and merchant_id = v_best_merchant;
  update rt46.work_orders set allocated_merchant_id = v_best_merchant, status = 'allocated', allocated_at = now(), updated_at = now()
    where id = p_work_order_id;
  update rt46.merchants set last_allocated_at = now() where id = v_best_merchant;

  perform rt46.log_audit('work_order', p_work_order_id, 'allocated', auth.uid(), 'fair allocation engine',
    jsonb_build_object('merchant_id', v_best_merchant, 'score', v_best_score));

  return v_best_merchant;
end;
$$;

-- ---------- RLS ----------
alter table rt46.allocation_config enable row level security;
alter table rt46.allocation_log enable row level security;
alter table rt46.fraud_flags enable row level security;
alter table rt46.parts_price_reference enable row level security;
alter table rt46.work_order_parts enable row level security;

create policy allocation_config_admin_all on rt46.allocation_config for all using (rt46.is_admin(auth.uid())) with check (rt46.is_admin(auth.uid()));
create policy allocation_config_authenticated_read on rt46.allocation_config for select using (auth.uid() is not null);

create policy allocation_log_admin_read on rt46.allocation_log for select using (rt46.is_admin(auth.uid()));
create policy allocation_log_merchant_read_own on rt46.allocation_log for select using (exists (
  select 1 from rt46.merchant_users mu where mu.merchant_id = allocation_log.merchant_id and mu.profile_id = auth.uid()
));

create policy fraud_flags_admin_only on rt46.fraud_flags for all using (rt46.is_admin()) with check (rt46.is_admin());

create policy parts_ref_select_all on rt46.parts_price_reference for select using (auth.uid() is not null);
create policy parts_ref_admin_write on rt46.parts_price_reference for all using (rt46.is_admin()) with check (rt46.is_admin());

create policy work_order_parts_select on rt46.work_order_parts for select using (
  rt46.is_admin() or exists (select 1 from rt46.work_orders wo where wo.id = work_order_parts.work_order_id and rt46.is_merchant_staff(wo.allocated_merchant_id))
);
create policy work_order_parts_insert on rt46.work_order_parts for insert with check (
  rt46.is_admin() or exists (select 1 from rt46.work_orders wo where wo.id = work_order_parts.work_order_id and rt46.is_merchant_staff(wo.allocated_merchant_id))
);
