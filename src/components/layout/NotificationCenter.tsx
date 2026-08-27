import { useState } from 'react';
import { Bell, X, Check, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { useUnreadNotifications, useReadNotification } from '@/hooks/useNotifications';
import { useToastStore } from '@/components/ui/Toast';
import { cn, formatDate } from '@/lib/utils';
import type { Tables } from '@/types/database.types';

const SEVERITY_STYLES: Record<string, { bg: string; icon: typeof AlertCircle; label: string }> = {
  critical: { bg: 'bg-danger/10 border-danger/30', icon: AlertTriangle, label: 'Critical' },
  warning: { bg: 'bg-warning/10 border-warning/30', icon: AlertCircle, label: 'Warning' },
  info: { bg: 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800/30', icon: Info, label: 'Info' },
};

function NotificationItem({
  notification,
  onRead,
}: {
  notification: Tables<'notifications'>;
  onRead: (id: string) => void;
}) {
  const severity = (notification.severity as keyof typeof SEVERITY_STYLES) || 'info';
  const style = SEVERITY_STYLES[severity];
  const Icon = style.icon;

  return (
    <div className={cn('card border !py-3 !px-3', style.bg)}>
      <div className="flex gap-3">
        <Icon className="w-4 h-4 text-current shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{notification.title}</p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{notification.body}</p>
          <p className="text-[10px] text-gray-500 dark:text-gray-500 mt-1">
            {formatDate(notification.created_at)}
          </p>
        </div>
        {!notification.read_at && (
          <button
            onClick={() => onRead(notification.id)}
            className="shrink-0 text-brand hover:text-brand-dark"
            title="Mark as read"
          >
            <Check className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export function NotificationCenter({ onClose }: { onClose: () => void }) {
  const { data: notifications, isLoading } = useUnreadNotifications();
  const readNotif = useReadNotification();
  const push = useToastStore((s) => s.push);

  const handleRead = async (id: string) => {
    try {
      await readNotif.mutateAsync(id);
      push('Notification marked as read', 'success');
    } catch (err: any) {
      push(err.message ?? 'Failed to mark as read', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-end">
      <div className="w-full max-w-md h-screen bg-white dark:bg-charcoal flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="font-heading font-bold">Notifications</h2>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isLoading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : !notifications?.length ? (
            <p className="text-sm text-gray-500">No unread notifications</p>
          ) : (
            notifications.map((n) => (
              <NotificationItem key={n.id} notification={n} onRead={handleRead} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
