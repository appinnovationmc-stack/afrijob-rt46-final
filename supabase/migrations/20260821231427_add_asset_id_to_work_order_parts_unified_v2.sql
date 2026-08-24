drop view if exists public.work_order_parts_unified;

create view public.work_order_parts_unified
with (security_invoker = true) as
select
  jp.id,
  'job_parts'::text as source,
  wo.id as work_order_id,
  wo.organisation_id,
  wo.asset_id,
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
  wo.asset_id,
  null::uuid as job_id,
  ii.name as description,
  im.inventory_item_id,
  im.quantity,
  im.unit_cost,
  (im.quantity * coalesce(im.unit_cost, 0)) as line_total,
  im.created_at
from public.inventory_movements im
join public.inventory_items ii on ii.id = im.inventory_item_id
join public.work_orders wo on wo.id = im.work_order_id
where im.movement_type = 'issue' and im.work_order_id is not null;
