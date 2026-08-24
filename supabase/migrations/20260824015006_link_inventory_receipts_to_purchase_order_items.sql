-- Closes the real gap flagged in this session's audit: Asset -> Work Order
-- -> Parts -> Inventory movement traced fine, but Inventory -> Supplier
-- broke down because receive_purchase_order_item() only recorded the PO
-- id in a free-text note, not a queryable FK. Fixes that at the source.
--
-- One pre-existing receipt row (73aa0a09-9b44-40d7-bf3c-e00dcafdfab4) has
-- note = null and predates this convention entirely -- left NULL rather
-- than guessed at. Every receipt from this migration forward is linked.

alter table public.inventory_movements
  add column if not exists purchase_order_item_id uuid references public.purchase_order_items(id);

comment on column public.inventory_movements.purchase_order_item_id is
  'Set for movement_type = receipt rows created by receive_purchase_order_item(). '
  'Enables tracing Inventory -> Purchase Order -> Supplier for stock that came '
  'in via procurement. NULL for manual/legacy receipts with no PO record.';

create or replace function public.receive_purchase_order_item(p_po_item_id uuid, p_quantity numeric)
returns public.purchase_order_items
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_item public.purchase_order_items;
  v_po public.purchase_orders;
  v_remaining_items int;
begin
  if p_quantity <= 0 then
    raise exception 'receive quantity must be positive';
  end if;

  select * into v_item from public.purchase_order_items where id = p_po_item_id for update;
  if v_item.id is null then
    raise exception 'purchase order item % not found', p_po_item_id;
  end if;

  select * into v_po from public.purchase_orders where id = v_item.purchase_order_id for update;

  if not public.has_permission(v_po.organisation_id, 'procurement.receive') then
    raise exception 'not authorised to receive against this organisation''s purchase orders';
  end if;
  if v_po.status not in ('approved','ordered','partially_received') then
    raise exception 'purchase order in status % cannot be received against', v_po.status;
  end if;
  if v_item.received_quantity + p_quantity > v_item.quantity then
    raise exception 'received quantity would exceed ordered quantity (% + % > %)', v_item.received_quantity, p_quantity, v_item.quantity;
  end if;

  update public.purchase_order_items
  set received_quantity = received_quantity + p_quantity
  where id = p_po_item_id
  returning * into v_item;

  if v_item.inventory_item_id is not null then
    insert into public.inventory_movements
      (organisation_id, inventory_item_id, movement_type, quantity, unit_cost, note, created_by, purchase_order_item_id)
    values
      (v_po.organisation_id, v_item.inventory_item_id, 'receipt', p_quantity, v_item.unit_cost,
       'PO receipt: ' || v_po.id::text, auth.uid(), v_item.id);
  end if;

  select count(*) into v_remaining_items
  from public.purchase_order_items
  where purchase_order_id = v_po.id and received_quantity < quantity;

  update public.purchase_orders
  set status = case when v_remaining_items = 0 then 'received' else 'partially_received' end,
      updated_at = now()
  where id = v_po.id;

  return v_item;
end;
$function$;

-- Read surface: for a given inventory item, its full receipt history with
-- supplier attached. security_invoker so RLS on the underlying tables still
-- applies -- grants no new access.
create or replace view public.inventory_item_supplier_history
with (security_invoker = true) as
select
  im.id as movement_id,
  im.organisation_id,
  im.inventory_item_id,
  im.quantity,
  im.unit_cost,
  im.created_at as received_at,
  po.id as purchase_order_id,
  po.status as purchase_order_status,
  s.id as supplier_id,
  s.trading_name as supplier_name
from public.inventory_movements im
join public.purchase_order_items poi on poi.id = im.purchase_order_item_id
join public.purchase_orders po on po.id = poi.purchase_order_id
join public.suppliers s on s.id = po.supplier_id
where im.movement_type = 'receipt';
