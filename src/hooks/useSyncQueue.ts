import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useQueryClient } from '@tanstack/react-query';
import { Network } from '@capacitor/network';
import { supabase } from '@/lib/supabase';
import { offlineDb, isLocalId } from '@/lib/offlineDb';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useToastStore } from '@/components/ui/Toast';
import type { TablesInsert } from '@/types/database.types';

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

// Flushes the offline queue in order: job creations first (so photos/updates
// referencing a local id can be re-pointed to the real id), then photos,
// then status/field updates. Stops at the first failure in each stage so
// order is preserved and the rest retry on the next flush.
export function useSyncQueue() {
  const online = useNetworkStatus();
  const qc = useQueryClient();
  const push = useToastStore((s) => s.push);
  const [syncing, setSyncing] = useState(false);
  const flushingRef = useRef(false);

  const pendingJobs = useLiveQuery(() => offlineDb.queuedJobs.filter((j) => !j.synced).count(), [], 0) ?? 0;
  const pendingPhotos = useLiveQuery(() => offlineDb.queuedPhotos.filter((p) => !p.synced).count(), [], 0) ?? 0;
  const pendingUpdates = useLiveQuery(() => offlineDb.queuedStatusUpdates.filter((u) => !u.synced).count(), [], 0) ?? 0;
  const conflictCount = useLiveQuery(() => offlineDb.syncConflicts.count(), [], 0) ?? 0;
  const pendingCount = pendingJobs + pendingPhotos + pendingUpdates;

  const flush = async () => {
    if (flushingRef.current) return;
    const status = await Network.getStatus();
    if (!status.connected) return;

    flushingRef.current = true;
    setSyncing(true);
    let pushedJobs = 0;
    let pushedPhotos = 0;
    let pushedUpdates = 0;

    try {
      // 1. Job creations
      const jobs = (await offlineDb.queuedJobs.filter((j) => !j.synced).toArray()).sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt)
      );
      for (const job of jobs) {
        const { localId, synced: _synced, createdAt: _createdAt, id: _id, ...rest } = job;
        try {
          const { data, error } = await supabase
            .from('jobs')
            .insert(rest as TablesInsert<'jobs'>)
            .select()
            .single();
          if (error) throw error;

          const relatedPhotos = await offlineDb.queuedPhotos.where('jobId').equals(localId).toArray();
          for (const p of relatedPhotos) await offlineDb.queuedPhotos.update(p.localId, { jobId: data.id });
          const relatedUpdates = await offlineDb.queuedStatusUpdates.where('jobId').equals(localId).toArray();
          for (const u of relatedUpdates) await offlineDb.queuedStatusUpdates.update(u.localId, { jobId: data.id });

          await offlineDb.queuedJobs.delete(localId);
          await offlineDb.jobsCache.put(data);
          pushedJobs++;
        } catch (e) {
          console.error('Sync: failed to push queued job, will retry later', e);
          break;
        }
      }

      // 2. Photos (only once their job has a real id)
      const photos = await offlineDb.queuedPhotos.filter((p) => !p.synced && !isLocalId(p.jobId)).toArray();
      const uploaderId = (await supabase.auth.getUser()).data.user?.id ?? '';
      for (const photo of photos) {
        try {
          const path = `${photo.jobId}/${photo.stage}-${Date.parse(photo.takenAt) || Date.now()}.jpg`;
          const { error: uploadError } = await supabase.storage
            .from('job-photos')
            .upload(path, dataUrlToBytes(photo.dataUrl), { contentType: 'image/jpeg' });
          if (uploadError) throw uploadError;

          const { error: insertError } = await supabase.from('job_photos').insert({
            job_id: photo.jobId,
            stage: photo.stage,
            storage_path: path,
            latitude: photo.latitude,
            longitude: photo.longitude,
            device_info: photo.deviceInfo,
            taken_at: photo.takenAt,
            uploaded_by: uploaderId,
          });
          if (insertError) throw insertError;

          await offlineDb.queuedPhotos.delete(photo.localId);
          pushedPhotos++;
        } catch (e) {
          console.error('Sync: failed to push queued photo, will retry later', e);
          break;
        }
      }

      // 3. Status / field updates — last write wins, flagged for manual review on conflict
      const updates = await offlineDb.queuedStatusUpdates.filter((u) => !u.synced && !isLocalId(u.jobId)).toArray();
      for (const upd of updates) {
        try {
          if (upd.baseUpdatedAt) {
            const { data: current } = await supabase.from('jobs').select('updated_at').eq('id', upd.jobId).single();
            if (current && current.updated_at !== upd.baseUpdatedAt) {
              await offlineDb.syncConflicts.put({
                id: crypto.randomUUID(),
                jobId: upd.jobId,
                message: 'This job was changed elsewhere while you were offline. Your update was applied on top — please review.',
                createdAt: new Date().toISOString(),
              });
            }
          }
          const { data, error } = await supabase.from('jobs').update(upd.updates).eq('id', upd.jobId).select().single();
          if (error) throw error;
          await offlineDb.jobsCache.put(data);
          await offlineDb.queuedStatusUpdates.delete(upd.localId);
          pushedUpdates++;
        } catch (e) {
          console.error('Sync: failed to push queued update, will retry later', e);
          break;
        }
      }

      if (pushedJobs || pushedPhotos || pushedUpdates) {
        qc.invalidateQueries({ queryKey: ['jobs'] });
        qc.invalidateQueries({ queryKey: ['job'] });
        qc.invalidateQueries({ queryKey: ['dashboard-stats'] });
        push('Synced offline changes', 'success');
      }
    } finally {
      setSyncing(false);
      flushingRef.current = false;
    }
  };

  useEffect(() => {
    if (online) flush();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  return { online, syncing, pendingCount, conflictCount, syncNow: flush };
}
