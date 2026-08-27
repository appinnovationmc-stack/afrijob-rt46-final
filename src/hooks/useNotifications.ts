import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useOrganisation } from './useOrganisation';
import { useAuthStore } from '@/store/authStore';
import { readNotification, getUnreadNotifications } from '@/lib/afriops/notifications';
import type { Tables } from '@/types/database.types';

/**
 * Fetches all unread notifications for the current user in their current organisation.
 */
export function useUnreadNotifications() {
  const { data: org } = useOrganisation();
  const profile = useAuthStore((s) => s.profile);

  return useQuery({
    queryKey: ['ops', 'notifications:unread', org?.organisation_id, profile?.id],
    enabled: !!org?.organisation_id && !!profile?.id,
    staleTime: 30_000, // Refresh every 30 seconds
    queryFn: async (): Promise<Tables<'notifications'>[]> => {
      return getUnreadNotifications(supabase, org!.organisation_id, profile!.id);
    },
  });
}

/**
 * Fetches all notifications (read and unread) for the current user.
 */
export function useAllNotifications() {
  const { data: org } = useOrganisation();
  const profile = useAuthStore((s) => s.profile);

  return useQuery({
    queryKey: ['ops', 'notifications:all', org?.organisation_id, profile?.id],
    enabled: !!org?.organisation_id && !!profile?.id,
    staleTime: 60_000,
    queryFn: async (): Promise<Tables<'notifications'>[]> => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('organisation_id', org!.organisation_id)
        .eq('profile_id', profile!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Tables<'notifications'>[];
    },
  });
}

/**
 * Marks a notification as read.
 */
export function useReadNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (notificationId: string) => {
      await readNotification(supabase, notificationId);
      return notificationId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ops', 'notifications:unread'] });
      qc.invalidateQueries({ queryKey: ['ops', 'notifications:all'] });
    },
  });
}

/**
 * Counts unread notifications; suitable for badge on nav icon.
 */
export function useUnreadNotificationCount() {
  const { data: notifications } = useUnreadNotifications();
  return (notifications ?? []).length;
}
