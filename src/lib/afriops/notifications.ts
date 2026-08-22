import { SupabaseClient } from '@supabase/supabase-js';

// ---------- Types ----------
// Mirrors notifications / notification_preferences tables
// (project wtbycozfoeiepvgortvx). Keep in sync if columns change.

// Includes the org-model types this module writes, plus the legacy
// RT46/workshop values still present in the notification_type enum (that
// system may still insert those directly) — keep both so reads stay honestly
// typed even for rows this module didn't create.
export type NotificationType =
  | 'work_order_assigned'
  | 'work_order_status_changed'
  | 'purchase_order_approval_needed'
  | 'purchase_order_approved'
  | 'document_expiring'
  | 'document_expired'
  | 'incident_reported'
  | 'incident_escalated'
  | 'maintenance_due'
  | 'low_stock'
  | 'generic'
  | 'compliance_expiry'
  | 'job_status_change'
  | 'payment'
  | 'system'
  | 'insurance_alert'
  | 'merchant_suspended'
  | 'merchant_reactivated';

export type NotificationChannel = 'in_app' | 'email' | 'sms' | 'push';

export interface Notification {
  id: string;
  organisation_id: string;
  recipient_profile_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link_entity_type: string | null; // e.g. 'work_order', 'purchase_order', 'incident'
  link_entity_id: string | null;
  read_at: string | null;
  created_at: string;
}

export interface NotificationPreference {
  profile_id: string;
  notification_type: NotificationType;
  channel: NotificationChannel;
  enabled: boolean;
}

// ---------- Reading ----------

export async function listNotifications(
  supabase: SupabaseClient,
  profileId: string,
  opts?: { unreadOnly?: boolean; limit?: number }
): Promise<Notification[]> {
  let query = supabase
    .from('notifications')
    .select('*')
    .eq('recipient_profile_id', profileId)
    .order('created_at', { ascending: false });

  if (opts?.unreadOnly) query = query.is('read_at', null);
  if (opts?.limit) query = query.limit(opts.limit);

  const { data, error } = await query;
  if (error) throw error;
  return data as Notification[];
}

export async function unreadCount(supabase: SupabaseClient, profileId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_profile_id', profileId)
    .is('read_at', null);
  if (error) throw error;
  return count ?? 0;
}

// ---------- Writing ----------

// Direct insert is fine for in-app notifications (RLS allows a user to notify
// others within their own organisation). For anything that should also fan out
// to email/SMS/push, use notifyViaRpc instead so the edge function can dispatch
// through the right channels based on notification_preferences.
export async function createInAppNotification(
  supabase: SupabaseClient,
  notification: Pick<Notification, 'organisation_id' | 'recipient_profile_id' | 'type' | 'title'> &
    Partial<Pick<Notification, 'body' | 'link_entity_type' | 'link_entity_id'>>
): Promise<Notification> {
  const { data, error } = await supabase.from('notifications').insert(notification).select().single();
  if (error) throw error;
  return data as Notification;
}

// Routes through the notify RPC, which fans out across every enabled channel
// in notification_preferences for the recipient (in-app row + email/SMS/push
// dispatch), instead of only writing the in-app row.
export async function notifyViaRpc(
  supabase: SupabaseClient,
  params: {
    organisation_id: string;
    recipient_profile_id: string;
    type: NotificationType;
    title: string;
    body?: string;
    link_entity_type?: string;
    link_entity_id?: string;
  }
): Promise<Notification> {
  const { data, error } = await supabase.rpc('notify', {
    p_organisation_id: params.organisation_id,
    p_recipient_profile_id: params.recipient_profile_id,
    p_type: params.type,
    p_title: params.title,
    p_body: params.body ?? null,
    p_link_entity_type: params.link_entity_type ?? null,
    p_link_entity_id: params.link_entity_id ?? null,
  });
  if (error) throw new Error(error.message);
  return data as Notification;
}

export async function markAsRead(supabase: SupabaseClient, notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .is('read_at', null); // guard: avoid clobbering an existing read timestamp
  if (error) throw error;
}

export async function markAllAsRead(supabase: SupabaseClient, profileId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_profile_id', profileId)
    .is('read_at', null);
  if (error) throw error;
}

// ---------- Preferences ----------

export async function listNotificationPreferences(
  supabase: SupabaseClient,
  profileId: string
): Promise<NotificationPreference[]> {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('profile_id', profileId);
  if (error) throw error;
  return data as NotificationPreference[];
}

export async function setNotificationPreference(
  supabase: SupabaseClient,
  profileId: string,
  notificationType: NotificationType,
  channel: NotificationChannel,
  enabled: boolean
): Promise<void> {
  const { error } = await supabase.from('notification_preferences').upsert(
    {
      profile_id: profileId,
      notification_type: notificationType,
      channel,
      enabled,
    },
    { onConflict: 'profile_id,notification_type,channel' }
  );
  if (error) throw error;
}

// ---------- Realtime ----------

// Subscribes to new notifications for a profile. Caller owns the returned
// channel's lifecycle — call supabase.removeChannel(channel) on unmount.
export function subscribeToNotifications(
  supabase: SupabaseClient,
  profileId: string,
  onInsert: (notification: Notification) => void
) {
  const channel = supabase
    .channel(`notifications:${profileId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `recipient_profile_id=eq.${profileId}`,
      },
      (payload) => onInsert(payload.new as Notification)
    )
    .subscribe();

  return channel;
}

// ---------- Helpers ----------

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  work_order_assigned: 'Work order assigned',
  work_order_status_changed: 'Work order status changed',
  purchase_order_approval_needed: 'Purchase order needs approval',
  purchase_order_approved: 'Purchase order approved',
  document_expiring: 'Document expiring soon',
  document_expired: 'Document expired',
  incident_reported: 'Incident reported',
  incident_escalated: 'Incident escalated',
  maintenance_due: 'Maintenance due',
  low_stock: 'Low stock',
  generic: 'Notification',
  compliance_expiry: 'Compliance document expiring',
  job_status_change: 'Job status changed',
  payment: 'Payment',
  system: 'System notification',
  insurance_alert: 'Insurance alert',
  merchant_suspended: 'Merchant suspended',
  merchant_reactivated: 'Merchant reactivated',
};

