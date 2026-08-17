alter table rt46.work_order_parts
  add column if not exists part_number text,
  add column if not exists description text,
  add column if not exists source text check (source in ('oem','aftermarket','salvage','other'));

alter table rt46.work_orders
  add column if not exists labour_hours numeric(6,2),
  add column if not exists labour_rate numeric(10,2),
  add column if not exists pdf_report_url text;

create table if not exists rt46.work_order_invoices (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references rt46.work_orders(id) on delete cascade,
  storage_path text not null,
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

-- enforce required part fields at insert time (mandatory part number, description, source)
create or replace function rt46.enforce_part_fields()
returns trigger
language plpgsql
as $$
begin
  if new.part_number is null or trim(new.part_number) = '' then
    raise exception 'part_number is required';
  end if;
  if new.description is null or trim(new.description) = '' then
    raise exception 'description is required';
  end if;
  if new.source is null then
    raise exception 'source (oem/aftermarket/salvage/other) is required';
  end if;
  if new.billed_unit_cost is null or new.billed_unit_cost <= 0 then
    raise exception 'billed_unit_cost must be a positive value';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_part_fields on rt46.work_order_parts;
create trigger trg_enforce_part_fields
  before insert or update on rt46.work_order_parts
  for each row execute function rt46.enforce_part_fields();

-- extend the completion gate: full parts+labour breakdown, invoice photo above threshold
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
  v_parts_total numeric;
  v_labour_hours numeric; v_labour_rate numeric;
  v_invoice_count int;
  v_wo rt46.work_orders%rowtype;
begin
  select * into v_wo from rt46.work_orders where id = p_work_order_id;

  select count(*) into v_missing_checklist
  from rt46.work_order_checklist_items
  where work_order_id = p_work_order_id and is_checked = false;
  if v_missing_checklist > 0 then return format('%s checklist item(s) not completed', v_missing_checklist); end if;

  select count(*) into v_before from rt46.work_order_evidence where work_order_id = p_work_order_id and stage = 'before';
  select count(*) into v_after from rt46.work_order_evidence where work_order_id = p_work_order_id and stage = 'after';
  if v_before = 0 then return 'missing before photo evidence'; end if;
  if v_after = 0 then return 'missing after photo evidence'; end if;

  select outcome into v_latest_outcome
  from rt46.work_order_quality_reviews where work_order_id = p_work_order_id order by created_at desc limit 1;
  if v_latest_outcome is null then return 'no quality review submitted'; end if;
  if v_latest_outcome <> 'pass' then return format('latest quality outcome is %s, not pass', v_latest_outcome); end if;

  select count(*) into v_open_rework from rt46.rework_cases where work_order_id = p_work_order_id and status <> 'resolved';
  if v_open_rework > 0 then return 'open rework case(s) remain'; end if;

  -- full parts + labour breakdown required
  select coalesce(sum(quantity * billed_unit_cost), 0) into v_parts_total
  from rt46.work_order_parts where work_order_id = p_work_order_id;

  v_labour_hours := v_wo.labour_hours;
  v_labour_rate := v_wo.labour_rate;

  if v_labour_hours is null or v_labour_rate is null then
    return 'labour hours and rate must be recorded before closing';
  end if;

  -- invoice photo required for high-value jobs (parts + labour > R10,000)
  if (v_parts_total + (v_labour_hours * v_labour_rate)) > 10000 then
    select count(*) into v_invoice_count from rt46.work_order_invoices where work_order_id = p_work_order_id;
    if v_invoice_count = 0 then
      return 'invoice photo required for high-value job (total exceeds R10,000)';
    end if;
  end if;

  return null;
end;
$$;

alter table rt46.work_order_invoices enable row level security;
create policy "invoices admin all" on rt46.work_order_invoices for all using (rt46.is_admin()) with check (rt46.is_admin());
create policy "invoices merchant read own" on rt46.work_order_invoices for select using (exists (
  select 1 from rt46.work_orders wo where wo.id = work_order_id and rt46.is_merchant_staff(wo.allocated_merchant_id)
));
create policy "invoices merchant insert own" on rt46.work_order_invoices for insert with check (exists (
  select 1 from rt46.work_orders wo where wo.id = work_order_id and rt46.is_merchant_staff(wo.allocated_merchant_id)
));
