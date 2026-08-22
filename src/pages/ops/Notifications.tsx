import { useState } from 'react';
import { Bell, Check, Settings2 } from 'lucide-react';
import {
  useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead,
  useNotificationPreferences, useSetNotificationPreference, NOTIFICATION_TYPE_LABELS,
} from '@/hooks/useNotifications';
import type { NotificationChannel } from '@/hooks/useNotifications';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToastStore } from '@/components/ui/Toast';
import { cn, formatDate } from '@/lib/utils';

type Tab = 'inbox' | 'preferences';
const CHANNELS: NotificationChannel[] = ['in_app', 'email', 'sms', 'push'];

export default function Notifications() {
  const [tab, setTab] = useState<Tab>('inbox');
  const { data: notifications, isLoading } = useNotifications({ limit: 50 });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const { data: prefs } = useNotificationPreferences();
  const setPref = useSetNotificationPreference();
  const push = useToastStore((s) => s.push);

  const prefMap = new Map((prefs ?? []).map((p) => [`${p.notification_type}:${p.channel}`, p.enabled]));
  const trackedTypes = ['work_order_assigned', 'purchase_order_approval_needed', 'document_expiring', 'incident_reported', 'maintenance_due', 'low_stock'] as const;

  return (
    <div className="px-4 pt-6 pb-24">
      <h1 className="font-heading font-bold text-2xl mb-4">Notifications</h1>

      <div className="flex gap-2 mb-5">
        <button className={cn('flex-1 rounded-xl px-3 py-2 text-sm font-semibold flex items-center justify-center gap-1.5', tab === 'inbox' ? 'bg-brand text-white' : 'bg-gray-100 dark:bg-charcoal-light text-gray-600 dark:text-gray-300')} onClick={() => setTab('inbox')}>
          <Bell className="w-4 h-4" /> Inbox
        </button>
        <button className={cn('flex-1 rounded-xl px-3 py-2 text-sm font-semibold flex items-center justify-center gap-1.5', tab === 'preferences' ? 'bg-brand text-white' : 'bg-gray-100 dark:bg-charcoal-light text-gray-600 dark:text-gray-300')} onClick={() => setTab('preferences')}>
          <Settings2 className="w-4 h-4" /> Preferences
        </button>
      </div>

      {tab === 'inbox' ? (
        <>
          {!!notifications?.length && (
            <button
              className="text-sm text-brand font-semibold mb-3 flex items-center gap-1"
              disabled={markAllRead.isPending}
              onClick={async () => {
                try {
                  await markAllRead.mutateAsync();
                  push('All marked as read', 'success');
                } catch (e: any) {
                  push(e.message ?? 'Failed', 'error');
                }
              }}
            >
              <Check className="w-4 h-4" /> Mark all read
            </button>
          )}
          {isLoading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <SkeletonCard key={i} />)}</div>
          ) : !notifications?.length ? (
            <EmptyState icon={Bell} title="No notifications" description="You're all caught up." />
          ) : (
            <div className="space-y-2">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  className={cn('card w-full text-left', !n.read_at && 'border-l-4 border-brand')}
                  onClick={() => !n.read_at && markRead.mutate(n.id)}
                >
                  <div className="flex items-start justify-between mb-1">
                    <p className="font-semibold text-sm">{n.title}</p>
                    {!n.read_at && <span className="w-2 h-2 rounded-full bg-brand shrink-0 mt-1.5" />}
                  </div>
                  {n.body && <p className="text-sm text-gray-600 dark:text-gray-300 mb-1">{n.body}</p>}
                  <p className="text-xs text-gray-400">{formatDate(n.created_at)} · {NOTIFICATION_TYPE_LABELS[n.type]}</p>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Choose which channels you want for each alert type.</p>
          {trackedTypes.map((type) => (
            <div key={type} className="card">
              <p className="font-semibold text-sm mb-2">{NOTIFICATION_TYPE_LABELS[type]}</p>
              <div className="grid grid-cols-4 gap-2">
                {CHANNELS.map((channel) => {
                  const enabled = prefMap.get(`${type}:${channel}`) ?? channel === 'in_app';
                  return (
                    <button
                      key={channel}
                      className={cn('rounded-lg px-2 py-1.5 text-xs font-semibold capitalize', enabled ? 'bg-brand text-white' : 'bg-gray-100 dark:bg-charcoal-light text-gray-500 dark:text-gray-400')}
                      onClick={() => setPref.mutate({ type, channel, enabled: !enabled })}
                    >
                      {channel === 'in_app' ? 'App' : channel}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
