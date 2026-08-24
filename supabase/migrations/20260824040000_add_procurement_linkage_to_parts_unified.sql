-- Adds procurement traceability to the unified parts view, completing the
-- Asset -> Work Order -> Parts -> Inventory movement -> Supplier/Procurement
-- -> Cost chain for the branch where it genuinely exists.
--
-- job_parts has no purchase-order column (confirmed against live schema),
-- so job_parts-sourced rows correctly return null for po_number/supplier
-- rather than fabricating a link. inventory_movements rows that were
-- receipted against a PO (via purchase_order_item_id, added in
-- link_inventory_receipts_to_purchase_order_items) resolve the real chain.

create or replace view public.work_order_parts_unified as
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
  jp.quantity * coalesce(jp.unit_cost, 0::numeric) as line_total,
  jp.created_at,
  null::uuid as purchase_order_id,
  null::text as po_number,
  null::text as supplier_name
from job_parts jp
  join jobs j on j.id = jp.job_id
  join work_orders wo on wo.id = j.generic_work_order_id
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
  im.quantity * coalesce(im.unit_cost, 0::numeric) as line_total,
  im.created_at,
  po.id as purchase_order_id,
  po.id::text as po_number,
  coalesce(s.trading_name, s.legal_name) as supplier_name
from inventory_movements im
  join inventory_items ii on ii.id = im.inventory_item_id
  join work_orders wo on wo.id = im.work_order_id
  left join purchase_order_items poi on poi.id = im.purchase_order_item_id
  left join purchase_orders po on po.id = poi.purchase_order_id
  left join suppliers s on s.id = po.supplier_id
where im.movement_type = 'issue'::text
  and im.work_order_id is not null
  and im.source_job_part_id is null;
