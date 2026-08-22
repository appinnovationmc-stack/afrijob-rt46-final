import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useUnreadNotificationCount, useNotificationRealtime } from '@/hooks/useNotifications';

export function NotificationBell() {
  useNotificationRealtime();
  const { data: count } = useUnreadNotificationCount();

  return (
    <Link to="/ops/notifications" className="relative w-10 h-10 flex items-center justify-center shrink-0">
      <Bell className="w-5 h-5 text-charcoal dark:text-white" />
      {!!count && count > 0 && (
        <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Link>
  );
}
