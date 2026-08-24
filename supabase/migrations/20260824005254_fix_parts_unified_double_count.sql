-- Root cause: sync_job_part_to_inventory_movement() auto-creates an
-- inventory_movements row for every job_part with an inventory_item_id,
-- and work_order_parts_unified UNIONs the job_parts branch with the
-- inventory_movements branch — so that auto-synced movement got counted
-- a second time alongside the job_parts row it was derived from.
-- Verified live: inserting 1 job_part produced 2 unified rows (rolled
-- back after confirming, no data changed).
--
-- Fix: add a nullable FK marking which inventory_movements rows were
-- auto-derived from a job_part, set it in the sync trigger, and exclude
-- those rows from the inventory_movements branch of the view (the
-- job_parts branch already reports them). Additive, nullable, backward
-- compatible — legacy/manual inventory_movements rows (this column
-- null) are completely unaffected and keep counting exactly as before.

alter table public.inventory_movements
  add column if not exists source_job_part_id uuid references public.job_parts(id);

comment on column public.inventory_movements.source_job_part_id is
  'Set only for rows auto-created by sync_job_part_to_inventory_movement(). '
  'Used by work_order_parts_unified to avoid double-counting the same '
  'part consumption once as a job_part and again as its derived movement.';

create or replace function public.sync_job_part_to_inventory_movement()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
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

  if v_org_id is null then
    return new;
  end if;

  select created_by into v_actor from public.jobs where id = new.job_id;

  insert into public.inventory_movements
    (organisation_id, inventory_item_id, work_order_id, movement_type, quantity, unit_cost, note, created_by, source_job_part_id)
  values
    (v_org_id, new.inventory_item_id, v_work_order_id, 'issue', new.quantity, new.unit_cost,
     'Auto-recorded from job part: ' || new.part_name, v_actor, new.id);

  return new;
end;
$function$;

create or replace view public.work_order_parts_unified as
 SELECT jp.id,
    'job_parts'::text AS source,
    wo.id AS work_order_id,
    wo.organisation_id,
    wo.asset_id,
    j.id AS job_id,
    jp.part_name AS description,
    jp.inventory_item_id,
    jp.quantity,
    jp.unit_cost,
    jp.quantity * COALESCE(jp.unit_cost, 0::numeric) AS line_total,
    jp.created_at
   FROM job_parts jp
     JOIN jobs j ON j.id = jp.job_id
     JOIN work_orders wo ON wo.id = j.generic_work_order_id
UNION ALL
 SELECT im.id,
    'inventory_movements'::text AS source,
    im.work_order_id,
    im.organisation_id,
    wo.asset_id,
    NULL::uuid AS job_id,
    ii.name AS description,
    im.inventory_item_id,
    im.quantity,
    im.unit_cost,
    im.quantity * COALESCE(im.unit_cost, 0::numeric) AS line_total,
    im.created_at
   FROM inventory_movements im
     JOIN inventory_items ii ON ii.id = im.inventory_item_id
     JOIN work_orders wo ON wo.id = im.work_order_id
  WHERE im.movement_type = 'issue'::text
    AND im.work_order_id IS NOT NULL
    AND im.source_job_part_id IS NULL;
