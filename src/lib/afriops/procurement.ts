import { SupabaseClient } from '@supabase/supabase-js';
import { PurchaseOrder, PurchaseOrderItem, Supplier } from './types';
import { notifyOrgRoles, notifyProfile } from './notifications';

// ---------- Suppliers ----------

export async function listSuppliers(supabase: SupabaseClient, organisationId: string): Promise<Supplier[]> {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('organisation_id', organisationId)
    .order('trading_name');
  if (error) throw error;
  return data as Supplier[];
}

export async function createSupplier(
  supabase: SupabaseClient,
  supplier: Pick<Supplier, 'organisation_id' | 'trading_name'> & Partial<Supplier>
): Promise<Supplier> {
  const { data, error } = await supabase.from('suppliers').insert(supplier).select().single();
  if (error) throw error;
  return data as Supplier;
}

// ---------- Purchase Orders ----------

export async function listPurchaseOrders(
  supabase: SupabaseClient,
  organisationId: string
): Promise<(PurchaseOrder & { supplier: Pick<Supplier, 'trading_name'> })[]> {
  const { data, error } = await supabase
    .from('purchase_orders')
    .select('*, supplier:suppliers(trading_name)')
    .eq('organisation_id', organisationId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as (PurchaseOrder & { supplier: Pick<Supplier, 'trading_name'> })[];
}

export async function createPurchaseOrder(
  supabase: SupabaseClient,
  po: Pick<PurchaseOrder, 'organisation_id' | 'supplier_id'> & Partial<PurchaseOrder>,
  items: Pick<PurchaseOrderItem, 'description' | 'quantity' | 'unit_cost'> &
    Partial<Pick<PurchaseOrderItem, 'inventory_item_id'>>[]
): Promise<PurchaseOrder> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: createdPo, error: poError } = await supabase
    .from('purchase_orders')
    .insert({ ...po, status: 'draft', requested_by: user?.id })
    .select()
    .single();
  if (poError) throw poError;

  if (items.length > 0) {
    const { error: itemsError } = await supabase
      .from('purchase_order_items')
      .insert(items.map((i) => ({ ...i, purchase_order_id: createdPo.id })));
    if (itemsError) throw itemsError;
  }

  return createdPo as PurchaseOrder;
}

export async function listPurchaseOrderItems(
  supabase: SupabaseClient,
  purchaseOrderId: string
): Promise<PurchaseOrderItem[]> {
  const { data, error } = await supabase
    .from('purchase_order_items')
    .select('*')
    .eq('purchase_order_id', purchaseOrderId);
  if (error) throw error;
  return data as PurchaseOrderItem[];
}

// Submits for approval — a plain status update, no RPC needed since there's no business
// logic to enforce beyond RLS at this stage.
// After a successful submit, fan out in-app notifications to roles that hold
// procurement.approve (finance / admin / owner) so the Procurement Officer
// is no longer blind to whether anyone has been told their PO needs action.
export async function submitPurchaseOrder(supabase: SupabaseClient, purchaseOrderId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: po, error: fetchError } = await supabase
    .from('purchase_orders')
    .select('id, organisation_id, status')
    .eq('id', purchaseOrderId)
    .single();
  if (fetchError) throw fetchError;
  if (!po || po.status !== 'draft') {
    throw new Error('Purchase order is not in draft status');
  }

  const { error } = await supabase
    .from('purchase_orders')
    .update({ status: 'submitted' })
    .eq('id', purchaseOrderId)
    .eq('status', 'draft'); // guard: only submittable from draft
  if (error) throw error;

  // Best-effort — never fail the submit because notifications could not be written.
  await notifyOrgRoles(supabase, {
    organisation_id: po.organisation_id,
    roles: ['finance', 'admin', 'owner'],
    type: 'purchase_order_approval_needed',
    title: 'Purchase order needs approval',
    body: 'A purchase order was submitted and is waiting for approval.',
    link_entity_type: 'purchase_order',
    link_entity_id: purchaseOrderId,
    excludeProfileId: user?.id,
  });
}

// Approval has real business rules enforced server-side (self-approval block, status
// guard) — always go through the RPC, never update status='approved' directly.
export async function approvePurchaseOrder(supabase: SupabaseClient, purchaseOrderId: string): Promise<PurchaseOrder> {
  const { data, error } = await supabase.rpc('approve_purchase_order', { p_po_id: purchaseOrderId });
  if (error) {
    // Surface the specific reason (e.g. "requester cannot approve their own purchase order")
    // to the UI rather than a generic failure message.
    throw new Error(error.message);
  }
  const approved = data as PurchaseOrder;

  // Notify the original requester that their PO was approved (if known).
  if (approved?.requested_by && approved?.organisation_id) {
    await notifyProfile(supabase, {
      organisation_id: approved.organisation_id,
      recipient_profile_id: approved.requested_by,
      type: 'purchase_order_approved',
      title: 'Purchase order approved',
      body: 'Your purchase order has been approved.',
      link_entity_type: 'purchase_order',
      link_entity_id: purchaseOrderId,
    });
  }

  return approved;
}

// Receiving posts a real inventory movement server-side and rolls PO status forward.
// Never manually insert into inventory_movements for a PO receipt — you'll double-count.
export async function receivePurchaseOrderItem(
  supabase: SupabaseClient,
  purchaseOrderItemId: string,
  quantity: number
): Promise<PurchaseOrderItem> {
  const { data, error } = await supabase.rpc('receive_purchase_order_item', {
    p_po_item_id: purchaseOrderItemId,
    p_quantity: quantity,
  });
  if (error) throw new Error(error.message);
  return data as PurchaseOrderItem;
}
