import Dexie, { type Table } from 'dexie';
import type { Tables, TablesUpdate } from '@/types/database.types';
import type { MovementType } from '@/lib/afriops/types';

export interface QueuedJob extends Partial<Tables<'jobs'>> {
  localId: string;
  vehicle_registration: string;
  workshop_id: string;
  job_type: Tables<'jobs'>['job_type'];
  synced: boolean;
  createdAt: string;
}
export interface QueuedJobPhoto { localId: string; jobId: string; stage: 'before' | 'during' | 'after'; dataUrl: string; latitude: number | null; longitude: number | null; deviceInfo: string | null; takenAt: string; synced: boolean; }
export interface QueuedStatusUpdate { localId: string; jobId: string; updates: TablesUpdate<'jobs'>; baseUpdatedAt: string | null; createdAt: string; synced: boolean; }
export interface SyncConflict { id: string; jobId: string; message: string; createdAt: string; }
export interface QueuedRt46Evidence { localId: string; workOrderId: string; merchantId: string; stage: 'before' | 'during' | 'after'; dataUrl: string; latitude: number; longitude: number; takenAt: string; uploadedBy: string; synced: boolean; }
export interface QueuedRt46ChecklistUpdate { localId: string; itemId: string; isChecked: boolean; actorId: string; notes: string | null; createdAt: string; synced: boolean; }
export interface QueuedOpsWorkOrderUpdate { localId: string; workOrderId: string; updates: TablesUpdate<'work_orders'>; baseUpdatedAt: string | null; createdAt: string; synced: boolean; }
export interface QueuedOpsInventoryMovement {
  localId: string;
  organisationId: string;
  inventoryItemId: string;
  movementType: MovementType;
  quantity: number;
  workOrderId?: string;
  unitCost?: number;
  note?: string;
  createdAt: string;
  synced: boolean;
}
export interface QueuedOpsTripMutation {
  localId: string;
  action: 'start' | 'end';
  tripId: string;
  organisationId: string;
  assetId: string;
  driverId?: string;
  startOdometer?: number;
  endOdometer?: number;
  startLocation?: string;
  endLocation?: string;
  purpose?: string;
  status?: 'completed' | 'cancelled';
  startedAt?: string;
  endedAt?: string;
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
  queuedOpsWorkOrderUpdates!: Table<QueuedOpsWorkOrderUpdate, string>;
  queuedOpsInventoryMovements!: Table<QueuedOpsInventoryMovement, string>;
  queuedOpsTripMutations!: Table<QueuedOpsTripMutation, string>;

  constructor() {
    super('afrijob-offline');
    this.version(1).stores({ jobsCache: 'id, workshop_id, status', queuedJobs: 'localId, workshop_id, synced', queuedPhotos: 'localId, jobId, synced' });
    this.version(2).stores({ jobsCache: 'id, workshop_id, status', queuedJobs: 'localId, workshop_id, synced', queuedPhotos: 'localId, jobId, synced', queuedStatusUpdates: 'localId, jobId, synced', syncConflicts: 'id, jobId' });
    this.version(3).stores({ jobsCache: 'id, workshop_id, status', queuedJobs: 'localId, workshop_id, synced', queuedPhotos: 'localId, jobId, synced', queuedStatusUpdates: 'localId, jobId, synced', syncConflicts: 'id, jobId', queuedRt46Evidence: 'localId, workOrderId, synced', queuedRt46ChecklistUpdates: 'localId, itemId, synced' });
    this.version(4).stores({ jobsCache: 'id, workshop_id, status', queuedJobs: 'localId, workshop_id, synced', queuedPhotos: 'localId, jobId, synced', queuedStatusUpdates: 'localId, jobId, synced', syncConflicts: 'id, jobId', queuedRt46Evidence: 'localId, workOrderId, synced', queuedRt46ChecklistUpdates: 'localId, itemId, synced', queuedOpsWorkOrderUpdates: 'localId, workOrderId, synced' });
    this.version(5).stores({ jobsCache: 'id, workshop_id, status', queuedJobs: 'localId, workshop_id, synced', queuedPhotos: 'localId, jobId, synced', queuedStatusUpdates: 'localId, jobId, synced', syncConflicts: 'id, jobId', queuedRt46Evidence: 'localId, workOrderId, synced', queuedRt46ChecklistUpdates: 'localId, itemId, synced', queuedOpsWorkOrderUpdates: 'localId, workOrderId, synced', queuedOpsInventoryMovements: 'localId, inventoryItemId, synced' });
    this.version(6).stores({ jobsCache: 'id, workshop_id, status', queuedJobs: 'localId, workshop_id, synced', queuedPhotos: 'localId, jobId, synced', queuedStatusUpdates: 'localId, jobId, synced', syncConflicts: 'id, jobId', queuedRt46Evidence: 'localId, workOrderId, synced', queuedRt46ChecklistUpdates: 'localId, itemId, synced', queuedOpsWorkOrderUpdates: 'localId, workOrderId, synced', queuedOpsInventoryMovements: 'localId, inventoryItemId, synced', queuedOpsTripMutations: 'localId, tripId, assetId, synced' });
  }
}

export const offlineDb = new AfriJobDB();
export function isLocalId(id: string | null | undefined): id is string { return !!id && id.startsWith('local:'); }
export function newLocalId(): string { return `local:${crypto.randomUUID()}`; }
