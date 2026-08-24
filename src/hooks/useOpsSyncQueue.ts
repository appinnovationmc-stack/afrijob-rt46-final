import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { offlineDb } from '@/lib/offlineDb';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useToastStore } from '@/components/ui/Toast';

// Generic-AfriOps equivalent of useSyncQueue's jobs status-update flushing.
// The implementation matrix flagged "Ops modules have none" — this is the
// first one, scoped to work order status/field updates only (the queue
// this codebase actually has proven infrastructure for). Not extending to
// inspections/checklists/signatures here: those need their own schema
// (none exists yet for generic AfriOps — RT46's checklist tables are
// RT46-specific, not reusable) rather than a queue built ahead of the
// data model that would receive it.
export function useOpsSyncQueue() {
  const online = useNetworkStatus();
  const qc = useQueryClient();
  const push = useToastStore((s) => s.push);
  const [syncing, setSyncing] = useState(false);
  const flushingRef = useRef(false);

  const pendingCount = useLiveQuery(() => offlineDb.queuedOpsWorkOrderUpdates.filter((u) => !u.synced).count(), [], 0) ?? 0;

  useEffect(() => {
    if (!online || flushingRef.current || pendingCount === 0) return;

    const flush = async () => {
      flushingRef.current = true;
      setSyncing(true);
      try {
        const updates = await offlineDb.queuedOpsWorkOrderUpdates.filter((u) => !u.synced).toArray();
        for (const upd of updates) {
          try {
            // Same last-write-wins-but-flag-it conflict detection as the
            // jobs queue: if the server's updated_at moved since this
            // update was queued, still apply it (don't silently drop the
            // technician's work) but surface that it landed on top of a
            // change made elsewhere.
            if (upd.baseUpdatedAt) {
              const { data: current } = await supabase.from('work_orders').select('updated_at').eq('id', upd.workOrderId).single();
              if (current && current.updated_at !== upd.baseUpdatedAt) {
                await offlineDb.syncConflicts.put({
                  id: crypto.randomUUID(),
                  jobId: upd.workOrderId,
                  message: 'This work order was changed elsewhere while you were offline. Your update was applied on top — please review.',
                  createdAt: new Date().toISOString(),
                });
              }
            }
            const { error } = await supabase.from('work_orders').update(upd.updates).eq('id', upd.workOrderId);
            if (error) throw error;
            await offlineDb.queuedOpsWorkOrderUpdates.update(upd.localId, { synced: true });
          } catch {
            break; // stop on first failure, order preserved, retry on next flush
          }
        }

        qc.invalidateQueries({ queryKey: ['ops', 'work-orders'] });
        qc.invalidateQueries({ queryKey: ['ops', 'work-order'] });
        qc.invalidateQueries({ queryKey: ['ops', 'my-work-orders'] });
        push('Synced offline work order changes', 'success');
      } finally {
        flushingRef.current = false;
        setSyncing(false);
      }
    };

    flush();
  }, [online, pendingCount, qc, push]);

  return { online, syncing, pendingCount };
}
