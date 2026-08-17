-- RECONSTRUCTED from the live database schema — see note in
-- 20260816004251_create_rt46_fleet_allocation_schema.sql.

-- 60/30/14/7-day expiry alerts, and same-day auto-suspend on expiry.
create or replace function rt46.run_insurance_compliance_check()
returns void
language plpgsql
security definer
set search_path to 'public','rt46'
as $$
declare
  r record;
  v_days_out int;
begin
  for r in
    select m.id as merchant_id, m.insurance_valid_until, mu.profile_id
    from rt46.merchants m
    join rt46.merchant_users mu on mu.merchant_id = m.id
    where m.status = 'active' and m.insurance_valid_until is not null
  loop
    v_days_out := r.insurance_valid_until - current_date;
    if v_days_out in (60,30,14,7) then
      insert into public.notifications (profile_id, type, title, body)
      select r.profile_id, 'insurance_alert',
        format('Insurance expires in %s days', v_days_out),
        format('Your insurance policy expires on %s. Upload a renewed, verified policy before then to avoid suspension.', r.insurance_valid_until)
      where not exists (
        select 1 from public.notifications n
        where n.profile_id = r.profile_id and n.type = 'insurance_alert'
          and n.created_at::date = current_date
          and n.body like '%' || r.insurance_valid_until::text || '%'
      );
    end if;
  end loop;

  for r in
    select id from rt46.merchants
    where status = 'active' and insurance_valid_until is not null and insurance_valid_until < current_date
  loop
    update rt46.merchants set status = 'suspended', updated_at = now() where id = r.id;
    perform rt46.log_audit('merchant', r.id, 'suspended', null,
      'insurance expired', jsonb_build_object('auto', true));

    insert into public.notifications (profile_id, type, title, body)
    select mu.profile_id, 'merchant_suspended', 'Merchant suspended: insurance expired',
      'Your insurance has expired. No new work will be allocated until a valid, verified policy is uploaded.'
    from rt46.merchant_users mu where mu.merchant_id = r.id;
  end loop;

  update rt46.merchant_insurance_policies
    set status = 'expired'
    where status = 'verified' and expiry_date < current_date;
end; $$;

-- admin verify/reject; re-activates a suspended merchant if the new policy is valid.
create or replace function rt46.verify_insurance_policy(
  p_policy_id uuid, p_approve boolean, p_actor uuid, p_reason text default null
) returns void
language plpgsql
security definer
set search_path to 'public','rt46'
as $$
declare
  v_merchant_id uuid;
  v_expiry date;
  v_was_suspended boolean;
begin
  if not rt46.is_admin(p_actor) then
    raise exception 'only admins can verify insurance policies';
  end if;

  select merchant_id, expiry_date into v_merchant_id, v_expiry
  from rt46.merchant_insurance_policies where id = p_policy_id for update;

  if v_merchant_id is null then
    raise exception 'policy not found';
  end if;

  if p_approve then
    update rt46.merchant_insurance_policies
      set status = 'verified', verified_by = p_actor, verified_at = now(), rejection_reason = null
      where id = p_policy_id;

    select (status = 'suspended') into v_was_suspended from rt46.merchants where id = v_merchant_id;

    update rt46.merchants set insurance_valid_until = v_expiry, updated_at = now()
      where id = v_merchant_id;

    if v_was_suspended and v_expiry >= current_date then
      update rt46.merchants set status = 'active' where id = v_merchant_id;
      perform rt46.log_audit('merchant', v_merchant_id, 'reactivated', p_actor,
        'valid insurance re-uploaded and verified', jsonb_build_object('policy_id', p_policy_id));
    end if;

    perform rt46.log_audit('insurance_policy', p_policy_id, 'verified', p_actor, p_reason,
      jsonb_build_object('merchant_id', v_merchant_id, 'expiry_date', v_expiry));
  else
    update rt46.merchant_insurance_policies
      set status = 'rejected', verified_by = p_actor, verified_at = now(), rejection_reason = p_reason
      where id = p_policy_id;

    perform rt46.log_audit('insurance_policy', p_policy_id, 'rejected', p_actor, p_reason,
      jsonb_build_object('merchant_id', v_merchant_id));
  end if;
end; $$;

select cron.schedule('rt46-insurance-compliance-daily', '0 3 * * *', $$select rt46.run_insurance_compliance_check();$$);
