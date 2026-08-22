import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';
import * as notif from '@/lib/afriops/notifications';

export function useNotifications(opts?: { unreadOnly?: boolean; limit?: number }) {
  const profileId = useAuthStore((s) => s.profile?.id);
  return useQuery({
    queryKey: ['ops', 'notifications', profileId, opts?.unreadOnly, opts?.limit],
    enabled: !!profileId,
    queryFn: () => notif.listNotifications(supabase, profileId!, opts),
  });
}

export function useUnreadNotificationCount() {
  const profileId = useAuthStore((s) => s.profile?.id);
  return useQuery({
    queryKey: ['ops', 'notifications-unread-count', profileId],
    enabled: !!profileId,
    refetchInterval: 60_000,
    queryFn: () => notif.unreadCount(supabase, profileId!),
  });
}

// Subscribes to realtime inserts for the current profile and invalidates the
// notification queries so the bell badge and list update live. Mount once,
// e.g. in AppShell alongside the sync queue hooks.
export function useNotificationRealtime() {
  const profileId = useAuthStore((s) => s.profile?.id);
  const qc = useQueryClient();

  useEffect(() => {
    if (!profileId) return;
    const channel = notif.subscribeToNotifications(supabase, profileId, () => {
      qc.invalidateQueries({ queryKey: ['ops', 'notifications'] });
      qc.invalidateQueries({ queryKey: ['ops', 'notifications-unread-count'] });
    });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileId, qc]);
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) => notif.markAsRead(supabase, notificationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ops', 'notifications'] });
      qc.invalidateQueries({ queryKey: ['ops', 'notifications-unread-count'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const profileId = useAuthStore((s) => s.profile?.id);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => notif.markAllAsRead(supabase, profileId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ops', 'notifications'] });
      qc.invalidateQueries({ queryKey: ['ops', 'notifications-unread-count'] });
    },
  });
}

export function useNotificationPreferences() {
  const profileId = useAuthStore((s) => s.profile?.id);
  return useQuery({
    queryKey: ['ops', 'notification-preferences', profileId],
    enabled: !!profileId,
    queryFn: () => notif.listNotificationPreferences(supabase, profileId!),
  });
}

export function useSetNotificationPreference() {
  const profileId = useAuthStore((s) => s.profile?.id);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ type, channel, enabled }: { type: notif.NotificationType; channel: notif.NotificationChannel; enabled: boolean }) =>
      notif.setNotificationPreference(supabase, profileId!, type, channel, enabled),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ops', 'notification-preferences'] }),
  });
}

export { NOTIFICATION_TYPE_LABELS } from '@/lib/afriops/notifications';
export type { Notification, NotificationType, NotificationChannel } from '@/lib/afriops/notifications';
