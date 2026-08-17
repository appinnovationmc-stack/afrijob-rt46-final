-- Root-cause fix for the SLA cron bug: 'waiting_for_parts' was never a valid
-- rt46.work_order_status value (that enum only exists on public.jobs, an
-- unrelated table). This caused rt46.process_sla_breaches() to fail on every
-- 15-minute cron run since it was created — confirmed via cron.job_run_details
-- before this fix (every run had status='failed').
--
-- Rather than add a fake top-level status that would fork the state machine,
-- parts/authorization delay is modeled as an explicit sub-state so it can be
-- measured and excluded from breach counting without corrupting the one
-- authoritative status enum, and so the SLA clock is fairly paused/extended
-- rather than penalising a merchant for a delay outside their control.

alter table rt46.work_orders
  add column if not exists awaiting_parts boolean not null default false,
  add column if not exists awaiting_parts_since timestamptz,
  add column if not exists parts_delay_seconds integer not null default 0,
  add column if not exists awaiting_authorization boolean not null default false,
  add column if not exists awaiting_authorization_since timestamptz,
  add column if not exists authorization_delay_seconds integer not null default 0;

create or replace function rt46.set_awaiting_parts(p_work_order_id uuid, p_awaiting boolean, p_actor uuid)
returns void
language plpgsql
security definer
set search_path to 'public','rt46'
as $$
declare v_wo rt46.work_orders%rowtype;
begin
  if not (rt46.is_admin(p_actor) or exists (
    select 1 from rt46.work_orders wo where wo.id = p_work_order_id and rt46.is_merchant_staff(wo.allocated_merchant_id)
  )) then
    raise exception 'not authorized to update this work order';
  end if;

  select * into v_wo from rt46.work_orders where id = p_work_order_id for update;

  if p_awaiting and not v_wo.awaiting_parts then
    update rt46.work_orders set awaiting_parts = true, awaiting_parts_since = now() where id = p_work_order_id;
    perform rt46.log_audit('work_order', p_work_order_id, 'awaiting_parts_started', p_actor, null, '{}'::jsonb);
  elsif not p_awaiting and v_wo.awaiting_parts then
    update rt46.work_orders
      set awaiting_parts = false,
          parts_delay_seconds = parts_delay_seconds + extract(epoch from (now() - coalesce(v_wo.awaiting_parts_since, now())))::int,
          due_at = case when due_at is not null then due_at + (now() - coalesce(v_wo.awaiting_parts_since, now())) else due_at end,
          awaiting_parts_since = null
      where id = p_work_order_id;
    perform rt46.log_audit('work_order', p_work_order_id, 'awaiting_parts_ended', p_actor, null, '{}'::jsonb);
  end if;
end;
$$;

create or replace function rt46.set_awaiting_authorization(p_work_order_id uuid, p_awaiting boolean, p_actor uuid)
returns void
language plpgsql
security definer
set search_path to 'public','rt46'
as $$
declare v_wo rt46.work_orders%rowtype;
begin
  if not rt46.is_admin(p_actor) then
    raise exception 'only admins can toggle authorization-wait status';
  end if;

  select * into v_wo from rt46.work_orders where id = p_work_order_id for update;

  if p_awaiting and not v_wo.awaiting_authorization then
    update rt46.work_orders set awaiting_authorization = true, awaiting_authorization_since = now() where id = p_work_order_id;
    perform rt46.log_audit('work_order', p_work_order_id, 'awaiting_authorization_started', p_actor, null, '{}'::jsonb);
  elsif not p_awaiting and v_wo.awaiting_authorization then
    update rt46.work_orders
      set awaiting_authorization = false,
          authorization_delay_seconds = authorization_delay_seconds + extract(epoch from (now() - coalesce(v_wo.awaiting_authorization_since, now())))::int,
          due_at = case when due_at is not null then due_at + (now() - coalesce(v_wo.awaiting_authorization_since, now())) else due_at end,
          awaiting_authorization_since = null
      where id = p_work_order_id;
    perform rt46.log_audit('work_order', p_work_order_id, 'awaiting_authorization_ended', p_actor, null, '{}'::jsonb);
  end if;
end;
$$;

create or replace function rt46.process_sla_breaches()
returns void
language plpgsql
security definer
set search_path to 'public','rt46'
as $$
declare r record;
begin
  for r in
    select id, allocated_merchant_id, category, due_at
    from rt46.work_orders
    where status in ('allocated','accepted','in_progress')
      and awaiting_parts = false
      and awaiting_authorization = false
      and due_at is not null and due_at < now() and sla_breached = false
  loop
    update rt46.work_orders set sla_breached = true, sla_breached_at = now() where id = r.id;

    insert into rt46.sla_events (work_order_id, event_type, detail)
    values (r.id, 'breach', format('SLA breached, was due %s', r.due_at));

    perform rt46.log_audit('work_order', r.id, 'sla_breach', null, 'automatic SLA breach detection',
      jsonb_build_object('due_at', r.due_at, 'merchant_id', r.allocated_merchant_id));

    insert into public.notifications (profile_id, type, title, body, related_job_id)
    select mu.profile_id, 'system', 'SLA breached on work order',
      format('Work order %s (%s) has missed its turnaround target.', r.id, r.category), null
    from rt46.merchant_users mu where mu.merchant_id = r.allocated_merchant_id;

    insert into public.notifications (profile_id, type, title, body)
    select a.profile_id, 'system', 'SLA ESCALATION',
      format('Work order %s breached SLA (category: %s, merchant: %s). Immediate review required.',
        r.id, r.category, r.allocated_merchant_id)
    from rt46.admins a;

    insert into rt46.sla_events (work_order_id, event_type, detail)
    values (r.id, 'escalated', 'escalated to admin team');
  end loop;
end;
$$;
