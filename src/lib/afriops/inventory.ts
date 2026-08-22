import { SupabaseClient } from '@supabase/supabase-js';
import { InventoryItem, InventoryMovement, MovementType } from './types';

export async function listInventoryItems(
  supabase: SupabaseClient,
  organisationId: string,
  siteId?: string
): Promise<InventoryItem[]> {
  let query = supabase
    .from('inventory_items')
    .select('*')
    .eq('organisation_id', organisationId)
    .order('name');
  if (siteId) query = query.eq('site_id', siteId);

  const { data, error } = await query;
  if (error) throw error;
  return data as InventoryItem[];
}

export async function createInventoryItem(
  supabase: SupabaseClient,
  item: Pick<InventoryItem, 'organisation_id' | 'name' | 'unit'> &
    Partial<Pick<InventoryItem, 'site_id' | 'sku' | 'category' | 'reorder_point' | 'unit_cost'>>
): Promise<InventoryItem> {
  const { data, error } = await supabase.from('inventory_items').insert(item).select().single();
  if (error) throw error;
  return data as InventoryItem;
}

// Never update quantity_on_hand directly — always go through a movement so the
// trigger keeps the running total consistent and auditable.
export async function recordInventoryMovement(
  supabase: SupabaseClient,
  movement: {
    organisation_id: string;
    inventory_item_id: string;
    movement_type: MovementType;
    quantity: number;
    work_order_id?: string;
    unit_cost?: number;
    note?: string;
  }
): Promise<InventoryMovement> {
  if (movement.quantity <= 0) {
    throw new Error('Movement quantity must be positive; use movement_type to indicate direction.');
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('inventory_movements')
    .insert({ ...movement, created_by: user?.id })
    .select()
    .single();
  if (error) throw error;
  return data as InventoryMovement;
}

export async function listInventoryMovements(
  supabase: SupabaseClient,
  inventoryItemId: string
): Promise<InventoryMovement[]> {
  const { data, error } = await supabase
    .from('inventory_movements')
    .select('*')
    .eq('inventory_item_id', inventoryItemId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as InventoryMovement[];
}

export function isBelowReorderPoint(item: InventoryItem): boolean {
  return item.reorder_point !== null && item.quantity_on_hand <= item.reorder_point;
}

