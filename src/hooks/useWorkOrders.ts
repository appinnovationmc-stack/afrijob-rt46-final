import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useOrganisation } from './useOrganisation';
import type { Enums } from '@/types/database.types';

type WorkOrderStatus = Enums<'work_order_generic_status'>;
type WorkOrderCategory = Enums<'work_order_category'>;
type WorkOrderPriority = Enums<'work_order_priority'>;

// Joined shape for both the list and detail views. work_orders has two FKs
// into profiles (assignee_profile_id, requester_profile_id), so PostgREST
// needs the real constraint name to disambiguate — confirmed live against
// production (work_orders_assignee_profile_id_fkey /
// work_orders_requester_profile_id_fkey), not guessed.
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
  asset: { id: string; asset_number: string | null; registration: string | null; manufacturer: string | null; model: string | null } | null;
  site: { id: string; name: string } | null;
  assignee: { id: string; full_name: string | null } | null;
  requester: { id: string; full_name: string | null } | null;
  service_provider: { id: string; trading_name: string } | null;
}

// This is the ONLY unscoped read of public.work_orders in the app —
// everything else either reads it asset-scoped (useAssetWorkOrders) or
// reads a different table entirely (rt46.work_orders, which despite the
// same table name is a separate per-merchant schema, not this generic
// cross-source bridge). No dedicated Work Order list existed before this.
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

// Powers the Technician dashboard's "my work" queue — the current user's
// own assigned_profile_id, not the org-wide list useWorkOrders returns.
// Excludes terminal statuses so the queue only ever shows actionable work.
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

// incidents links back to a work order via linked_work_order_id (the
// reverse of the more common asset-scoped incident) — confirmed as a real
// column against live schema before writing this.
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
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: WorkOrderStatus }) => {
      const { error } = await supabase
        .from('work_orders')
        .update({
          status,
          ...(status === 'completed' ? { completed_at: new Date().toISOString() } : {}),
        })
        .eq('id', id);
      if (error) throw error;
      return { id, status };
    },
    onSuccess: ({ id }) => {
      qc.invalidateQueries({ queryKey: ['ops', 'work-orders'] });
      qc.invalidateQueries({ queryKey: ['ops', 'work-order', id] });
      // A status change is exactly the kind of thing Asset 360's Work
      // Orders tab and at-a-glance "Open work" count need to reflect too.
      qc.invalidateQueries({ queryKey: ['ops', 'asset-work-orders'] });
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

// Same source-honesty pattern already used in AssetDetail.tsx's Work Orders
// tab — 'afrijob' and 'rt46' are the workshop/RT46 flows that bridge into
// this table, 'native' means it was created directly here.
export const WORK_ORDER_SOURCE_LABELS: Record<string, string> = { afrijob: 'AfriJob', rt46: 'RT46', native: 'Ops' };

// The forward-only status progression a work order can be manually pushed
// through from this UI. Not every transition is linear in reality (e.g.
// awaiting_parts can resolve back to in_progress), so this only offers the
// single "next step" action — same UX shape as useIncidents.ts's
// NEXT_STATUS, not a full state-machine editor.
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
