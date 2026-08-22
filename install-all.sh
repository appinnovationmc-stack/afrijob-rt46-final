#!/usr/bin/env bash
set -euo pipefail

# Installs all nine AfriOps backend service-layer modules into src/lib/afriops/.
# Safe to re-run — overwrites each file with the current version.
# Run from the ROOT of your afrijob-rt46-final repo.

if [ ! -f "package.json" ]; then
  echo "Error: no package.json found here. cd into your repo root first, then re-run."
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

cat > src/lib/afriops/preventiveMaintenance.ts << '__AFRIOPS_EOF_preventiveMaintenance_ts__'
import { SupabaseClient } from '@supabase/supabase-js';
import { WorkOrder, WorkOrderPriority } from './types';

// ---------- Types ----------
// Mirrors maintenance_schedules / maintenance_schedule_runs tables
// (project wtbycozfoeiepvgortvx). Keep in sync if columns change.

export type MaintenanceTriggerType = 'interval_days' | 'interval_hours' | 'interval_km' | 'fixed_date';

export interface MaintenanceSchedule {
  id: string;
  organisation_id: string;
  asset_id: string;
  name: string;
  description: string | null;
  trigger_type: MaintenanceTriggerType;
  interval_value: number | null; // days / hours / km depending on trigger_type
  fixed_date: string | null; // used only when trigger_type = 'fixed_date'
  last_run_at: string | null;
  last_run_meter_reading: number | null;
  next_due_at: string | null; // computed server-side by trigger, never write this field
  next_due_meter_reading: number | null; // computed server-side, never write this field
  default_priority: WorkOrderPriority;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type ScheduleRunStatus = 'due' | 'work_order_created' | 'skipped';

export interface MaintenanceScheduleRun {
  id: string;
  organisation_id: string;
  schedule_id: string;
  work_order_id: string | null;
  status: ScheduleRunStatus;
  due_at: string;
  triggered_at: string | null;
  created_at: string;
}

// ---------- Schedules ----------

export async function listMaintenanceSchedules(
  supabase: SupabaseClient,
  organisationId: string,
  assetId?: string
): Promise<MaintenanceSchedule[]> {
  let query = supabase
    .from('maintenance_schedules')
    .select('*')
    .eq('organisation_id', organisationId)
    .order('next_due_at', { ascending: true, nullsFirst: false });
  if (assetId) query = query.eq('asset_id', assetId);

  const { data, error } = await query;
  if (error) throw error;
  return data as MaintenanceSchedule[];
}

export async function listDueSchedules(
  supabase: SupabaseClient,
  organisationId: string,
  withinDays = 7
): Promise<MaintenanceSchedule[]> {
  const cutoff = new Date(Date.now() + withinDays * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('maintenance_schedules')
    .select('*')
    .eq('organisation_id', organisationId)
    .eq('active', true)
    .lte('next_due_at', cutoff)
    .order('next_due_at', { ascending: true });
  if (error) throw error;
  return data as MaintenanceSchedule[];
}

// next_due_at / next_due_meter_reading are computed server-side by trigger from
// trigger_type + interval_value — never set them on insert.
export async function createMaintenanceSchedule(
  supabase: SupabaseClient,
  schedule: Pick<MaintenanceSchedule, 'organisation_id' | 'asset_id' | 'name' | 'trigger_type'> &
    Partial<
      Pick<
        MaintenanceSchedule,
        'description' | 'interval_value' | 'fixed_date' | 'default_priority' | 'active'
      >
    >
): Promise<MaintenanceSchedule> {
  const { data, error } = await supabase
    .from('maintenance_schedules')
    .insert(schedule)
    .select()
    .single();
  if (error) throw error;
  return data as MaintenanceSchedule;
}

export async function setMaintenanceScheduleActive(
  supabase: SupabaseClient,
  scheduleId: string,
  active: boolean
): Promise<void> {
  const { error } = await supabase
    .from('maintenance_schedules')
    .update({ active })
    .eq('id', scheduleId);
  if (error) throw error;
}

// ---------- Triggering work orders from schedules ----------

// Runs the due-schedule sweep server-side: for every active schedule whose
// next_due_at has passed, creates a work order, links it via a schedule_run row,
// and rolls next_due_at forward. Idempotent — safe to call repeatedly (e.g. from
// a daily cron / edge function), since a schedule already covered by an open
// work order won't be re-triggered.
export async function runDueMaintenanceSchedules(
  supabase: SupabaseClient,
  organisationId: string
): Promise<MaintenanceScheduleRun[]> {
  const { data, error } = await supabase.rpc('run_due_maintenance_schedules', {
    p_organisation_id: organisationId,
  });
  if (error) throw new Error(error.message);
  return data as MaintenanceScheduleRun[];
}

// Manually trigger a single schedule now, regardless of due date (e.g. "log this
// service early"). Still goes through the RPC so next_due_at rolls forward
// correctly instead of drifting.
export async function triggerMaintenanceScheduleNow(
  supabase: SupabaseClient,
  scheduleId: string,
  priority?: WorkOrderPriority
): Promise<WorkOrder> {
  const { data, error } = await supabase.rpc('trigger_maintenance_schedule', {
    p_schedule_id: scheduleId,
    p_priority: priority ?? null,
  });
  if (error) throw new Error(error.message);
  return data as WorkOrder;
}

export async function listScheduleRuns(
  supabase: SupabaseClient,
  scheduleId: string
): Promise<MaintenanceScheduleRun[]> {
  const { data, error } = await supabase
    .from('maintenance_schedule_runs')
    .select('*')
    .eq('schedule_id', scheduleId)
    .order('due_at', { ascending: false });
  if (error) throw error;
  return data as MaintenanceScheduleRun[];
}

// ---------- Helpers ----------

export function isOverdue(schedule: MaintenanceSchedule): boolean {
  if (!schedule.next_due_at) return false;
  return new Date(schedule.next_due_at).getTime() < Date.now();
}

export function daysUntilDue(schedule: MaintenanceSchedule): number | null {
  if (!schedule.next_due_at) return null;
  const diffMs = new Date(schedule.next_due_at).getTime() - Date.now();
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

export const TRIGGER_TYPE_LABELS: Record<MaintenanceTriggerType, string> = {
  interval_days: 'Every N days',
  interval_hours: 'Every N engine hours',
  interval_km: 'Every N km',
  fixed_date: 'Fixed date',
};

__AFRIOPS_EOF_preventiveMaintenance_ts__
echo "Wrote src/lib/afriops/preventiveMaintenance.ts"

cat > src/lib/afriops/notifications.ts << '__AFRIOPS_EOF_notifications_ts__'
import { SupabaseClient } from '@supabase/supabase-js';

// ---------- Types ----------
// Mirrors notifications / notification_preferences tables
// (project wtbycozfoeiepvgortvx). Keep in sync if columns change.

// Includes the org-model types this module writes, plus the legacy
// RT46/workshop values still present in the notification_type enum (that
// system may still insert those directly) — keep both so reads stay honestly
// typed even for rows this module didn't create.
export type NotificationType =
  | 'work_order_assigned'
  | 'work_order_status_changed'
  | 'purchase_order_approval_needed'
  | 'purchase_order_approved'
  | 'document_expiring'
  | 'document_expired'
  | 'incident_reported'
  | 'incident_escalated'
  | 'maintenance_due'
  | 'low_stock'
  | 'generic'
  | 'compliance_expiry'
  | 'job_status_change'
  | 'payment'
  | 'system'
  | 'insurance_alert'
  | 'merchant_suspended'
  | 'merchant_reactivated';

export type NotificationChannel = 'in_app' | 'email' | 'sms' | 'push';

export interface Notification {
  id: string;
  organisation_id: string;
  recipient_profile_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link_entity_type: string | null; // e.g. 'work_order', 'purchase_order', 'incident'
  link_entity_id: string | null;
  read_at: string | null;
  created_at: string;
}

export interface NotificationPreference {
  profile_id: string;
  notification_type: NotificationType;
  channel: NotificationChannel;
  enabled: boolean;
}

// ---------- Reading ----------

export async function listNotifications(
  supabase: SupabaseClient,
  profileId: string,
  opts?: { unreadOnly?: boolean; limit?: number }
): Promise<Notification[]> {
  let query = supabase
    .from('notifications')
    .select('*')
    .eq('recipient_profile_id', profileId)
    .order('created_at', { ascending: false });

  if (opts?.unreadOnly) query = query.is('read_at', null);
  if (opts?.limit) query = query.limit(opts.limit);

  const { data, error } = await query;
  if (error) throw error;
  return data as Notification[];
}

export async function unreadCount(supabase: SupabaseClient, profileId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_profile_id', profileId)
    .is('read_at', null);
  if (error) throw error;
  return count ?? 0;
}

// ---------- Writing ----------

// Direct insert is fine for in-app notifications (RLS allows a user to notify
// others within their own organisation). For anything that should also fan out
// to email/SMS/push, use notifyViaRpc instead so the edge function can dispatch
// through the right channels based on notification_preferences.
export async function createInAppNotification(
  supabase: SupabaseClient,
  notification: Pick<Notification, 'organisation_id' | 'recipient_profile_id' | 'type' | 'title'> &
    Partial<Pick<Notification, 'body' | 'link_entity_type' | 'link_entity_id'>>
): Promise<Notification> {
  const { data, error } = await supabase.from('notifications').insert(notification).select().single();
  if (error) throw error;
  return data as Notification;
}

// Routes through the notify RPC, which fans out across every enabled channel
// in notification_preferences for the recipient (in-app row + email/SMS/push
// dispatch), instead of only writing the in-app row.
export async function notifyViaRpc(
  supabase: SupabaseClient,
  params: {
    organisation_id: string;
    recipient_profile_id: string;
    type: NotificationType;
    title: string;
    body?: string;
    link_entity_type?: string;
    link_entity_id?: string;
  }
): Promise<Notification> {
  const { data, error } = await supabase.rpc('notify', {
    p_organisation_id: params.organisation_id,
    p_recipient_profile_id: params.recipient_profile_id,
    p_type: params.type,
    p_title: params.title,
    p_body: params.body ?? null,
    p_link_entity_type: params.link_entity_type ?? null,
    p_link_entity_id: params.link_entity_id ?? null,
  });
  if (error) throw new Error(error.message);
  return data as Notification;
}

export async function markAsRead(supabase: SupabaseClient, notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .is('read_at', null); // guard: avoid clobbering an existing read timestamp
  if (error) throw error;
}

export async function markAllAsRead(supabase: SupabaseClient, profileId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_profile_id', profileId)
    .is('read_at', null);
  if (error) throw error;
}

// ---------- Preferences ----------

export async function listNotificationPreferences(
  supabase: SupabaseClient,
  profileId: string
): Promise<NotificationPreference[]> {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('profile_id', profileId);
  if (error) throw error;
  return data as NotificationPreference[];
}

export async function setNotificationPreference(
  supabase: SupabaseClient,
  profileId: string,
  notificationType: NotificationType,
  channel: NotificationChannel,
  enabled: boolean
): Promise<void> {
  const { error } = await supabase.from('notification_preferences').upsert(
    {
      profile_id: profileId,
      notification_type: notificationType,
      channel,
      enabled,
    },
    { onConflict: 'profile_id,notification_type,channel' }
  );
  if (error) throw error;
}

// ---------- Realtime ----------

// Subscribes to new notifications for a profile. Caller owns the returned
// channel's lifecycle — call supabase.removeChannel(channel) on unmount.
export function subscribeToNotifications(
  supabase: SupabaseClient,
  profileId: string,
  onInsert: (notification: Notification) => void
) {
  const channel = supabase
    .channel(`notifications:${profileId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `recipient_profile_id=eq.${profileId}`,
      },
      (payload) => onInsert(payload.new as Notification)
    )
    .subscribe();

  return channel;
}

// ---------- Helpers ----------

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  work_order_assigned: 'Work order assigned',
  work_order_status_changed: 'Work order status changed',
  purchase_order_approval_needed: 'Purchase order needs approval',
  purchase_order_approved: 'Purchase order approved',
  document_expiring: 'Document expiring soon',
  document_expired: 'Document expired',
  incident_reported: 'Incident reported',
  incident_escalated: 'Incident escalated',
  maintenance_due: 'Maintenance due',
  low_stock: 'Low stock',
  generic: 'Notification',
  compliance_expiry: 'Compliance document expiring',
  job_status_change: 'Job status changed',
  payment: 'Payment',
  system: 'System notification',
  insurance_alert: 'Insurance alert',
  merchant_suspended: 'Merchant suspended',
  merchant_reactivated: 'Merchant reactivated',
};

__AFRIOPS_EOF_notifications_ts__
echo "Wrote src/lib/afriops/notifications.ts"

cat > src/lib/afriops/slaEngine.ts << '__AFRIOPS_EOF_slaEngine_ts__'
import { SupabaseClient } from '@supabase/supabase-js';
import { WorkOrderPriority } from './types';

// ---------- Types ----------
// Mirrors sla_policies / sla_targets / sla_breaches tables
// (project wtbycozfoeiepvgortvx). Keep in sync if columns change.
//
// Model: an SLA policy is scoped to an organisation (optionally narrowed by
// business_unit/site/category). Each policy has per-priority targets for
// response time and resolution time. A work order is matched to the most
// specific applicable policy at creation time, and its computed deadlines are
// stored on sla_targets — never recomputed ad hoc in the UI.

export type SlaMetric = 'response' | 'resolution';
export type SlaBreachStatus = 'on_track' | 'at_risk' | 'breached' | 'met';

export interface SlaPolicy {
  id: string;
  organisation_id: string;
  business_unit_id: string | null; // null = applies org-wide
  site_id: string | null; // null = applies to all sites in scope
  category: string | null; // null = applies to all work order categories
  name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SlaPolicyTarget {
  id: string;
  policy_id: string;
  priority: WorkOrderPriority;
  response_minutes: number; // time to first assignment/acknowledgement
  resolution_minutes: number; // time to completed status
}

export interface SlaTarget {
  id: string;
  organisation_id: string;
  work_order_id: string;
  policy_id: string;
  priority: WorkOrderPriority;
  response_due_at: string;
  resolution_due_at: string;
  responded_at: string | null;
  resolved_at: string | null;
  response_status: SlaBreachStatus; // computed server-side, never write this field
  resolution_status: SlaBreachStatus; // computed server-side, never write this field
  created_at: string;
  updated_at: string;
}

export interface SlaBreach {
  id: string;
  organisation_id: string;
  work_order_id: string;
  sla_target_id: string;
  metric: SlaMetric;
  breached_at: string;
  minutes_over: number;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  created_at: string;
}

// ---------- Policies ----------

export async function listSlaPolicies(
  supabase: SupabaseClient,
  organisationId: string
): Promise<SlaPolicy[]> {
  const { data, error } = await supabase
    .from('sla_policies')
    .select('*')
    .eq('organisation_id', organisationId)
    .order('name');
  if (error) throw error;
  return data as SlaPolicy[];
}

export async function createSlaPolicy(
  supabase: SupabaseClient,
  policy: Pick<SlaPolicy, 'organisation_id' | 'name'> &
    Partial<Pick<SlaPolicy, 'business_unit_id' | 'site_id' | 'category' | 'active'>>,
  targets: Pick<SlaPolicyTarget, 'priority' | 'response_minutes' | 'resolution_minutes'>[]
): Promise<SlaPolicy> {
  const { data: createdPolicy, error: policyError } = await supabase
    .from('sla_policies')
    .insert(policy)
    .select()
    .single();
  if (policyError) throw policyError;

  if (targets.length > 0) {
    const { error: targetsError } = await supabase
      .from('sla_policy_targets')
      .insert(targets.map((t) => ({ ...t, policy_id: createdPolicy.id })));
    if (targetsError) throw targetsError;
  }

  return createdPolicy as SlaPolicy;
}

export async function listSlaPolicyTargets(
  supabase: SupabaseClient,
  policyId: string
): Promise<SlaPolicyTarget[]> {
  const { data, error } = await supabase
    .from('sla_policy_targets')
    .select('*')
    .eq('policy_id', policyId)
    .order('priority');
  if (error) throw error;
  return data as SlaPolicyTarget[];
}

export async function setSlaPolicyActive(
  supabase: SupabaseClient,
  policyId: string,
  active: boolean
): Promise<void> {
  const { error } = await supabase.from('sla_policies').update({ active }).eq('id', policyId);
  if (error) throw error;
}

// ---------- Work order SLA tracking ----------

// Matches the work order against the most specific applicable policy
// (category+site > site > business_unit > org-wide) and creates its
// sla_targets row with computed deadlines. Call this right after a work
// order is created — never hand-roll the policy matching logic client-side,
// the precedence rules live in the RPC so they stay consistent everywhere.
export async function attachSlaToWorkOrder(
  supabase: SupabaseClient,
  workOrderId: string
): Promise<SlaTarget | null> {
  const { data, error } = await supabase.rpc('attach_sla_to_work_order', {
    p_work_order_id: workOrderId,
  });
  if (error) throw new Error(error.message);
  return (data as SlaTarget) ?? null; // null if no applicable policy exists
}

export async function getSlaTargetForWorkOrder(
  supabase: SupabaseClient,
  workOrderId: string
): Promise<SlaTarget | null> {
  const { data, error } = await supabase
    .from('sla_targets')
    .select('*')
    .eq('work_order_id', workOrderId)
    .maybeSingle();
  if (error) throw error;
  return data as SlaTarget | null;
}

// Marks the response milestone (first assignment/acknowledgement). Recomputes
// response_status server-side against response_due_at — do not set
// response_status directly from the client.
export async function recordSlaResponse(supabase: SupabaseClient, workOrderId: string): Promise<SlaTarget> {
  const { data, error } = await supabase.rpc('record_sla_response', {
    p_work_order_id: workOrderId,
  });
  if (error) throw new Error(error.message);
  return data as SlaTarget;
}

// Marks the resolution milestone (work order completed). Recomputes
// resolution_status server-side against resolution_due_at.
export async function recordSlaResolution(supabase: SupabaseClient, workOrderId: string): Promise<SlaTarget> {
  const { data, error } = await supabase.rpc('record_sla_resolution', {
    p_work_order_id: workOrderId,
  });
  if (error) throw new Error(error.message);
  return data as SlaTarget;
}

// ---------- Breach monitoring ----------

export async function listOpenBreaches(
  supabase: SupabaseClient,
  organisationId: string
): Promise<SlaBreach[]> {
  const { data, error } = await supabase
    .from('sla_breaches')
    .select('*')
    .eq('organisation_id', organisationId)
    .is('acknowledged_at', null)
    .order('breached_at', { ascending: false });
  if (error) throw error;
  return data as SlaBreach[];
}

export async function acknowledgeBreach(supabase: SupabaseClient, breachId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('sla_breaches')
    .update({ acknowledged_by: user?.id, acknowledged_at: new Date().toISOString() })
    .eq('id', breachId)
    .is('acknowledged_at', null); // guard: avoid clobbering an existing ack
  if (error) throw error;
}

// Sweeps all open work orders for this organisation, flags any past-due
// targets as breached (writing sla_breaches rows + firing notifications via
// notifyViaRpc under the hood), and flags near-due targets as at_risk. Call
// this from a scheduled edge function / cron — safe to call repeatedly,
// won't double-insert a breach row for a target already breached.
export async function runSlaBreachSweep(
  supabase: SupabaseClient,
  organisationId: string
): Promise<SlaBreach[]> {
  const { data, error } = await supabase.rpc('run_sla_breach_sweep', {
    p_organisation_id: organisationId,
  });
  if (error) throw new Error(error.message);
  return data as SlaBreach[];
}

// ---------- Helpers ----------

export function minutesRemaining(dueAt: string): number {
  return Math.round((new Date(dueAt).getTime() - Date.now()) / 60000);
}

export function isAtRisk(dueAt: string, thresholdMinutes = 60): boolean {
  const remaining = minutesRemaining(dueAt);
  return remaining > 0 && remaining <= thresholdMinutes;
}

export function isPastDue(dueAt: string): boolean {
  return minutesRemaining(dueAt) < 0;
}

export const SLA_STATUS_COLOR: Record<SlaBreachStatus, string> = {
  on_track: 'green',
  at_risk: 'amber',
  breached: 'red',
  met: 'gray',
};

// Priority precedence used purely for client-side sorting/display — the
// authoritative response/resolution minutes per priority live in
// sla_policy_targets, not here.
export const PRIORITY_WEIGHT: Record<WorkOrderPriority, number> = {
  low: 0,
  normal: 1,
  high: 2,
  urgent: 3,
};

__AFRIOPS_EOF_slaEngine_ts__
echo "Wrote src/lib/afriops/slaEngine.ts"

echo ""
echo "All 9 files written to src/lib/afriops/"
echo ""
if command -v npx >/dev/null 2>&1 && [ -f "tsconfig.json" ]; then
  echo "Running typecheck..."
  npx tsc --noEmit --project tsconfig.json 2>&1 | grep "afriops/" || echo "No errors found in src/lib/afriops/ files."
else
  echo "Skipping typecheck (no tsconfig.json or npx found)."
fi
