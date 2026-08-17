create table if not exists rt46.sla_targets (
  category text primary key,
  target_hours int not null check (target_hours > 0),
  updated_at timestamptz not null default now()
);

insert into rt46.sla_targets (category, target_hours) values
  ('service', 24), ('mechanical_repair', 72), ('panel_beating', 120),
  ('towing', 4), ('accident_repair', 168), ('specialist', 120),
  ('compliance', 48), ('other', 96)
on conflict (category) do nothing;

alter table rt46.work_orders
  add column if not exists due_at timestamptz,
  add column if not exists sla_breached boolean not null default false,
  add column if not exists sla_breached_at timestamptz;

create type rt46.sla_event_type as enum ('breach','escalated','resolved_late','resolved_on_time');

create table if not exists rt46.sla_events (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references rt46.work_orders(id) on delete cascade,
  event_type rt46.sla_event_type not null,
  detail text,
  created_at timestamptz not null default now()
);

create or replace function rt46.apply_sla_on_allocation()
returns trigger
language plpgsql
security definer
set search_path to 'public','rt46'
as $$
declare v_hours int;
begin
  if new.status = 'allocated' and (old.status is distinct from 'allocated') then
    select target_hours into v_hours from rt46.sla_targets where category = new.category;
    new.due_at := now() + make_interval(hours => coalesce(v_hours, 72));
    new.sla_breached := false;
    new.sla_breached_at := null;
  end if;

  if new.status = 'completed' and old.status is distinct from 'completed' then
    if new.due_at is not null then
      insert into rt46.sla_events (work_order_id, event_type, detail)
      values (new.id, case when now() <= new.due_at then 'resolved_on_time' else 'resolved_late' end,
        format('completed at %s, due %s', now(), new.due_at));
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_apply_sla on rt46.work_orders;
create trigger trg_apply_sla
  before update on rt46.work_orders
  for each row execute function rt46.apply_sla_on_allocation();

-- runs periodically (cron) to flag breaches and escalate
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
    where status in ('allocated','accepted','in_progress','waiting_for_parts')
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

    -- escalate to all admins
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

alter table rt46.sla_targets enable row level security;
alter table rt46.sla_events enable row level security;

create policy "sla targets readable by authenticated" on rt46.sla_targets
  for select using (auth.role() = 'authenticated');
create policy "sla targets admin write" on rt46.sla_targets
  for all using (rt46.is_admin()) with check (rt46.is_admin());

create policy "sla events admin all" on rt46.sla_events
  for all using (rt46.is_admin()) with check (rt46.is_admin());
create policy "sla events merchant read own" on rt46.sla_events
  for select using (exists (
    select 1 from rt46.work_orders wo where wo.id = work_order_id
    and rt46.is_merchant_staff(wo.allocated_merchant_id)
  ));

select cron.schedule('rt46-sla-breach-check', '*/15 * * * *', $$select rt46.process_sla_breaches();$$);
