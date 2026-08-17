import Dexie, { type Table } from 'dexie';
import type { Tables, TablesUpdate } from '@/types/database.types';

// Offline-first cache + outbound sync queue.
// Jobs/photos/status updates made while offline are written here first, then
// flushed to Supabase once connectivity returns (see hooks/useSyncQueue.ts).
//
// Local-only records (jobs created while offline) get an id of the form
// "local:<uuid>" so the rest of the app can route to / reference them before
// they have a real Supabase id. Use isLocalId() to check.

export interface QueuedJob extends Partial<Tables<'jobs'>> {
  localId: string; // "local:<uuid>" — also used as the temporary job id
  vehicle_registration: string;
  workshop_id: string;
  job_type: Tables<'jobs'>['job_type'];
  synced: boolean;
  createdAt: string;
}

export interface QueuedJobPhoto {
  localId: string;
  jobId: string; // may be a localId if the job itself hasn't synced yet
  stage: 'before' | 'during' | 'after';
  dataUrl: string; // base64 data URL captured photo, uploaded on sync
  latitude: number | null;
  longitude: number | null;
  deviceInfo: string | null;
  takenAt: string;
  synced: boolean;
}

export interface QueuedStatusUpdate {
  localId: string;
  jobId: string; // real id or localId — re-pointed to the real id once the parent job syncs
  updates: TablesUpdate<'jobs'>;
  baseUpdatedAt: string | null; // server updated_at snapshot captured when queued, used for conflict detection
  createdAt: string;
  synced: boolean;
}

export interface SyncConflict {
  id: string;
  jobId: string;
  message: string;
  createdAt: string;
}

export interface QueuedRt46Evidence {
  localId: string;
  workOrderId: string;
  merchantId: string;
  stage: 'before' | 'during' | 'after';
  dataUrl: string;
  latitude: number;
  longitude: number;
  takenAt: string;
  uploadedBy: string;
  synced: boolean;
}

export interface QueuedRt46ChecklistUpdate {
  localId: string;
  itemId: string;
  isChecked: boolean;
  actorId: string;
  notes: string | null;
  createdAt: string;
  synced: boolean;
}

class AfriJobDB extends Dexie {
  jobsCache!: Table<Tables<'jobs'>, string>;
  queuedJobs!: Table<QueuedJob, string>;
  queuedPhotos!: Table<QueuedJobPhoto, string>;
  queuedStatusUpdates!: Table<QueuedStatusUpdate, string>;
  syncConflicts!: Table<SyncConflict, string>;
  queuedRt46Evidence!: Table<QueuedRt46Evidence, string>;
  queuedRt46ChecklistUpdates!: Table<QueuedRt46ChecklistUpdate, string>;

  constructor() {
    super('afrijob-offline');
    this.version(1).stores({
      jobsCache: 'id, workshop_id, status',
      queuedJobs: 'localId, workshop_id, synced',
      queuedPhotos: 'localId, jobId, synced',
    });
    this.version(2).stores({
      jobsCache: 'id, workshop_id, status',
      queuedJobs: 'localId, workshop_id, synced',
      queuedPhotos: 'localId, jobId, synced',
      queuedStatusUpdates: 'localId, jobId, synced',
      syncConflicts: 'id, jobId',
    });
    this.version(3).stores({
      jobsCache: 'id, workshop_id, status',
      queuedJobs: 'localId, workshop_id, synced',
      queuedPhotos: 'localId, jobId, synced',
      queuedStatusUpdates: 'localId, jobId, synced',
      syncConflicts: 'id, jobId',
      queuedRt46Evidence: 'localId, workOrderId, synced',
      queuedRt46ChecklistUpdates: 'localId, itemId, synced',
    });
  }
}

export const offlineDb = new AfriJobDB();

export function isLocalId(id: string | null | undefined): id is string {
  return !!id && id.startsWith('local:');
}

export function newLocalId(): string {
  return `local:${crypto.randomUUID()}`;
}
