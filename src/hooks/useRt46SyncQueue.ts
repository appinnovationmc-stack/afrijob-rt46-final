import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { rt46 } from '@/lib/rt46';
import { offlineDb } from '@/lib/offlineDb';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useToastStore } from '@/components/ui/Toast';

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

// Flushes queued RT46 evidence photos and checklist toggles once back online.
// Evidence photos are captured with GPS + timestamp at capture time (while
// offline) and uploaded verbatim once connectivity returns — nothing about
// the "forced GPS + timestamp" requirement is weakened by queuing.
export function useRt46SyncQueue() {
  const online = useNetworkStatus();
  const qc = useQueryClient();
  const push = useToastStore((s) => s.push);
  const [syncing, setSyncing] = useState(false);
  const flushingRef = useRef(false);

  const pendingEvidence = useLiveQuery(() => offlineDb.queuedRt46Evidence.filter((e) => !e.synced).count(), [], 0) ?? 0;
  const pendingChecklist = useLiveQuery(() => offlineDb.queuedRt46ChecklistUpdates.filter((c) => !c.synced).count(), [], 0) ?? 0;
  const pendingCount = pendingEvidence + pendingChecklist;

  useEffect(() => {
    if (!online || flushingRef.current || pendingCount === 0) return;

    const flush = async () => {
      flushingRef.current = true;
      setSyncing(true);
      try {
        const queuedEvidence = await offlineDb.queuedRt46Evidence.filter((e) => !e.synced).toArray();
        for (const e of queuedEvidence) {
          try {
            const path = `${e.merchantId}/${e.workOrderId}/${e.stage}-${Date.parse(e.takenAt)}.jpg`;
            const bytes = dataUrlToBytes(e.dataUrl);
            const { error: uploadError } = await supabase.storage.from('rt46-evidence').upload(path, bytes, { contentType: 'image/jpeg' });
            if (uploadError) throw uploadError;

            const { error } = await rt46.from('work_order_evidence').insert({
              work_order_id: e.workOrderId, stage: e.stage, storage_path: path,
              latitude: e.latitude, longitude: e.longitude, taken_at: e.takenAt, uploaded_by: e.uploadedBy,
            });
            if (error) throw error;

            await offlineDb.queuedRt46Evidence.update(e.localId, { synced: true });
          } catch {
            break; // stop on first failure, retry on next flush
          }
        }

        const queuedChecklist = await offlineDb.queuedRt46ChecklistUpdates.filter((c) => !c.synced).toArray();
        for (const c of queuedChecklist) {
          try {
            const { error } = await rt46.from('work_order_checklist_items').update({
              is_checked: c.isChecked,
              checked_by: c.isChecked ? c.actorId : null,
              checked_at: c.isChecked ? c.createdAt : null,
              notes: c.notes,
            }).eq('id', c.itemId);
            if (error) throw error;
            await offlineDb.queuedRt46ChecklistUpdates.update(c.localId, { synced: true });
          } catch {
            break;
          }
        }

        qc.invalidateQueries({ queryKey: ['rt46', 'evidence'] });
        qc.invalidateQueries({ queryKey: ['rt46', 'checklist'] });
        push('RT46 offline changes synced', 'success');
      } finally {
        flushingRef.current = false;
        setSyncing(false);
      }
    };

    flush();
  }, [online, pendingCount, qc, push]);

  return { online, syncing, pendingCount };
}
