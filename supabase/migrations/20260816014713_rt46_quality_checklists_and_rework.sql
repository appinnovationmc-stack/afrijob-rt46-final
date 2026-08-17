-- ============ QUALITY CONTROL ============

create table if not exists rt46.quality_checklist_templates (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  item_order int not null default 0,
  item_text text not null,
  is_required boolean not null default true,
  created_at timestamptz not null default now(),
  unique (category, item_text)
);

create table if not exists rt46.work_order_checklist_items (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references rt46.work_orders(id) on delete cascade,
  template_id uuid not null references rt46.quality_checklist_templates(id),
  is_checked boolean not null default false,
  checked_by uuid references public.profiles(id),
  checked_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  unique (work_order_id, template_id)
);

create type rt46.evidence_stage as enum ('before','during','after');

create table if not exists rt46.work_order_evidence (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references rt46.work_orders(id) on delete cascade,
  stage rt46.evidence_stage not null,
  storage_path text not null,
  latitude double precision not null,
  longitude double precision not null,
  taken_at timestamptz not null,
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create type rt46.quality_outcome as enum ('pass','rework','fail');

create table if not exists rt46.work_order_quality_reviews (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references rt46.work_orders(id) on delete cascade,
  reviewer_profile_id uuid not null references public.profiles(id),
  score numeric(5,2) not null check (score >= 0 and score <= 100),
  outcome rt46.quality_outcome not null,
  notes text,
  created_at timestamptz not null default now()
);

create type rt46.rework_status as enum ('open','in_progress','resolved');

create table if not exists rt46.rework_cases (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references rt46.work_orders(id) on delete cascade,
  quality_review_id uuid not null references rt46.work_order_quality_reviews(id),
  reason text not null,
  status rt46.rework_status not null default 'open',
  opened_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table rt46.work_orders enable row level security;

-- checklist auto-seed when a work order is allocated
create or replace function rt46.seed_checklist_on_allocation()
returns trigger
language plpgsql
security definer
set search_path to 'public','rt46'
as $$
begin
  if new.status = 'allocated' and (old.status is distinct from 'allocated') then
    insert into rt46.work_order_checklist_items (work_order_id, template_id)
    select new.id, t.id
    from rt46.quality_checklist_templates t
    where t.category = new.category
    on conflict (work_order_id, template_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_seed_checklist on rt46.work_orders;
create trigger trg_seed_checklist
  after update on rt46.work_orders
  for each row execute function rt46.seed_checklist_on_allocation();

-- quality review submission: recomputes merchant quality_score, opens rework if needed
create or replace function rt46.submit_quality_review(
  p_work_order_id uuid, p_score numeric, p_outcome rt46.quality_outcome,
  p_notes text, p_actor uuid
) returns uuid
language plpgsql
security definer
set search_path to 'public','rt46'
as $$
declare
  v_review_id uuid;
  v_merchant_id uuid;
  v_avg numeric;
begin
  if not rt46.is_admin(p_actor) then
    raise exception 'only admins can submit quality reviews';
  end if;

  select allocated_merchant_id into v_merchant_id from rt46.work_orders where id = p_work_order_id;
  if v_merchant_id is null then
    raise exception 'work order has no allocated merchant';
  end if;

  insert into rt46.work_order_quality_reviews (work_order_id, reviewer_profile_id, score, outcome, notes)
  values (p_work_order_id, p_actor, p_score, p_outcome, p_notes)
  returning id into v_review_id;

  if p_outcome in ('rework','fail') then
    insert into rt46.rework_cases (work_order_id, quality_review_id, reason)
    values (p_work_order_id, v_review_id, coalesce(p_notes, 'quality review outcome: ' || p_outcome));
  end if;

  select avg(score) into v_avg
  from (
    select score from rt46.work_order_quality_reviews r
    join rt46.work_orders wo on wo.id = r.work_order_id
    where wo.allocated_merchant_id = v_merchant_id
    order by r.created_at desc
    limit 20
  ) recent;

  update rt46.merchants set quality_score = round(coalesce(v_avg, 100) / 100.0, 4), updated_at = now()
  where id = v_merchant_id;

  perform rt46.log_audit('work_order', p_work_order_id, 'quality_review_submitted', p_actor, p_notes,
    jsonb_build_object('score', p_score, 'outcome', p_outcome, 'merchant_id', v_merchant_id));

  return v_review_id;
end;
$$;

-- gate: can this work order be marked completed?
create or replace function rt46.can_complete_work_order(p_work_order_id uuid)
returns text
language plpgsql
security definer
set search_path to 'public','rt46'
as $$
declare
  v_missing_checklist int;
  v_before int; v_after int;
  v_latest_outcome rt46.quality_outcome;
  v_open_rework int;
begin
  select count(*) into v_missing_checklist
  from rt46.work_order_checklist_items
  where work_order_id = p_work_order_id and is_checked = false;
  if v_missing_checklist > 0 then
    return format('%s checklist item(s) not completed', v_missing_checklist);
  end if;

  select count(*) into v_before from rt46.work_order_evidence where work_order_id = p_work_order_id and stage = 'before';
  select count(*) into v_after from rt46.work_order_evidence where work_order_id = p_work_order_id and stage = 'after';
  if v_before = 0 then return 'missing before photo evidence'; end if;
  if v_after = 0 then return 'missing after photo evidence'; end if;

  select outcome into v_latest_outcome
  from rt46.work_order_quality_reviews where work_order_id = p_work_order_id
  order by created_at desc limit 1;
  if v_latest_outcome is null then return 'no quality review submitted'; end if;
  if v_latest_outcome <> 'pass' then return format('latest quality outcome is %s, not pass', v_latest_outcome); end if;

  select count(*) into v_open_rework
  from rt46.rework_cases where work_order_id = p_work_order_id and status <> 'resolved';
  if v_open_rework > 0 then return 'open rework case(s) remain'; end if;

  return null;
end;
$$;

create or replace function rt46.block_incomplete_close()
returns trigger
language plpgsql
as $$
declare v_blocker text;
begin
  if new.status = 'completed' and (old.status is distinct from 'completed') then
    v_blocker := rt46.can_complete_work_order(new.id);
    if v_blocker is not null then
      raise exception 'cannot complete work order: %', v_blocker using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_block_incomplete_close on rt46.work_orders;
create trigger trg_block_incomplete_close
  before update on rt46.work_orders
  for each row execute function rt46.block_incomplete_close();

-- seed default checklist templates by category
insert into rt46.quality_checklist_templates (category, item_order, item_text, is_required) values
  ('mechanical_repair', 1, 'Fault diagnosis recorded', true),
  ('mechanical_repair', 2, 'Replaced parts match approved quote', true),
  ('mechanical_repair', 3, 'Road test completed', true),
  ('mechanical_repair', 4, 'Fluid levels checked and topped up', true),
  ('panel_beating', 1, 'Panel alignment verified', true),
  ('panel_beating', 2, 'Paint match verified in daylight', true),
  ('panel_beating', 3, 'Rust/corrosion treated', true),
  ('service', 1, 'Service schedule items completed', true),
  ('service', 2, 'Tyre pressure and tread checked', true),
  ('service', 3, 'Brakes inspected', true),
  ('accident_repair', 1, 'Structural integrity assessed', true),
  ('accident_repair', 2, 'Safety systems (airbags/sensors) tested', true),
  ('towing', 1, 'Vehicle secured correctly', true),
  ('towing', 2, 'No new damage on delivery', true),
  ('compliance', 1, 'Roadworthy criteria checked', true),
  ('specialist', 1, 'Specialist sign-off obtained', true),
  ('other', 1, 'Work scope confirmed with customer', true)
on conflict (category, item_text) do nothing;

-- RLS: admins full access; merchant staff can read/update their own work order's checklist/evidence
alter table rt46.quality_checklist_templates enable row level security;
alter table rt46.work_order_checklist_items enable row level security;
alter table rt46.work_order_evidence enable row level security;
alter table rt46.work_order_quality_reviews enable row level security;
alter table rt46.rework_cases enable row level security;

create policy "templates readable by authenticated" on rt46.quality_checklist_templates
  for select using (auth.role() = 'authenticated');
create policy "templates admin write" on rt46.quality_checklist_templates
  for all using (rt46.is_admin()) with check (rt46.is_admin());

create policy "checklist items admin all" on rt46.work_order_checklist_items
  for all using (rt46.is_admin()) with check (rt46.is_admin());
create policy "checklist items merchant read own" on rt46.work_order_checklist_items
  for select using (exists (
    select 1 from rt46.work_orders wo where wo.id = work_order_id
    and rt46.is_merchant_staff(wo.allocated_merchant_id)
  ));
create policy "checklist items merchant update own" on rt46.work_order_checklist_items
  for update using (exists (
    select 1 from rt46.work_orders wo where wo.id = work_order_id
    and rt46.is_merchant_staff(wo.allocated_merchant_id)
  ));

create policy "evidence admin all" on rt46.work_order_evidence
  for all using (rt46.is_admin()) with check (rt46.is_admin());
create policy "evidence merchant read own" on rt46.work_order_evidence
  for select using (exists (
    select 1 from rt46.work_orders wo where wo.id = work_order_id
    and rt46.is_merchant_staff(wo.allocated_merchant_id)
  ));
create policy "evidence merchant insert own" on rt46.work_order_evidence
  for insert with check (exists (
    select 1 from rt46.work_orders wo where wo.id = work_order_id
    and rt46.is_merchant_staff(wo.allocated_merchant_id)
  ));

create policy "reviews admin all" on rt46.work_order_quality_reviews
  for all using (rt46.is_admin()) with check (rt46.is_admin());
create policy "reviews merchant read own" on rt46.work_order_quality_reviews
  for select using (exists (
    select 1 from rt46.work_orders wo where wo.id = work_order_id
    and rt46.is_merchant_staff(wo.allocated_merchant_id)
  ));

create policy "rework admin all" on rt46.rework_cases
  for all using (rt46.is_admin()) with check (rt46.is_admin());
create policy "rework merchant read own" on rt46.rework_cases
  for select using (exists (
    select 1 from rt46.work_orders wo where wo.id = work_order_id
    and rt46.is_merchant_staff(wo.allocated_merchant_id)
  ));
