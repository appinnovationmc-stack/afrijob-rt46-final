import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLiveQuery } from 'dexie-react-hooks';
import { Network } from '@capacitor/network';
import { supabase } from '@/lib/supabase';
import { offlineDb, isLocalId, newLocalId, type QueuedJob } from '@/lib/offlineDb';
import type { Tables, TablesInsert, TablesUpdate } from '@/types/database.types';

// Jobs/photos rendered by the UI carry an extra `_pendingSync` flag when
// they're still sitting in the local offline queue and haven't reached
// Supabase yet.
export type DisplayJob = Tables<'jobs'> & { _pendingSync?: boolean };
export type DisplayPhoto = Tables<'job_photos'> & { _pendingSync?: boolean; _dataUrl?: string };

function queuedJobToDisplay(q: QueuedJob): DisplayJob {
  return {
    id: q.localId,
    workshop_id: q.workshop_id,
    created_by: q.created_by ?? '',
    vehicle_registration: q.vehicle_registration,
    vehicle_vin: q.vehicle_vin ?? null,
    vehicle_make: q.vehicle_make ?? null,
    vehicle_model: q.vehicle_model ?? null,
    vehicle_colour: q.vehicle_colour ?? null,
    odometer: q.odometer ?? null,
    job_type: q.job_type,
    description: q.description ?? null,
    priority: q.priority ?? 'normal',
    status: q.status ?? 'draft',
    assigned_to: q.assigned_to ?? null,
    internal_notes: q.internal_notes ?? null,
    customer_signature_url: q.customer_signature_url ?? null,
    labour_hours: q.labour_hours ?? null,
    pdf_report_url: q.pdf_report_url ?? null,
    submitted_at: q.submitted_at ?? null,
    paid_at: q.paid_at ?? null,
    created_at: q.createdAt,
    updated_at: q.createdAt,
    _pendingSync: true,
  };
}

export function useJobs(workshopId: string | undefined, status?: Tables<'jobs'>['status']) {
  const query = useQuery({
    queryKey: ['jobs', workshopId, status],
    enabled: !!workshopId,
    queryFn: async () => {
      let q = supabase.from('jobs').select('*').eq('workshop_id', workshopId!).order('created_at', { ascending: false });
      if (status) q = q.eq('status', status);
      const { data, error } = await q;
      if (error) throw error;
      await offlineDb.jobsCache.bulkPut(data);
      return data;
    },
  });

  const queuedJobs = useLiveQuery(
    async () => {
      if (!workshopId) return [];
      const rows = await offlineDb.queuedJobs.where('workshop_id').equals(workshopId).and((j) => !j.synced).toArray();
      return status ? rows.filter((r) => (r.status ?? 'draft') === status) : rows;
    },
    [workshopId, status],
    []
  );

  const cachedJobs = useLiveQuery(
    async () => {
      if (!workshopId || query.data) return [];
      const rows = await offlineDb.jobsCache.where('workshop_id').equals(workshopId).toArray();
      const sorted = rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
      return status ? sorted.filter((r) => r.status === status) : sorted;
    },
    [workshopId, status, !!query.data],
    []
  );

  const merged = useMemo<DisplayJob[]>(() => {
    const base: DisplayJob[] = query.data ?? cachedJobs ?? [];
    const queued = (queuedJobs ?? []).map(queuedJobToDisplay);
    return [...queued, ...base];
  }, [query.data, cachedJobs, queuedJobs]);

  return { ...query, data: merged, isLoading: query.isLoading && !(cachedJobs ?? []).length };
}

export function useJob(jobId: string | undefined) {
  const isLocal = isLocalId(jobId);

  const query = useQuery({
    queryKey: ['job', jobId],
    enabled: !!jobId && !isLocal,
    queryFn: async () => {
      const { data, error } = await supabase.from('jobs').select('*').eq('id', jobId!).single();
      if (error) throw error;
      await offlineDb.jobsCache.put(data);
      return data;
    },
  });

  const localJob = useLiveQuery(async () => (isLocal && jobId ? offlineDb.queuedJobs.get(jobId) : undefined), [jobId, isLocal]);
  const cachedJob = useLiveQuery(async () => (!isLocal && jobId ? offlineDb.jobsCache.get(jobId) : undefined), [jobId, isLocal]);

  if (isLocal) {
    return { data: localJob ? queuedJobToDisplay(localJob) : undefined, isLoading: localJob === undefined, isPendingSync: true } as const;
  }
  return { ...query, data: (query.data ?? cachedJob) as DisplayJob | undefined, isLoading: query.isLoading && !cachedJob, isPendingSync: false } as const;
}

export function useJobPhotos(jobId: string | undefined) {
  const isLocal = isLocalId(jobId);

  const query = useQuery({
    queryKey: ['job-photos', jobId],
    enabled: !!jobId && !isLocal,
    queryFn: async () => {
      const { data, error } = await supabase.from('job_photos').select('*').eq('job_id', jobId!).order('taken_at', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const queuedPhotos = useLiveQuery(
    async () => {
      if (!jobId) return [];
      return offlineDb.queuedPhotos.where('jobId').equals(jobId).and((p) => !p.synced).toArray();
    },
    [jobId],
    []
  );

  const merged = useMemo<DisplayPhoto[]>(() => {
    const queuedAsDisplay: DisplayPhoto[] = (queuedPhotos ?? []).map((p) => ({
      id: p.localId,
      job_id: p.jobId,
      stage: p.stage,
      storage_path: '',
      latitude: p.latitude,
      longitude: p.longitude,
      device_info: p.deviceInfo,
      taken_at: p.takenAt,
      uploaded_by: '',
      created_at: p.takenAt,
      _pendingSync: true,
      _dataUrl: p.dataUrl,
    }));
    return [...(query.data ?? []), ...queuedAsDisplay];
  }, [query.data, queuedPhotos]);

  return { ...query, data: merged };
}

export function useCreateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (job: TablesInsert<'jobs'>): Promise<DisplayJob> => {
      const status = await Network.getStatus();
      if (!status.connected) {
        const localId = newLocalId();
        const now = new Date().toISOString();
        const queued: QueuedJob = { ...job, localId, synced: false, createdAt: now };
        await offlineDb.queuedJobs.put(queued);
        return queuedJobToDisplay(queued);
      }
      const { data, error } = await supabase.from('jobs').insert(job).select().single();
      if (error) throw error;
      await offlineDb.jobsCache.put(data);
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['jobs', data.workshop_id] });
    },
  });
}

export function useUpdateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: TablesUpdate<'jobs'> }): Promise<DisplayJob> => {
      if (isLocalId(id)) {
        const existing = await offlineDb.queuedJobs.get(id);
        if (!existing) throw new Error('This job is still saving locally — try again in a moment.');
        const merged: QueuedJob = { ...existing, ...updates };
        await offlineDb.queuedJobs.put(merged);
        return queuedJobToDisplay(merged);
      }

      const status = await Network.getStatus();
      if (!status.connected) {
        const cached = await offlineDb.jobsCache.get(id);
        await offlineDb.queuedStatusUpdates.put({
          localId: newLocalId(),
          jobId: id,
          updates,
          baseUpdatedAt: cached?.updated_at ?? null,
          createdAt: new Date().toISOString(),
          synced: false,
        });
        const optimistic: DisplayJob | undefined = cached
          ? { ...cached, ...updates, _pendingSync: true }
          : undefined;
        if (optimistic) await offlineDb.jobsCache.put(optimistic);
        if (!optimistic) throw new Error('Update queued, but this job has no local copy to preview yet.');
        return optimistic;
      }

      const { data, error } = await supabase.from('jobs').update(updates).eq('id', id).select().single();
      if (error) throw error;
      await offlineDb.jobsCache.put(data);
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['jobs', data.workshop_id] });
      qc.invalidateQueries({ queryKey: ['job', data.id] });
    },
  });
}

export function useDashboardStats(workshopId: string | undefined) {
  return useQuery({
    queryKey: ['dashboard-stats', workshopId],
    enabled: !!workshopId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('status, created_at')
        .eq('workshop_id', workshopId!);
      if (error) throw error;

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const open = data.filter((j) => !['paid', 'submitted'].includes(j.status)).length;
      const completedThisMonth = data.filter(
        (j) => j.status === 'paid' && new Date(j.created_at) >= monthStart
      ).length;
      const pendingPayment = data.filter((j) => j.status === 'submitted').length;

      return { open, completedThisMonth, pendingPayment, total: data.length };
    },
  });
}
