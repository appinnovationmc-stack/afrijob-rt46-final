import { AlertTriangle, Lock } from 'lucide-react';
import { useEntitlements } from '@/hooks/useEntitlements';

// Slim warning banner for 'warn' level (past_due, trial ended but not yet
// cancelled). Sits in the same banner slot as the offline/syncing banners
// in AppShell — same visual language, different trigger.
export function BillingStatusBanner() {
  const { data } = useEntitlements();
  if (!data || data.level !== 'warn' || !data.message) return null;

  return (
    <div className="bg-warning text-white text-xs font-semibold text-center py-1.5 flex items-center justify-center gap-1.5">
      <AlertTriangle className="w-3.5 h-3.5" />
      {data.message}
    </div>
  );
}

// Full takeover for 'blocked' (cancelled subscriptions). Renders instead
// of the app shell's children entirely \u2014 not just a banner \u2014 because a
// cancelled org shouldn't have working access to operational data behind
// a dismissible strip. No mutation is fired from here; this is a read-only
// UI gate. Real enforcement still lives in RLS/backend policy where it
// exists \u2014 this is the honest frontend half, not a substitute for it.
export function BillingBlockedScreen({ children }: { children: React.ReactNode }) {
  const { data } = useEntitlements();

  if (data?.level === 'blocked') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-canvas dark:bg-charcoal">
        <div className="max-w-sm text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center">
            <Lock className="w-6 h-6 text-danger" />
          </div>
          <h1 className="text-lg font-semibold">Access suspended</h1>
          <p className="text-sm text-charcoal-light dark:text-white/70">{data.message}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
