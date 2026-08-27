import { NavLink } from 'react-router-dom';
import { Bell, Briefcase, Home, Landmark, LayoutGrid, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsRt46Admin } from '@/hooks/useRt46';
import { useOrganisation } from '@/hooks/useOrganisation';

const BASE_TABS = [
  { to: '/', icon: Home, label: 'Home', end: true },
  { to: '/ops/work-orders', icon: Briefcase, label: 'Work' },
  { to: '/ops/workspace', icon: LayoutGrid, label: 'Ops' },
  { to: '/ops/notifications', icon: Bell, label: 'Alerts' },
  { to: '/profile', icon: User, label: 'Profile' },
];

const RT46_TAB: { to: string; icon: typeof Landmark; label: string; end?: boolean } = {
  to: '/rt46',
  icon: Landmark,
  label: 'RT46 Admin',
};

export function BottomNav() {
  const { data: isRt46Admin } = useIsRt46Admin();
  const { data: org } = useOrganisation();
  const tabs = isRt46Admin ? [...BASE_TABS.slice(0, 4), RT46_TAB, BASE_TABS[4]] : BASE_TABS;
  const workLabel = org?.industry_mode === 'mining' ? 'Work' : org?.industry_mode === 'municipal' ? 'Requests' : 'Work';

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-charcoal border-t border-gray-100 dark:border-gray-800 pb-[env(safe-area-inset-bottom)]" aria-label="Primary navigation">
      <div className="flex justify-around">
        {tabs.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            aria-label={label === 'Work' ? workLabel : label}
            className={({ isActive }) => cn(
              'flex flex-col items-center gap-1 py-2.5 px-3 min-w-touch min-h-touch flex-1',
              isActive ? 'text-brand' : 'text-gray-400 dark:text-gray-500'
            )}
          >
            <Icon className="w-6 h-6" strokeWidth={2} />
            <span className="text-[11px] font-medium">{label === 'Work' ? workLabel : label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
