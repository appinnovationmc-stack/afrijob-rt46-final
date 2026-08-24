import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import * as inventory from '@/lib/afriops/inventory';
import { offlineDb } from '@/lib/offlineDb';
import { useNetworkStatus } from './useNetworkStatus';
import { useOrganisation } from './useOrganisation';
import type { MovementType } from '@/lib/afriops/types';

export function useOfflineInventoryMovement() {
  const online = useNetworkStatus();
  const { data: org } = useOrganisation();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (movement: { inventory_item_id: string; movement_type: MovementType; quantity: number; work_order_id?: string; unit_cost?: number; note?: string }) => {
      if (!org?.organisation_id) throw new Error('Organisation not loaded');
      if (movement.quantity <= 0) throw new Error('Movement quantity must be positive');
      if (online) return inventory.recordInventoryMovement(supabase, { ...movement, organisation_id: org.organisation_id });
      await offlineDb.queuedOpsInventoryMovements.put({
        localId: `local:${crypto.randomUUID()}`,
        organisationId: org.organisation_id,
        inventoryItemId: movement.inventory_item_id,
        movementType: movement.movement_type,
        quantity: movement.quantity,
        workOrderId: movement.work_order_id,
        unitCost: movement.unit_cost,
        note: movement.note,
        createdAt: new Date().toISOString(),
        synced: false,
      });
      return null;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['ops', 'inventory'] });
      qc.invalidateQueries({ queryKey: ['ops', 'inventory-movements', vars.inventory_item_id] });
    },
  });
}
