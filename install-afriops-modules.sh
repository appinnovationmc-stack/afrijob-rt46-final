#!/usr/bin/env bash
set -euo pipefail

# Installs the AfriOps backend service layer into src/lib/afriops/
# Run this from the ROOT of your afrijob-rt46-final repo.

if [ ! -f "package.json" ]; then
  echo "Error: no package.json found here. cd into your repo root first (e.g. cd ~/Downloads/afrijob-rt46-final) then re-run this script."
  exit 1
fi

mkdir -p src/lib/afriops

cat > src/lib/afriops/types.ts << '__AFRIOPS_EOF_types_ts__'
// Types mirroring the live Supabase schema (project wtbycozfoeiepvgortvx).
// Generated from actual production tables — keep in sync if columns change.

// ---------- RBAC ----------
export type OrganisationRole = 'owner' | 'admin' | 'manager' | 'member' | 'viewer';

export interface Permission {
  code: string;
  module: string;
  description: string;
}

export interface RolePermission {
  role: OrganisationRole;
  permission_code: string;
  granted: boolean;
}

// ---------- Inventory ----------
export interface InventoryItem {
  id: string;
  organisation_id: string;
  site_id: string | null;
  sku: string | null;
  name: string;
  category: string | null;
  unit: string;
  quantity_on_hand: number;
  reorder_point: number | null;
  unit_cost: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type MovementType = 'receipt' | 'issue' | 'adjustment' | 'return';

export interface InventoryMovement {
  id: string;
  organisation_id: string;
  inventory_item_id: string;
  work_order_id: string | null;
  movement_type: MovementType;
  quantity: number;
  unit_cost: number | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

// ---------- Suppliers & Procurement ----------
export type SupplierStatus = 'pending_review' | 'active' | 'suspended' | 'terminated';

export interface Supplier {
  id: string;
  organisation_id: string;
  trading_name: string;
  legal_name: string | null;
  registration_number: string | null;
  categories: string[];
  contact_email: string | null;
  contact_phone: string | null;
  status: SupplierStatus;
  rating: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type PurchaseOrderStatus =
  | 'draft' | 'submitted' | 'approved' | 'ordered' | 'partially_received' | 'received' | 'cancelled';

export interface PurchaseOrder {
  id: string;
  organisation_id: string;
  supplier_id: string;
  site_id: string | null;
  status: PurchaseOrderStatus;
  requested_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  currency: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderItem {
  id: string;
  purchase_order_id: string;
  inventory_item_id: string | null;
  description: string;
  quantity: number;
  unit_cost: number;
  received_quantity: number;
  created_at: string;
}

// ---------- Document Vault ----------
export type DocumentEntityType =
  | 'organisation' | 'site' | 'asset' | 'service_provider' | 'supplier' | 'work_order' | 'business_unit';

export type DocumentStatus = 'valid' | 'expiring_soon' | 'expired' | 'no_expiry';

export interface VaultDocument {
  id: string;
  organisation_id: string;
  entity_type: DocumentEntityType;
  entity_id: string;
  doc_type: string;
  storage_path: string;
  issued_date: string | null;
  expiry_date: string | null;
  status: DocumentStatus; // read-only — set by DB trigger, never write this field
  uploaded_by: string | null;
  verified_by: string | null;
  verified_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

// ---------- Incidents ----------
export type IncidentCategory = 'breakdown' | 'safety' | 'accident' | 'security' | 'environmental' | 'other';
export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus = 'reported' | 'investigating' | 'resolved' | 'closed';

export interface Incident {
  id: string;
  organisation_id: string;
  site_id: string | null;
  asset_id: string | null;
  reported_by: string | null;
  category: IncidentCategory;
  severity: IncidentSeverity;
  status: IncidentStatus;
  description: string;
  occurred_at: string;
  resolved_at: string | null;
  linked_work_order_id: string | null;
  latitude: number | null;
  longitude: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ---------- Generic Work Orders (existing table, referenced by escalation) ----------
export type WorkOrderPriority = 'low' | 'normal' | 'high' | 'urgent';
export type WorkOrderStatus =
  | 'draft' | 'pending' | 'assigned' | 'in_progress' | 'awaiting_parts'
  | 'awaiting_approval' | 'completed' | 'cancelled' | 'disputed';

export interface WorkOrder {
  id: string;
  organisation_id: string;
  asset_id: string | null;
  site_id: string | null;
  requester_profile_id: string | null;
  assignee_profile_id: string | null;
  service_provider_id: string | null;
  category: string;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  description: string | null;
  estimated_value: number | null;
  actual_cost: number | null;
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}
__AFRIOPS_EOF_types_ts__
echo "Wrote src/lib/afriops/types.ts"

cat > src/lib/afriops/permissions.ts << '__AFRIOPS_EOF_permissions_ts__'
// Thin wrapper around the has_permission() RPC — use this everywhere instead of
// checking organisation_members.role directly, so UI gating matches RLS exactly.
import { SupabaseClient } from '@supabase/supabase-js';

export async function hasPermission(
  supabase: SupabaseClient,
  organisationId: string,
  permissionCode: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc('has_permission', {
    p_organisation_id: organisationId,
    p_permission_code: permissionCode,
  });
  if (error) {
    console.error('has_permission RPC failed', error);
    return false; // fail closed
  }
  return Boolean(data);
}

// React hook — adjust the import path for your actual supabase client singleton.
import { useEffect, useState } from 'react';

export function usePermission(
  supabase: SupabaseClient,
  organisationId: string | null | undefined,
  permissionCode: string
): { allowed: boolean; loading: boolean } {
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!organisationId) {
      setAllowed(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    hasPermission(supabase, organisationId, permissionCode).then((result) => {
      if (!cancelled) {
        setAllowed(result);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [supabase, organisationId, permissionCode]);

  return { allowed, loading };
}
__AFRIOPS_EOF_permissions_ts__
echo "Wrote src/lib/afriops/permissions.ts"

cat > src/lib/afriops/inventory.ts << '__AFRIOPS_EOF_inventory_ts__'
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
__AFRIOPS_EOF_inventory_ts__
echo "Wrote src/lib/afriops/inventory.ts"

cat > src/lib/afriops/procurement.ts << '__AFRIOPS_EOF_procurement_ts__'
import { SupabaseClient } from '@supabase/supabase-js';
import { PurchaseOrder, PurchaseOrderItem, Supplier } from './types';

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
export async function submitPurchaseOrder(supabase: SupabaseClient, purchaseOrderId: string): Promise<void> {
  const { error } = await supabase
    .from('purchase_orders')
    .update({ status: 'submitted' })
    .eq('id', purchaseOrderId)
    .eq('status', 'draft'); // guard: only submittable from draft
  if (error) throw error;
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
  return data as PurchaseOrder;
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
__AFRIOPS_EOF_procurement_ts__
echo "Wrote src/lib/afriops/procurement.ts"

cat > src/lib/afriops/documentVault.ts << '__AFRIOPS_EOF_documentVault_ts__'
import { SupabaseClient } from '@supabase/supabase-js';
import { DocumentEntityType, VaultDocument } from './types';

export async function listDocuments(
  supabase: SupabaseClient,
  organisationId: string,
  entityType?: DocumentEntityType,
  entityId?: string
): Promise<VaultDocument[]> {
  let query = supabase
    .from('document_vault')
    .select('*')
    .eq('organisation_id', organisationId)
    .order('expiry_date', { ascending: true, nullsFirst: false });
  if (entityType) query = query.eq('entity_type', entityType);
  if (entityId) query = query.eq('entity_id', entityId);

  const { data, error } = await query;
  if (error) throw error;
  return data as VaultDocument[];
}

export async function listExpiringDocuments(
  supabase: SupabaseClient,
  organisationId: string
): Promise<VaultDocument[]> {
  const { data, error } = await supabase
    .from('document_vault')
    .select('*')
    .eq('organisation_id', organisationId)
    .in('status', ['expiring_soon', 'expired'])
    .order('expiry_date', { ascending: true });
  if (error) throw error;
  return data as VaultDocument[];
}

// status is computed server-side by trigger — never include it here, it will be ignored/overwritten.
export async function uploadDocument(
  supabase: SupabaseClient,
  doc: Pick<VaultDocument, 'organisation_id' | 'entity_type' | 'entity_id' | 'doc_type' | 'storage_path'> &
    Partial<Pick<VaultDocument, 'issued_date' | 'expiry_date'>>
): Promise<VaultDocument> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('document_vault')
    .insert({ ...doc, uploaded_by: user?.id })
    .select()
    .single();
  if (error) throw error;
  return data as VaultDocument;
}

export async function verifyDocument(
  supabase: SupabaseClient,
  documentId: string,
  approved: boolean,
  rejectionReason?: string
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('document_vault')
    .update(
      approved
        ? { verified_by: user?.id, verified_at: new Date().toISOString(), rejection_reason: null }
        : { rejection_reason: rejectionReason ?? 'Rejected', verified_by: null, verified_at: null }
    )
    .eq('id', documentId);
  if (error) throw error;
}

export function statusColor(status: VaultDocument['status']): string {
  switch (status) {
    case 'valid':
      return 'green';
    case 'expiring_soon':
      return 'amber';
    case 'expired':
      return 'red';
    case 'no_expiry':
      return 'gray';
  }
}
__AFRIOPS_EOF_documentVault_ts__
echo "Wrote src/lib/afriops/documentVault.ts"

cat > src/lib/afriops/incidents.ts << '__AFRIOPS_EOF_incidents_ts__'
import { SupabaseClient } from '@supabase/supabase-js';
import { Incident, IncidentCategory, IncidentSeverity, WorkOrder, WorkOrderPriority } from './types';

export async function listIncidents(
  supabase: SupabaseClient,
  organisationId: string,
  status?: Incident['status']
): Promise<Incident[]> {
  let query = supabase
    .from('incidents')
    .select('*')
    .eq('organisation_id', organisationId)
    .order('occurred_at', { ascending: false });
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw error;
  return data as Incident[];
}

export async function reportIncident(
  supabase: SupabaseClient,
  incident: Pick<Incident, 'organisation_id' | 'category' | 'description'> &
    Partial<Pick<Incident, 'site_id' | 'asset_id' | 'severity' | 'latitude' | 'longitude' | 'occurred_at'>>
): Promise<Incident> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('incidents')
    .insert({ ...incident, reported_by: user?.id })
    .select()
    .single();
  if (error) throw error;
  return data as Incident;
}

// Escalation creates a real work order server-side and links it back — never create
// a work order manually and set linked_work_order_id yourself, the RPC's guard
// against double-escalation depends on going through this path.
export async function escalateIncidentToWorkOrder(
  supabase: SupabaseClient,
  incidentId: string,
  priority: WorkOrderPriority = 'high'
): Promise<WorkOrder> {
  const { data, error } = await supabase.rpc('escalate_incident_to_work_order', {
    p_incident_id: incidentId,
    p_priority: priority,
  });
  if (error) throw new Error(error.message);
  return data as WorkOrder;
}

export async function updateIncidentStatus(
  supabase: SupabaseClient,
  incidentId: string,
  status: Incident['status']
): Promise<void> {
  const updates: Partial<Incident> = { status };
  if (status === 'resolved' || status === 'closed') {
    updates.resolved_at = new Date().toISOString();
  }
  const { error } = await supabase.from('incidents').update(updates).eq('id', incidentId);
  if (error) throw error;
}

export function severityWeight(severity: IncidentSeverity): number {
  return { low: 0, medium: 1, high: 2, critical: 3 }[severity];
}

export const INCIDENT_CATEGORIES: IncidentCategory[] = [
  'breakdown',
  'safety',
  'accident',
  'security',
  'environmental',
  'other',
];
__AFRIOPS_EOF_incidents_ts__
echo "Wrote src/lib/afriops/incidents.ts"

echo ""
echo "All 6 files written to src/lib/afriops/"
echo ""
if command -v npx >/dev/null 2>&1 && [ -f "tsconfig.json" ]; then
  echo "Running typecheck..."
  npx tsc --noEmit --project tsconfig.json 2>&1 | grep "afriops/" || echo "No errors found in src/lib/afriops/ files."
else
  echo "Skipping typecheck (no tsconfig.json or npx found). Run npx tsc --noEmit manually to verify."
fi
