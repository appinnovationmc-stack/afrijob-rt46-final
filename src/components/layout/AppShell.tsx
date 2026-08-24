import { Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { NotificationBell } from './NotificationBell';
import { GlobalSearch } from './GlobalSearch';
import { useSyncQueue } from '@/hooks/useSyncQueue';
import { useRt46SyncQueue } from '@/hooks/useRt46SyncQueue';
import { useOpsSyncQueue } from '@/hooks/useOpsSyncQueue';
import { WifiOff, RefreshCw } from 'lucide-react';

export function AppShell() {
  // Mounted once here so the offline queue flushes as soon as the app comes
  // back online, regardless of which screen the user is on.
  const { online, syncing, pendingCount } = useSyncQueue();
  const { syncing: rt46Syncing, pendingCount: rt46PendingCount } = useRt46SyncQueue();
  const { syncing: opsSyncing, pendingCount: opsPendingCount } = useOpsSyncQueue();

  return (
    <div className="min-h-screen flex flex-col">
      {!online && (
        <div className="bg-warning text-white text-xs font-semibold text-center py-1.5 flex items-center justify-center gap-1.5">
          <WifiOff className="w-3.5 h-3.5" />
          Offline — changes will sync when you're back online
          {(pendingCount + rt46PendingCount + opsPendingCount) > 0 && ` (${pendingCount + rt46PendingCount + opsPendingCount} pending)`}
        </div>
      )}
      {online && (syncing || rt46Syncing || opsSyncing) && (
        <div className="bg-brand text-white text-xs font-semibold text-center py-1.5 flex items-center justify-center gap-1.5">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          Syncing offline changes…
        </div>
      )}
      <div className="fixed top-3 right-3 z-40 flex items-center gap-2">
        <GlobalSearch />
        <div className="rounded-full bg-white/90 dark:bg-charcoal-light/90 backdrop-blur shadow-card">
          <NotificationBell />
        </div>
      </div>
      <main className="flex-1 pb-24">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
