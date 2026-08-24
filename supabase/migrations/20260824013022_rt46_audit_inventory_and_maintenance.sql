-- Additive audit coverage for inventory (items + movements) and
-- preventive maintenance (schedules + runs). Follows the exact same
-- pattern as the existing trg_audit_assets / trg_audit_work_orders /
-- trg_audit_organisation_members triggers: SECURITY DEFINER function
-- calling public.log_audit(), attached via AFTER trigger. Purely
-- additive — no existing table, column, row, or trigger is modified.

-- 1. Inventory items: creation and material field changes.
create or replace function public.trg_audit_inventory_items()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if tg_op = 'INSERT' then
    perform public.log_audit(
      new.organisation_id, 'inventory_item', new.id, 'item_created', auth.uid(),
      null,
      jsonb_build_object('name', new.name, 'sku', new.sku, 'unit', new.unit, 'unit_cost', new.unit_cost, 'reorder_point', new.reorder_point)
    );
    return new;
  end if;

  if tg_op = 'UPDATE' and (
    new.unit_cost is distinct from old.unit_cost
    or new.reorder_point is distinct from old.reorder_point
    or new.quantity_on_hand is distinct from old.quantity_on_hand
  ) then
    perform public.log_audit(
      new.organisation_id, 'inventory_item', new.id, 'item_updated', auth.uid(),
      jsonb_build_object('unit_cost', old.unit_cost, 'reorder_point', old.reorder_point, 'quantity_on_hand', old.quantity_on_hand),
      jsonb_build_object('unit_cost', new.unit_cost, 'reorder_point', new.reorder_point, 'quantity_on_hand', new.quantity_on_hand)
    );
  end if;
  return new;
end;
$function$;

drop trigger if exists audit_inventory_items on public.inventory_items;
create trigger audit_inventory_items
  after insert or update on public.inventory_items
  for each row execute function public.trg_audit_inventory_items();

-- 2. Inventory movements: immutable ledger, so INSERT-only. This is the
-- real cost/parts trail (Asset -> Work Order -> Parts -> Inventory
-- movement -> Cost) the Phase C parts unification work depends on.
create or replace function public.trg_audit_inventory_movements()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  perform public.log_audit(
    new.organisation_id, 'inventory_movement', new.id, 'movement_recorded', auth.uid(),
    null,
    jsonb_build_object(
      'inventory_item_id', new.inventory_item_id,
      'work_order_id', new.work_order_id,
      'movement_type', new.movement_type,
      'quantity', new.quantity,
      'unit_cost', new.unit_cost,
      'source_job_part_id', new.source_job_part_id
    )
  );
  return new;
end;
$function$;

drop trigger if exists audit_inventory_movements on public.inventory_movements;
create trigger audit_inventory_movements
  after insert on public.inventory_movements
  for each row execute function public.trg_audit_inventory_movements();

-- 3. Preventive maintenance: schedule creation/activation toggles, and
-- each time a schedule actually fires and produces a run.
create or replace function public.trg_audit_maintenance_schedules()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if tg_op = 'INSERT' then
    perform public.log_audit(
      new.organisation_id, 'maintenance_schedule', new.id, 'schedule_created', auth.uid(),
      null,
      jsonb_build_object('name', new.name, 'asset_id', new.asset_id, 'trigger_type', new.trigger_type, 'active', new.active)
    );
    return new;
  end if;

  if tg_op = 'UPDATE' and new.active is distinct from old.active then
    perform public.log_audit(
      new.organisation_id, 'maintenance_schedule', new.id,
      case when new.active then 'schedule_activated' else 'schedule_deactivated' end,
      auth.uid(),
      jsonb_build_object('active', old.active),
      jsonb_build_object('active', new.active)
    );
  end if;
  return new;
end;
$function$;

drop trigger if exists audit_maintenance_schedules on public.maintenance_schedules;
create trigger audit_maintenance_schedules
  after insert or update on public.maintenance_schedules
  for each row execute function public.trg_audit_maintenance_schedules();

create or replace function public.trg_audit_maintenance_schedule_runs()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  perform public.log_audit(
    new.organisation_id, 'maintenance_schedule_run', new.id, 'maintenance_triggered', auth.uid(),
    null,
    jsonb_build_object('schedule_id', new.schedule_id, 'due_at', new.due_at, 'status', new.status, 'work_order_id', new.work_order_id)
  );
  return new;
end;
$function$;

drop trigger if exists audit_maintenance_schedule_runs on public.maintenance_schedule_runs;
create trigger audit_maintenance_schedule_runs
  after insert on public.maintenance_schedule_runs
  for each row execute function public.trg_audit_maintenance_schedule_runs();
