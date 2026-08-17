-- mandatory-reason suspend / reinstate, fully audited
create or replace function rt46.suspend_merchant(p_merchant_id uuid, p_actor uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path to 'public','rt46'
as $$
begin
  if not rt46.is_admin(p_actor) then
    raise exception 'only admins can suspend merchants';
  end if;
  if p_reason is null or length(trim(p_reason)) < 5 then
    raise exception 'a reason of at least 5 characters is required to suspend a merchant';
  end if;

  update rt46.merchants set status = 'suspended', updated_at = now() where id = p_merchant_id;

  perform rt46.log_audit('merchant', p_merchant_id, 'suspended', p_actor, p_reason, '{}'::jsonb);

  insert into public.notifications (profile_id, type, title, body)
  select mu.profile_id, 'merchant_suspended', 'Merchant suspended', p_reason
  from rt46.merchant_users mu where mu.merchant_id = p_merchant_id;
end;
$$;

create or replace function rt46.reinstate_merchant(p_merchant_id uuid, p_actor uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path to 'public','rt46'
as $$
begin
  if not rt46.is_admin(p_actor) then
    raise exception 'only admins can reinstate merchants';
  end if;
  update rt46.merchants set status = 'active', updated_at = now() where id = p_merchant_id;
  perform rt46.log_audit('merchant', p_merchant_id, 'reactivated', p_actor, p_reason, '{}'::jsonb);
  insert into public.notifications (profile_id, type, title, body)
  select mu.profile_id, 'merchant_reactivated', 'Merchant reinstated', coalesce(p_reason, 'Reinstated by admin')
  from rt46.merchant_users mu where mu.merchant_id = p_merchant_id;
end;
$$;

-- fraud flag investigation workflow transition
create or replace function rt46.update_fraud_flag_status(
  p_flag_id uuid, p_status rt46.fraud_flag_status, p_actor uuid, p_notes text default null
) returns void
language plpgsql
security definer
set search_path to 'public','rt46'
as $$
begin
  if not rt46.is_admin(p_actor) then
    raise exception 'only admins can update fraud flag status';
  end if;
  update rt46.fraud_flags
    set status = p_status,
        resolved_at = case when p_status in ('confirmed','dismissed') then now() else resolved_at end
    where id = p_flag_id;
  perform rt46.log_audit('fraud_flag', p_flag_id, 'status_changed', p_actor, p_notes,
    jsonb_build_object('new_status', p_status));
end;
$$;

-- repeated-vehicle detection: same vehicle, multiple work orders in short window
create or replace function rt46.detect_repeated_vehicle()
returns trigger
language plpgsql
security definer
set search_path to 'public','rt46'
as $$
declare v_count int;
begin
  select count(*) into v_count
  from rt46.work_orders
  where vehicle_id = new.vehicle_id
    and created_at > now() - interval '30 days'
    and id <> new.id;

  if v_count >= 3 then
    insert into rt46.fraud_flags (merchant_id, work_order_id, flag_type, detail)
    values (new.allocated_merchant_id, new.id, 'duplicate_claim',
      format('Vehicle %s has had %s work orders in the last 30 days', new.vehicle_id, v_count + 1));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_detect_repeated_vehicle on rt46.work_orders;
create trigger trg_detect_repeated_vehicle
  after insert on rt46.work_orders
  for each row execute function rt46.detect_repeated_vehicle();

-- volume spike + cancellation rate + shared contact detection (scheduled, not per-row)
create or replace function rt46.detect_merchant_anomalies()
returns void
language plpgsql
security definer
set search_path to 'public','rt46'
as $$
declare r record;
declare v_baseline numeric; v_recent int; v_cancel_rate numeric; v_total int; v_cancelled int;
begin
  -- volume spikes: this week's allocations vs trailing 8-week average
  for r in select id from rt46.merchants where status = 'active' loop
    select count(*) into v_recent from rt46.work_orders
      where allocated_merchant_id = r.id and allocated_at > now() - interval '7 days';
    select count(*)::numeric / 8.0 into v_baseline from rt46.work_orders
      where allocated_merchant_id = r.id and allocated_at between now() - interval '63 days' and now() - interval '7 days';

    if v_baseline >= 1 and v_recent > v_baseline * 3 then
      insert into rt46.fraud_flags (merchant_id, flag_type, detail)
      select r.id, 'other', format('Volume spike: %s work orders this week vs baseline %.1f/week', v_recent, v_baseline)
      where not exists (
        select 1 from rt46.fraud_flags f
        where f.merchant_id = r.id and f.flag_type = 'other' and f.detail like 'Volume spike%'
          and f.created_at > now() - interval '7 days'
      );
    end if;

    -- cancellation rate over trailing 90 days
    select count(*) into v_total from rt46.work_orders
      where allocated_merchant_id = r.id and allocated_at > now() - interval '90 days';
    select count(*) into v_cancelled from rt46.work_orders
      where allocated_merchant_id = r.id and status = 'cancelled' and allocated_at > now() - interval '90 days';

    if v_total >= 5 then
      v_cancel_rate := v_cancelled::numeric / v_total;
      if v_cancel_rate > 0.30 then
        insert into rt46.fraud_flags (merchant_id, flag_type, detail)
        select r.id, 'other', format('High cancellation rate: %.0f%% over last 90 days (%s of %s)', v_cancel_rate*100, v_cancelled, v_total)
        where not exists (
          select 1 from rt46.fraud_flags f
          where f.merchant_id = r.id and f.flag_type = 'other' and f.detail like 'High cancellation rate%'
            and f.created_at > now() - interval '7 days'
        );
      end if;
    end if;
  end loop;

  -- shared contact details across distinct merchants
  insert into rt46.fraud_flags (merchant_id, flag_type, detail)
  select m1.id, 'collusion_pattern',
    format('Contact email %s shared with merchant %s', m1.contact_email, m2.trading_name)
  from rt46.merchants m1
  join rt46.merchants m2 on m1.contact_email = m2.contact_email and m1.id < m2.id
  where m1.contact_email is not null
    and not exists (
      select 1 from rt46.fraud_flags f where f.merchant_id = m1.id
        and f.flag_type = 'collusion_pattern' and f.detail like 'Contact email%' and f.status = 'open'
    );
end;
$$;

select cron.schedule('rt46-fraud-anomaly-scan', '0 4 * * *', $$select rt46.detect_merchant_anomalies();$$);
