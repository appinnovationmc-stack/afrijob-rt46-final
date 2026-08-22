// Types mirroring the live Supabase schema (project wtbycozfoeiepvgortvx).
// Generated from actual production tables — keep in sync if columns change.

// ---------- RBAC ----------
// Base 5 roles plus the granular, industry-oriented roles added in
// migration 20260820130000_expand_organisation_roles.sql. Note: the new
// roles' actual permission grants are seeded from the nearest existing
// role as a starting point (see that migration's seed file) — treat them
// as a starting point to be reviewed, not a finished permission model.
export type OrganisationRole =
  | 'owner'
  | 'admin'
  | 'manager'
  | 'member'
  | 'viewer'
  | 'supervisor'
  | 'technician'
  | 'inspector'
  | 'procurement_officer'
  | 'finance'
  | 'fleet_manager'
  | 'operations_manager'
  | 'contractor';

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

