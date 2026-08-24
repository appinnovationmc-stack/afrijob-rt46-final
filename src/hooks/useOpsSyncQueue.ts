import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { offlineDb } from '@/lib/offlineDb';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useToastStore } from '@/components/ui/Toast';
import * as inventory from '@/lib/afriops/inventory';

export function useOpsSyncQueue() {
  const online = useNetworkStatus();
  const qc = useQueryClient();
  const push = useToastStore((s) => s.push);
  const [syncing, setSyncing] = useState(false);
  const flushingRef = useRef(false);
  const pendingWorkOrders = useLiveQuery(() => offlineDb.queuedOpsWorkOrderUpdates.filter((u) => !u.synced).count(), [], 0) ?? 0;
  const pendingInventory = useLiveQuery(() => offlineDb.queuedOpsInventoryMovements.filter((m) => !m.synced).count(), [], 0) ?? 0;
  const pendingCount = pendingWorkOrders + pendingInventory;

  useEffect(() => {
    if (!online || flushingRef.current || pendingCount === 0) return;
    const flush = async () => {
      flushingRef.current = true;
      setSyncing(true);
      let syncedAny = false;
      try {
        const workOrders = await offlineDb.queuedOpsWorkOrderUpdates.filter((u) => !u.synced).toArray();
        for (const upd of workOrders) {
          try {
            if (upd.baseUpdatedAt) {
              const { data: current } = await supabase.from('work_orders').select('updated_at').eq('id', upd.workOrderId).single();
              if (current && current.updated_at !== upd.baseUpdatedAt) {
                await offlineDb.syncConflicts.put({ id: crypto.randomUUID(), jobId: upd.workOrderId, message: 'This work order changed while you were offline. Your update was applied on top — review the history.', createdAt: new Date().toISOString() });
              }
            }
            const { error } = await supabase.from('work_orders').update(upd.updates).eq('id', upd.workOrderId);
            if (error) throw error;
            await offlineDb.queuedOpsWorkOrderUpdates.update(upd.localId, { synced: true });
            syncedAny = true;
          } catch { break; }
        }

        const movements = await offlineDb.queuedOpsInventoryMovements.filter((m) => !m.synced).toArray();
        for (const movement of movements) {
          try {
            await inventory.recordInventoryMovement(supabase, {
              organisation_id: movement.organisationId,
              inventory_item_id: movement.inventoryItemId,
              movement_type: movement.movementType,
              quantity: movement.quantity,
              ...(movement.workOrderId ? { work_order_id: movement.workOrderId } : {}),
              ...(movement.unitCost !== undefined ? { unit_cost: movement.unitCost } : {}),
              ...(movement.note ? { note: movement.note } : {}),
            });
            await offlineDb.queuedOpsInventoryMovements.update(movement.localId, { synced: true });
            syncedAny = true;
          } catch { break; }
        }

        qc.invalidateQueries({ queryKey: ['ops', 'work-orders'] });
        qc.invalidateQueries({ queryKey: ['ops', 'work-order'] });
        qc.invalidateQueries({ queryKey: ['ops', 'my-work-orders'] });
        qc.invalidateQueries({ queryKey: ['ops', 'inventory'] });
        qc.invalidateQueries({ queryKey: ['ops', 'inventory-movements'] });
        if (syncedAny) push('Synced offline Ops changes', 'success');
      } finally {
        flushingRef.current = false;
        setSyncing(false);
      }
    };
    void flush();
  }, [online, pendingCount, qc, push]);

  return { online, syncing, pendingCount };
}
