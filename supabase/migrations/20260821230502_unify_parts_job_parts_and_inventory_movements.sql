-- Parts unification (matrix priority #2).
-- job_parts (legacy, per-job, free-text part names, no stock tracking) and
-- inventory_movements (catalog-backed, work_order-linked, stock-tracked) stay
-- as two separate tables — job_parts still needs to support free-text/non-catalog
-- parts that will never live in a stock catalog. What was missing:
--   1. A way for a job_part to optionally reference a real catalog item and have
--      that consumption actually hit stock (today it never does — a silent
--      inventory-accuracy bug independent of the "two systems" framing).
--   2. Any single place to read a work order's full parts history regardless of
--      which table it was recorded in.

-- 1. Optional catalog link on job_parts. Nullable — ad-hoc, non-catalog parts
--    remain fully supported and unaffected.
alter table public.job_parts
  add column if not exists inventory_item_id uuid references public.inventory_items(id);

-- 2. When a job_part is added with a catalog link, mirror it into
--    inventory_movements as a real 'issue' so quantity_on_hand stays accurate.
--    SECURITY DEFINER because this is a system-derived side effect of a write
--    the user is already authorized to make (job_parts insert), not a second,
--    independently-authorized action — mirrors the pattern already used by
--    log_job_status_change().
create or replace function public.sync_job_part_to_inventory_movement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_work_order_id uuid;
  v_actor uuid;
begin
  if new.inventory_item_id is null then
    return new;
  end if;

  select wo.organisation_id, wo.id
    into v_org_id, v_work_order_id
  from public.jobs j
  join public.work_orders wo on wo.id = j.generic_work_order_id
  where j.id = new.job_id;

  -- No linked generic work order yet (legacy job never bridged) -> no org
  -- context to attribute stock movement to. Skip rather than guess.
  if v_org_id is null then
    return new;
  end if;

  select created_by into v_actor from public.jobs where id = new.job_id;

  insert into public.inventory_movements
    (organisation_id, inventory_item_id, work_order_id, movement_type, quantity, unit_cost, note, created_by)
  values
    (v_org_id, new.inventory_item_id, v_work_order_id, 'issue', new.quantity, new.unit_cost,
     'Auto-recorded from job part: ' || new.part_name, v_actor);

  return new;
end;
$$;

drop trigger if exists trg_sync_job_part_to_inventory_movement on public.job_parts;
create trigger trg_sync_job_part_to_inventory_movement
after insert on public.job_parts
for each row
execute function public.sync_job_part_to_inventory_movement();

-- 3. Single read surface for "everything used on this work order", regardless
--    of which table it lives in. security_invoker so each caller's own RLS
--    still applies — this view grants no additional access.
create or replace view public.work_order_parts_unified
with (security_invoker = true) as
select
  jp.id,
  'job_parts'::text as source,
  wo.id as work_order_id,
  wo.organisation_id,
  j.id as job_id,
  jp.part_name as description,
  jp.inventory_item_id,
  jp.quantity,
  jp.unit_cost,
  (jp.quantity * coalesce(jp.unit_cost, 0)) as line_total,
  jp.created_at
from public.job_parts jp
join public.jobs j on j.id = jp.job_id
join public.work_orders wo on wo.id = j.generic_work_order_id
union all
select
  im.id,
  'inventory_movements'::text as source,
  im.work_order_id,
  im.organisation_id,
  null::uuid as job_id,
  ii.name as description,
  im.inventory_item_id,
  im.quantity,
  im.unit_cost,
  (im.quantity * coalesce(im.unit_cost, 0)) as line_total,
  im.created_at
from public.inventory_movements im
join public.inventory_items ii on ii.id = im.inventory_item_id
where im.movement_type = 'issue' and im.work_order_id is not null;
