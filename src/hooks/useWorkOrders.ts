import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useOrganisation } from './useOrganisation';
import { offlineDb } from '@/lib/offlineDb';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { prioritiseWorkOrder } from '@/lib/afriops/actions';
import { notifyProfile } from '@/lib/afriops/notifications';
import type { Enums } from '@/types/database.types';

type WorkOrderStatus = Enums<'work_order_generic_status'>;
type WorkOrderCategory = Enums<'work_order_category'>;
type WorkOrderPriority = Enums<'work_order_priority'>;

const WORK_ORDER_SELECT = `
  *,
  asset:assets!work_orders_asset_id_fkey(id, asset_number, registration, manufacturer, model),
  site:sites!work_orders_site_id_fkey(id, name),
  assignee:profiles!work_orders_assignee_profile_id_fkey(id, full_name),
  requester:profiles!work_orders_requester_profile_id_fkey(id, full_name),
  service_provider:service_providers!work_orders_service_provider_id_fkey(id, trading_name)
`;

export interface WorkOrderListItem {
  id: string;
  description: string | null;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  category: WorkOrderCategory;
  source_system: string;
  actual_cost: number | null;
  estimated_value: number | null;
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
  organisation_id?: string;
  asset: { id: string; asset_number: string | null; registration: string | null; manufacturer: string | null; model: string | null } | null;
  site: { id: string; name: string } | null;
  assignee: { id: string; full_name: string | null } | null;
  requester: { id: string; full_name: string | null } | null;
  service_provider: { id: string; trading_name: string } | null;
}

export function useWorkOrders(status?: WorkOrderStatus) {
  const { data: org } = useOrganisation();
  return useQuery({
    queryKey: ['ops', 'work-orders', org?.organisation_id, status],
    enabled: !!org?.organisation_id,
    queryFn: async (): Promise<WorkOrderListItem[]> => {
      let query = supabase
        .from('work_orders')
        .select(WORK_ORDER_SELECT)
        .eq('organisation_id', org!.organisation_id)
        .order('created_at', { ascending: false });
      if (status) query = query.eq('status', status);
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as WorkOrderListItem[];
    },
  });
}

export function useWorkOrder(workOrderId: string | undefined) {
  return useQuery({
    queryKey: ['ops', 'work-order', workOrderId],
    enabled: !!workOrderId,
    queryFn: async (): Promise<WorkOrderListItem> => {
      const { data, error } = await supabase
        .from('work_orders')
        .select(WORK_ORDER_SELECT)
        .eq('id', workOrderId!)
        .single();
      if (error) throw error;
      return data as unknown as WorkOrderListItem;
    },
  });
}

export function useMyWorkOrders(profileId: string | undefined) {
  return useQuery({
    queryKey: ['ops', 'my-work-orders', profileId],
    enabled: !!profileId,
    queryFn: async (): Promise<WorkOrderListItem[]> => {
      const { data, error } = await supabase
        .from('work_orders')
        .select(WORK_ORDER_SELECT)
        .eq('assignee_profile_id', profileId!)
        .not('status', 'in', '(completed,cancelled,disputed)')
        .order('due_at', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as unknown as WorkOrderListItem[];
    },
  });
}

export interface WorkOrderSlaBreach {
  id: string;
  metric: 'response' | 'resolution';
  breached_at: string;
  minutes_over: number;
  acknowledged_at: string | null;
}

export function useWorkOrderSlaBreaches(workOrderId: string | undefined) {
  return useQuery({
    queryKey: ['ops', 'work-order-sla-breaches', workOrderId],
    enabled: !!workOrderId,
    queryFn: async (): Promise<WorkOrderSlaBreach[]> => {
      const { data, error } = await supabase
        .from('sla_breaches')
        .select('id, metric, breached_at, minutes_over, acknowledged_at')
        .eq('work_order_id', workOrderId!)
        .order('breached_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as WorkOrderSlaBreach[];
    },
  });
}

export interface WorkOrderIncident {
  id: string;
  category: string;
  severity: string;
  status: string;
  occurred_at: string;
}

export function useWorkOrderIncidents(workOrderId: string | undefined) {
  return useQuery({
    queryKey: ['ops', 'work-order-incidents', workOrderId],
    enabled: !!workOrderId,
    queryFn: async (): Promise<WorkOrderIncident[]> => {
      const { data, error } = await supabase
        .from('incidents')
        .select('id, category, severity, status, occurred_at')
        .eq('linked_work_order_id', workOrderId!)
        .order('occurred_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as WorkOrderIncident[];
    },
  });
}

export function useUpdateWorkOrderStatus() {
  const qc = useQueryClient();
  const online = useNetworkStatus();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: WorkOrderStatus }) => {
      const updates = {
        status,
        ...(status === 'completed' ? { completed_at: new Date().toISOString() } : {}),
        // Clearing completed_at when sending back for rework
        ...(status === 'in_progress' ? { completed_at: null } : {}),
      };

      if (!online) {
        const cached = qc.getQueryData<{ updated_at: string }>(['ops', 'work-order', id]);
        await offlineDb.queuedOpsWorkOrderUpdates.put({
          localId: `local:${crypto.randomUUID()}`,
          workOrderId: id,
          updates,
          baseUpdatedAt: cached?.updated_at ?? null,
          createdAt: new Date().toISOString(),
          synced: false,
        });
        return { id, status };
      }

      const { error } = await supabase.from('work_orders').update(updates).eq('id', id);
      if (error) throw error;
      return { id, status };
    },
    onSuccess: ({ id }) => {
      qc.invalidateQueries({ queryKey: ['ops', 'work-orders'] });
      qc.invalidateQueries({ queryKey: ['ops', 'work-order', id] });
      qc.invalidateQueries({ queryKey: ['ops', 'asset-work-orders'] });
    },
  });
}

export function useAssignWorkOrder() {
  const qc = useQueryClient();
  const { data: org } = useOrganisation();
  return useMutation({
    mutationFn: async ({
      id,
      assigneeProfileId,
      currentStatus,
    }: {
      id: string;
      assigneeProfileId: string | null;
      currentStatus: WorkOrderStatus;
    }) => {
      const advanceStatus = assigneeProfileId && currentStatus === 'pending';
      const { error } = await supabase
        .from('work_orders')
        .update({
          assignee_profile_id: assigneeProfileId,
          ...(advanceStatus ? { status: 'assigned' as WorkOrderStatus } : {}),
        })
        .eq('id', id);
      if (error) throw error;

      // Notify the new assignee so they know work landed in their queue.
      if (assigneeProfileId && org?.organisation_id) {
        await notifyProfile(supabase, {
          organisation_id: org.organisation_id,
          recipient_profile_id: assigneeProfileId,
          type: 'work_order_assigned',
          title: 'Work order assigned to you',
          body: 'A work order has been assigned to you. Open it from My Work or Work Orders.',
          link_entity_type: 'work_order',
          link_entity_id: id,
        });
      }

      return { id };
    },
    onSuccess: ({ id }) => {
      qc.invalidateQueries({ queryKey: ['ops', 'work-orders'] });
      qc.invalidateQueries({ queryKey: ['ops', 'work-order', id] });
      qc.invalidateQueries({ queryKey: ['ops', 'my-work-orders'] });
      qc.invalidateQueries({ queryKey: ['ops', 'asset-work-orders'] });
    },
  });
}

export function useSetWorkOrderPriority() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, priority }: { id: string; priority: WorkOrderPriority }) => {
      await prioritiseWorkOrder(supabase, id, priority);
      return { id, priority };
    },
    onSuccess: ({ id }) => {
      qc.invalidateQueries({ queryKey: ['ops', 'work-orders'] });
      qc.invalidateQueries({ queryKey: ['ops', 'work-order', id] });
    },
  });
}

export const WORK_ORDER_CATEGORY_LABELS: Record<WorkOrderCategory, string> = {
  breakdown: 'Breakdown',
  maintenance: 'Maintenance',
  inspection: 'Inspection',
  repair: 'Repair',
  service: 'Service',
  incident: 'Incident',
  other: 'Other',
};

export const WORK_ORDER_PRIORITY_META: Record<WorkOrderPriority, { label: string; className: string }> = {
  low: { label: 'Low', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' },
  normal: { label: 'Normal', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' },
  high: { label: 'High', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200' },
  urgent: { label: 'Urgent', className: 'bg-danger/15 text-danger' },
};

export const WORK_ORDER_SOURCE_LABELS: Record<string, string> = { afrijob: 'AfriOps', rt46: 'RT46', native: 'Ops' };

export const WORK_ORDER_NEXT_STATUS: Record<WorkOrderStatus, WorkOrderStatus | null> = {
  draft: 'pending',
  pending: 'assigned',
  assigned: 'in_progress',
  in_progress: 'completed',
  awaiting_parts: 'in_progress',
  awaiting_approval: 'completed',
  completed: null,
  cancelled: null,
  disputed: null,
};
