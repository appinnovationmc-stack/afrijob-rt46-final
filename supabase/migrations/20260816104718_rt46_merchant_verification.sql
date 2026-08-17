alter table rt46.merchants
  add column if not exists next_inspection_due date,
  add column if not exists last_inspection_at timestamptz,
  add column if not exists verification_hold_until timestamptz,
  add column if not exists verification_hold_reason text;

create table if not exists rt46.merchant_facilities (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references rt46.merchants(id) on delete cascade,
  facility_type text not null,
  address text,
  bay_count int,
  verified_at timestamptz,
  verified_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists rt46.merchant_equipment (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references rt46.merchants(id) on delete cascade,
  equipment_name text not null,
  condition text check (condition in ('good','fair','poor','out_of_service')),
  verified_at timestamptz,
  verified_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists rt46.merchant_technicians (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references rt46.merchants(id) on delete cascade,
  full_name text not null,
  certification text,
  cert_number text,
  cert_expiry date,
  verified_at timestamptz,
  verified_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists rt46.merchant_bank_details (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references rt46.merchants(id) on delete cascade,
  bank_name text not null,
  account_holder text not null,
  account_number_last4 text not null,
  branch_code text,
  verified_at timestamptz,
  verified_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists rt46.merchant_change_log (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references rt46.merchants(id) on delete cascade,
  field_changed text not null,
  old_value text,
  new_value text,
  is_critical boolean not null default false,
  changed_at timestamptz not null default now()
);

-- shared bank details across merchants -> collusion flag (extends fraud system)
create or replace function rt46.detect_shared_bank_details()
returns trigger
language plpgsql
security definer
set search_path to 'public','rt46'
as $$
declare v_other record;
begin
  for v_other in
    select bd.merchant_id, m.trading_name
    from rt46.merchant_bank_details bd
    join rt46.merchants m on m.id = bd.merchant_id
    where bd.account_number_last4 = new.account_number_last4
      and bd.bank_name = new.bank_name
      and bd.merchant_id <> new.merchant_id
  loop
    insert into rt46.fraud_flags (merchant_id, flag_type, detail)
    values (new.merchant_id, 'collusion_pattern',
      format('Bank account (last4 %s, %s) shared with merchant %s', new.account_number_last4, new.bank_name, v_other.trading_name));
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_detect_shared_bank on rt46.merchant_bank_details;
create trigger trg_detect_shared_bank
  after insert on rt46.merchant_bank_details
  for each row execute function rt46.detect_shared_bank_details();

-- critical field changes on merchants -> logged + puts allocation on hold pending re-verification
create or replace function rt46.log_merchant_critical_changes()
returns trigger
language plpgsql
security definer
set search_path to 'public','rt46'
as $$
begin
  if new.bbbee_level is distinct from old.bbbee_level then
    insert into rt46.merchant_change_log (merchant_id, field_changed, old_value, new_value, is_critical)
    values (new.id, 'bbbee_level', old.bbbee_level::text, new.bbbee_level::text, true);
    new.verification_hold_until := now() + interval '72 hours';
    new.verification_hold_reason := 'BBBEE level changed, pending re-verification';
  end if;

  if new.categories is distinct from old.categories then
    insert into rt46.merchant_change_log (merchant_id, field_changed, old_value, new_value, is_critical)
    values (new.id, 'categories', old.categories::text, new.categories::text, true);
    new.verification_hold_until := now() + interval '72 hours';
    new.verification_hold_reason := 'service categories changed, pending re-verification';
  end if;

  if new.contact_email is distinct from old.contact_email then
    insert into rt46.merchant_change_log (merchant_id, field_changed, old_value, new_value, is_critical)
    values (new.id, 'contact_email', old.contact_email, new.contact_email, false);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_merchant_critical_changes on rt46.merchants;
create trigger trg_merchant_critical_changes
  before update on rt46.merchants
  for each row execute function rt46.log_merchant_critical_changes();

-- extend allocation eligibility to respect verification hold (redefine allocate_work_order)
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

-- scheduled re-inspection: due merchants get an inspection queued, next due pushed out
create or replace function rt46.schedule_due_inspections()
returns void
language plpgsql
security definer
set search_path to 'public','rt46'
as $$
declare r record;
begin
  for r in
    select id from rt46.merchants
    where status = 'active'
      and (next_inspection_due is null or next_inspection_due <= current_date)
  loop
    insert into rt46.merchant_inspections (merchant_id, scheduled_for)
    values (r.id, current_date + 14);

    update rt46.merchants
      set next_inspection_due = current_date + 180
      where id = r.id;

    insert into public.notifications (profile_id, type, title, body)
    select mu.profile_id, 'system', 'Re-inspection scheduled',
      'A routine compliance re-inspection has been scheduled for your workshop within 14 days.'
    from rt46.merchant_users mu where mu.merchant_id = r.id;
  end loop;
end;
$$;

-- if inspection fails, reduce capacity or suspend depending on severity
create or replace function rt46.apply_inspection_result()
returns trigger
language plpgsql
security definer
set search_path to 'public','rt46'
as $$
begin
  if new.result = 'fail' and (old.result is distinct from 'fail') then
    perform rt46.suspend_merchant(new.merchant_id, coalesce(new.inspector_profile_id, auth.uid()),
      'Failed compliance re-inspection on ' || coalesce(new.performed_at::date::text, current_date::text));
  elsif new.result = 'conditional_pass' and (old.result is distinct from 'conditional_pass') then
    update rt46.merchants
      set declared_capacity_per_month = greatest(floor(declared_capacity_per_month * 0.5), 1),
          updated_at = now()
      where id = new.merchant_id;
    perform rt46.log_audit('merchant', new.merchant_id, 'capacity_reduced', new.inspector_profile_id,
      'conditional pass on re-inspection: capacity halved pending fixes', '{}'::jsonb);
  end if;

  if new.result is not null and old.result is null then
    update rt46.merchants set last_inspection_at = now() where id = new.merchant_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_apply_inspection_result on rt46.merchant_inspections;
create trigger trg_apply_inspection_result
  after update on rt46.merchant_inspections
  for each row execute function rt46.apply_inspection_result();

select cron.schedule('rt46-schedule-inspections-daily', '0 5 * * *', $$select rt46.schedule_due_inspections();$$);

alter table rt46.merchant_facilities enable row level security;
alter table rt46.merchant_equipment enable row level security;
alter table rt46.merchant_technicians enable row level security;
alter table rt46.merchant_bank_details enable row level security;
alter table rt46.merchant_change_log enable row level security;

create policy "facilities admin all" on rt46.merchant_facilities for all using (rt46.is_admin()) with check (rt46.is_admin());
create policy "facilities merchant read own" on rt46.merchant_facilities for select using (rt46.is_merchant_staff(merchant_id));
create policy "facilities merchant insert own" on rt46.merchant_facilities for insert with check (rt46.is_merchant_staff(merchant_id));

create policy "equipment admin all" on rt46.merchant_equipment for all using (rt46.is_admin()) with check (rt46.is_admin());
create policy "equipment merchant read own" on rt46.merchant_equipment for select using (rt46.is_merchant_staff(merchant_id));
create policy "equipment merchant insert own" on rt46.merchant_equipment for insert with check (rt46.is_merchant_staff(merchant_id));

create policy "technicians admin all" on rt46.merchant_technicians for all using (rt46.is_admin()) with check (rt46.is_admin());
create policy "technicians merchant read own" on rt46.merchant_technicians for select using (rt46.is_merchant_staff(merchant_id));
create policy "technicians merchant insert own" on rt46.merchant_technicians for insert with check (rt46.is_merchant_staff(merchant_id));

create policy "bank details admin all" on rt46.merchant_bank_details for all using (rt46.is_admin()) with check (rt46.is_admin());
create policy "bank details merchant read own" on rt46.merchant_bank_details for select using (rt46.is_merchant_staff(merchant_id));
create policy "bank details merchant insert own" on rt46.merchant_bank_details for insert with check (rt46.is_merchant_staff(merchant_id));

create policy "change log admin read" on rt46.merchant_change_log for select using (rt46.is_admin());
