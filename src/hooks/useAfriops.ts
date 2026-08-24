import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useOrganisation } from './useOrganisation';
import * as inventory from '@/lib/afriops/inventory';
import * as procurement from '@/lib/afriops/procurement';
import * as documentVault from '@/lib/afriops/documentVault';
import type { InventoryItem, MovementType, DocumentEntityType, PurchaseOrderStatus } from '@/lib/afriops/types';

// ============================================================
// Inventory
// ============================================================

export function useInventoryItems(siteId?: string) {
  const { data: org } = useOrganisation();
  return useQuery({
    queryKey: ['ops', 'inventory', org?.organisation_id, siteId],
    enabled: !!org?.organisation_id,
    queryFn: () => inventory.listInventoryItems(supabase, org!.organisation_id, siteId),
  });
}

export function useInventoryMovements(inventoryItemId: string | undefined) {
  return useQuery({
    queryKey: ['ops', 'inventory-movements', inventoryItemId],
    enabled: !!inventoryItemId,
    queryFn: () => inventory.listInventoryMovements(supabase, inventoryItemId!),
  });
}

export function useCreateInventoryItem() {
  const { data: org } = useOrganisation();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: {
      name: string;
      unit: string;
      site_id?: string;
      sku?: string;
      category?: string;
      reorder_point?: number;
      unit_cost?: number;
    }) => inventory.createInventoryItem(supabase, { ...item, organisation_id: org!.organisation_id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ops', 'inventory'] }),
  });
}

export function useRecordInventoryMovement() {
  const { data: org } = useOrganisation();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (movement: {
      inventory_item_id: string;
      movement_type: MovementType;
      quantity: number;
      work_order_id?: string;
      unit_cost?: number;
      note?: string;
    }) => inventory.recordInventoryMovement(supabase, { ...movement, organisation_id: org!.organisation_id }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['ops', 'inventory'] });
      qc.invalidateQueries({ queryKey: ['ops', 'inventory-movements', vars.inventory_item_id] });
      // A movement issued against a work order also feeds
      // work_order_parts_unified — refresh that view's read hooks too,
      // otherwise WorkOrderDetail's Parts list and Asset 360's Parts tab
      // go stale until an unrelated refetch happens.
      if (vars.work_order_id) {
        qc.invalidateQueries({ queryKey: ['work-order-parts-unified', vars.work_order_id] });
        qc.invalidateQueries({ queryKey: ['asset-parts-unified'] });
      }
    },
  });
}

export { isBelowReorderPoint } from '@/lib/afriops/inventory';

// ============================================================
// Procurement (suppliers + purchase orders)
// ============================================================

export function useSuppliers() {
  const { data: org } = useOrganisation();
  return useQuery({
    queryKey: ['ops', 'suppliers', org?.organisation_id],
    enabled: !!org?.organisation_id,
    queryFn: () => procurement.listSuppliers(supabase, org!.organisation_id),
  });
}

export function useCreateSupplier() {
  const { data: org } = useOrganisation();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (supplier: { trading_name: string; contact_email?: string; contact_phone?: string; categories?: string[] }) =>
      procurement.createSupplier(supabase, { ...supplier, organisation_id: org!.organisation_id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ops', 'suppliers'] }),
  });
}

export function usePurchaseOrders() {
  const { data: org } = useOrganisation();
  return useQuery({
    queryKey: ['ops', 'purchase-orders', org?.organisation_id],
    enabled: !!org?.organisation_id,
    queryFn: () => procurement.listPurchaseOrders(supabase, org!.organisation_id),
  });
}

export function usePurchaseOrderItems(purchaseOrderId: string | undefined) {
  return useQuery({
    queryKey: ['ops', 'purchase-order-items', purchaseOrderId],
    enabled: !!purchaseOrderId,
    queryFn: () => procurement.listPurchaseOrderItems(supabase, purchaseOrderId!),
  });
}

export function useCreatePurchaseOrder() {
  const { data: org } = useOrganisation();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      supplier_id,
      notes,
      items,
    }: {
      supplier_id: string;
      notes?: string;
      items: { description: string; quantity: number; unit_cost: number }[];
    }) => procurement.createPurchaseOrder(supabase, { organisation_id: org!.organisation_id, supplier_id, notes }, items as any),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ops', 'purchase-orders'] }),
  });
}

export function useSubmitPurchaseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (purchaseOrderId: string) => procurement.submitPurchaseOrder(supabase, purchaseOrderId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ops', 'purchase-orders'] }),
  });
}

export function useApprovePurchaseOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (purchaseOrderId: string) => procurement.approvePurchaseOrder(supabase, purchaseOrderId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ops', 'purchase-orders'] }),
  });
}

export function useReceivePurchaseOrderItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ purchaseOrderItemId, quantity }: { purchaseOrderItemId: string; quantity: number }) =>
      procurement.receivePurchaseOrderItem(supabase, purchaseOrderItemId, quantity),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ops', 'purchase-order-items'] });
      qc.invalidateQueries({ queryKey: ['ops', 'purchase-orders'] });
      qc.invalidateQueries({ queryKey: ['ops', 'inventory'] });
    },
  });
}

export const PO_STATUS_META: Record<PurchaseOrderStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' },
  submitted: { label: 'Submitted', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' },
  approved: { label: 'Approved', className: 'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-200' },
  ordered: { label: 'Ordered', className: 'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-200' },
  partially_received: { label: 'Partially Received', className: 'bg-warning/15 text-warning' },
  received: { label: 'Received', className: 'bg-success/15 text-success' },
  cancelled: { label: 'Cancelled', className: 'bg-danger/15 text-danger' },
};

// ============================================================
// Document vault
// ============================================================

export function useVaultDocuments(entityType?: DocumentEntityType, entityId?: string) {
  const { data: org } = useOrganisation();
  return useQuery({
    queryKey: ['ops', 'documents', org?.organisation_id, entityType, entityId],
    enabled: !!org?.organisation_id,
    queryFn: () => documentVault.listDocuments(supabase, org!.organisation_id, entityType, entityId),
  });
}

export function useExpiringDocuments() {
  const { data: org } = useOrganisation();
  return useQuery({
    queryKey: ['ops', 'documents-expiring', org?.organisation_id],
    enabled: !!org?.organisation_id,
    queryFn: () => documentVault.listExpiringDocuments(supabase, org!.organisation_id),
  });
}

export function useUploadDocument() {
  const { data: org } = useOrganisation();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (doc: {
      entity_type: DocumentEntityType;
      entity_id: string;
      doc_type: string;
      storage_path: string;
      issued_date?: string;
      expiry_date?: string;
    }) => documentVault.uploadDocument(supabase, { ...doc, organisation_id: org!.organisation_id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ops', 'documents'] });
      qc.invalidateQueries({ queryKey: ['ops', 'documents-expiring'] });
    },
  });
}

export function useVerifyDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ documentId, approved, rejectionReason }: { documentId: string; approved: boolean; rejectionReason?: string }) =>
      documentVault.verifyDocument(supabase, documentId, approved, rejectionReason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ops', 'documents'] });
      qc.invalidateQueries({ queryKey: ['ops', 'documents-expiring'] });
    },
  });
}

export { statusColor as documentStatusColor } from '@/lib/afriops/documentVault';

export const ENTITY_TYPE_LABELS: Record<DocumentEntityType, string> = {
  organisation: 'Organisation',
  site: 'Site',
  asset: 'Asset',
  service_provider: 'Service Provider',
  supplier: 'Supplier',
  work_order: 'Work Order',
  business_unit: 'Business Unit',
};

export type { InventoryItem };
