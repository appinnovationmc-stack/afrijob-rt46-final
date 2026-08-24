import { Link, Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav';
import { NotificationBell } from './NotificationBell';
import { GlobalSearch } from './GlobalSearch';
import { useSyncQueue } from '@/hooks/useSyncQueue';
import { useRt46SyncQueue } from '@/hooks/useRt46SyncQueue';
import { useOpsSyncQueue } from '@/hooks/useOpsSyncQueue';
import { WifiOff, RefreshCw, Brain } from 'lucide-react';
import { BillingStatusBanner, BillingBlockedScreen } from './BillingStatusBanner';

export function AppShell() {
  const { online, syncing, pendingCount } = useSyncQueue();
  const { syncing: rt46Syncing, pendingCount: rt46PendingCount } = useRt46SyncQueue();
  const { syncing: opsSyncing, pendingCount: opsPendingCount } = useOpsSyncQueue();
  const pendingTotal = pendingCount + rt46PendingCount + opsPendingCount;

  return (
    <BillingBlockedScreen>
      <div className="min-h-screen flex flex-col">
        <BillingStatusBanner />
        {!online && (
          <div className="bg-warning text-white text-xs font-semibold text-center py-1.5 flex items-center justify-center gap-1.5">
            <WifiOff className="w-3.5 h-3.5" /> Offline — changes will sync when you're back online
            {pendingTotal > 0 && ` (${pendingTotal} pending)`}
          </div>
        )}
        {online && (syncing || rt46Syncing || opsSyncing) && (
          <div className="bg-brand text-white text-xs font-semibold text-center py-1.5 flex items-center justify-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Syncing offline changes…
          </div>
        )}
        <div className="fixed top-3 right-3 z-40 flex items-center gap-2">
          <GlobalSearch />
          <Link to="/ops/intelligence" className="w-10 h-10 rounded-full bg-white/90 dark:bg-charcoal-light/90 backdrop-blur shadow-card flex items-center justify-center text-gray-600 dark:text-gray-200 hover:text-brand-600" aria-label="Open AfriOps Intelligence" title="AfriOps Intelligence">
            <Brain className="w-4 h-4" />
          </Link>
          <div className="rounded-full bg-white/90 dark:bg-charcoal-light/90 backdrop-blur shadow-card"><NotificationBell /></div>
        </div>
        <main className="flex-1 pb-24"><Outlet /></main>
        <BottomNav />
      </div>
    </BillingBlockedScreen>
  );
}
