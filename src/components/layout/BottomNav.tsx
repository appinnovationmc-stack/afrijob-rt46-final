import { NavLink } from 'react-router-dom';
import { Home, Briefcase, ShieldCheck, User, Landmark, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsRt46Admin } from '@/hooks/useRt46';

const BASE_TABS = [
  { to: '/', icon: Home, label: 'Home', end: true },
  { to: '/jobs', icon: Briefcase, label: 'Jobs' },
  { to: '/ops', icon: LayoutGrid, label: 'Ops' },
  { to: '/compliance', icon: ShieldCheck, label: 'Compliance' },
  { to: '/profile', icon: User, label: 'Profile' },
];

// RT46 is a National Treasury program-administrator back office (merchant
// governance, fraud flags, cross-workshop oversight) — a completely
// different persona from the workshop user this nav otherwise serves. It
// only appears for accounts actually registered as RT46 admins; showing it
// to every workshop user just to hit an "access required" wall was the bug.
const RT46_TAB: { to: string; icon: typeof Landmark; label: string; end?: boolean } = { to: '/rt46', icon: Landmark, label: 'RT46 Admin' };

export function BottomNav() {
  const { data: isRt46Admin } = useIsRt46Admin();
  const tabs = isRt46Admin ? [...BASE_TABS.slice(0, 4), RT46_TAB, BASE_TABS[4]] : BASE_TABS;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-charcoal border-t border-gray-100 dark:border-gray-800 pb-[env(safe-area-inset-bottom)]">
      <div className="flex justify-around">
        {tabs.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-1 py-2.5 px-4 min-w-touch min-h-touch flex-1',
                isActive ? 'text-brand' : 'text-gray-400 dark:text-gray-500'
              )
            }
          >
            <Icon className="w-6 h-6" strokeWidth={2} />
            <span className="text-[11px] font-medium">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
