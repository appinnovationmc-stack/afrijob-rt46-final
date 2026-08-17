import { NavLink } from 'react-router-dom';
import { Home, Briefcase, ShieldCheck, User, Gauge } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { to: '/', icon: Home, label: 'Home', end: true },
  { to: '/jobs', icon: Briefcase, label: 'Jobs' },
  { to: '/compliance', icon: ShieldCheck, label: 'Compliance' },
  { to: '/rt46', icon: Gauge, label: 'RT46' },
  { to: '/profile', icon: User, label: 'Profile' },
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-charcoal border-t border-gray-100 dark:border-gray-800 pb-[env(safe-area-inset-bottom)]">
      <div className="flex justify-around">
        {TABS.map(({ to, icon: Icon, label, end }) => (
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
