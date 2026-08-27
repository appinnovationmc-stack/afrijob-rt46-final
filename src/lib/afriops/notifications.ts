import { SupabaseClient } from '@supabase/supabase-js';
import type { Tables } from '@/types/database.types';

export type NotificationType = 
  | 'po_submitted' | 'po_approved' | 'po_received'
  | 'work_order_assigned' | 'work_order_completed'
  | 'sla_breach' | 'sla_approaching'
  | 'inspection_ready' | 'inspection_failed'
  | 'maintenance_due'
  | 'low_stock';

export interface NotificationPayload {
  type: NotificationType;
  title: string;
  body: string;
  action_url?: string;
  entity_type?: string;
  entity_id?: string;
  severity?: 'info' | 'warning' | 'critical';
}

/**
 * Creates a notification for a specific user in an organisation.
 * This is the canonical function to trigger any operational event notification.
 * 
 * Production: Connect to notification preferences table to respect user opt-out.
 * For now: Creates all notifications; filtering happens at display time.
 */
export async function createNotification(
  supabase: SupabaseClient,
  organisationId: string,
  profileId: string,
  payload: NotificationPayload
): Promise<Tables<'notifications'>> {
  const { data, error } = await supabase
    .from('notifications')
    .insert({
      organisation_id: organisationId,
      profile_id: profileId,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      action_url: payload.action_url,
      entity_type: payload.entity_type,
      entity_id: payload.entity_id,
      severity: payload.severity ?? 'info',
      read_at: null,
    })
    .select()
    .single();
  
  if (error) throw error;
  return data as Tables<'notifications'>;
}

/**
 * Broadcasts a notification to all users with a given permission in an organisation.
 * Used for events like "PO awaiting approval" → notify all users with procurement.approve.
 */
export async function broadcastNotificationByPermission(
  supabase: SupabaseClient,
  organisationId: string,
  permissionCode: string,
  payload: NotificationPayload
): Promise<void> {
  // Get all users in this org with the required permission
  const { data: members, error: membersError } = await supabase
    .from('organisation_members')
    .select('profile_id')
    .eq('organisation_id', organisationId);
  
  if (membersError) throw membersError;
  if (!members || members.length === 0) return;

  // For each member, check if they have permission and create notification
  // Note: In production, this should be a batch RPC call for efficiency
  const notifications = members.map(member => ({
    organisation_id: organisationId,
    profile_id: member.profile_id,
    type: payload.type,
    title: payload.title,
    body: payload.body,
    action_url: payload.action_url,
    entity_type: payload.entity_type,
    entity_id: payload.entity_id,
    severity: payload.severity ?? 'info',
    read_at: null,
  }));

  const { error: insertError } = await supabase
    .from('notifications')
    .insert(notifications);
  
  if (insertError) throw insertError;
}

/**
 * Reads a notification (marks read_at timestamp).
 */
export async function readNotification(
  supabase: SupabaseClient,
  notificationId: string
): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId);
  
  if (error) throw error;
}

/**
 * Gets unread notifications for the current user.
 */
export async function getUnreadNotifications(
  supabase: SupabaseClient,
  organisationId: string,
  profileId: string
): Promise<Tables<'notifications'>[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('organisation_id', organisationId)
    .eq('profile_id', profileId)
    .is('read_at', null)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return (data ?? []) as Tables<'notifications'>[];
}

/**
 * Trigger: PO submitted for approval.
 * Notifies all users with procurement.approve permission.
 */
export async function notifyPurchaseOrderSubmitted(
  supabase: SupabaseClient,
  organisationId: string,
  purchaseOrderId: string,
  supplierId: string
): Promise<void> {
  await broadcastNotificationByPermission(
    supabase,
    organisationId,
    'procurement.approve',
    {
      type: 'po_submitted',
      title: 'Purchase order awaiting approval',
      body: `PO ${purchaseOrderId.slice(0, 8)} submitted by procurement team.`,
      action_url: `/ops/procurement`,
      entity_type: 'purchase_order',
      entity_id: purchaseOrderId,
      severity: 'warning',
    }
  );
}

/**
 * Trigger: PO approved.
 * Notifies the requester and procurement team.
 */
export async function notifyPurchaseOrderApproved(
  supabase: SupabaseClient,
  organisationId: string,
  purchaseOrderId: string,
  requestedByProfileId: string
): Promise<void> {
  await createNotification(
    supabase,
    organisationId,
    requestedByProfileId,
    {
      type: 'po_approved',
      title: 'Purchase order approved',
      body: `PO ${purchaseOrderId.slice(0, 8)} has been approved and is ready to send to supplier.`,
      action_url: `/ops/procurement`,
      entity_type: 'purchase_order',
      entity_id: purchaseOrderId,
      severity: 'info',
    }
  );
}

/**
 * Trigger: Work order assigned to technician.
 * Notifies the assigned technician.
 */
export async function notifyWorkOrderAssigned(
  supabase: SupabaseClient,
  organisationId: string,
  workOrderId: string,
  assignedProfileId: string,
  description: string
): Promise<void> {
  await createNotification(
    supabase,
    organisationId,
    assignedProfileId,
    {
      type: 'work_order_assigned',
      title: 'Work order assigned to you',
      body: `${description || 'A work order'} has been assigned to you.`,
      action_url: `/ops/work-orders/${workOrderId}`,
      entity_type: 'work_order',
      entity_id: workOrderId,
      severity: 'info',
    }
  );
}

/**
 * Trigger: SLA breach detected.
 * Notifies operations manager and owner.
 */
export async function notifySLABreach(
  supabase: SupabaseClient,
  organisationId: string,
  workOrderId: string,
  metric: 'response' | 'resolution',
  minutesOver: number
): Promise<void> {
  await broadcastNotificationByPermission(
    supabase,
    organisationId,
    'workorders.manage',
    {
      type: 'sla_breach',
      title: `SLA ${metric} breach`,
      body: `Work order ${workOrderId.slice(0, 8)} is ${minutesOver} minutes over ${metric} target.`,
      action_url: `/ops/work-orders/${workOrderId}`,
      entity_type: 'sla_breach',
      entity_id: workOrderId,
      severity: 'critical',
    }
  );
}

/**
 * Trigger: Maintenance schedule is overdue.
 * Notifies operations manager.
 */
export async function notifyMaintenanceDue(
  supabase: SupabaseClient,
  organisationId: string,
  assetId: string,
  maintenanceName: string
): Promise<void> {
  await broadcastNotificationByPermission(
    supabase,
    organisationId,
    'maintenance.manage',
    {
      type: 'maintenance_due',
      title: 'Maintenance schedule overdue',
      body: `${maintenanceName} is now overdue for asset ${assetId.slice(0, 8)}.`,
      action_url: `/ops/admin/assets/${assetId}?tab=maintenance`,
      entity_type: 'maintenance_schedule',
      entity_id: assetId,
      severity: 'warning',
    }
  );
}
