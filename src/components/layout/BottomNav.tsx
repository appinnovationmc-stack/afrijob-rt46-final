import { NavLink } from 'react-router-dom';
import { Home, Briefcase, ShieldCheck, User, Landmark, LayoutGrid, ShoppingCart, Car, ClipboardCheck, Wrench, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsRt46Admin } from '@/hooks/useRt46';
import { useOrganisation } from '@/hooks/useOrganisation';
import type { OrganisationRole } from '@/lib/afriops/types';

const BASE_TABS = [
  { to: '/', icon: Home, label: 'Home', end: true },
  { to: '/profile', icon: User, label: 'Profile' },
];

const ROLE_TABS: Record<OrganisationRole, { to: string; icon: typeof LayoutGrid; label: string; end?: boolean }[]> = {
  owner: [{ to: '/ops', icon: LayoutGrid, label: 'Control' }, { to: '/ops/intelligence', icon: Wrench, label: 'Intelligence' }],
  admin: [{ to: '/ops', icon: Users, label: 'Admin' }, { to: '/ops/admin/team', icon: Users, label: 'Team' }],
  operations_manager: [{ to: '/ops', icon: LayoutGrid, label: 'Operations' }, { to: '/ops/work-orders', icon: Wrench, label: 'Work' }],
  manager: [{ to: '/ops', icon: LayoutGrid, label: 'Management' }, { to: '/ops/work-orders', icon: Wrench, label: 'Work' }],
  fleet_manager: [{ to: '/ops', icon: Car, label: 'Fleet' }, { to: '/ops/maintenance', icon: Wrench, label: 'Maintenance' }],
  supervisor: [{ to: '/ops', icon: LayoutGrid, label: 'Team' }, { to: '/ops/work-orders', icon: Wrench, label: 'Work' }],
  procurement_officer: [{ to: '/ops', icon: ShoppingCart, label: 'Procurement' }, { to: '/ops/procurement', icon: ShoppingCart, label: 'Orders' }],
  finance: [{ to: '/ops', icon: LayoutGrid, label: 'Finance' }, { to: '/ops/procurement', icon: ShoppingCart, label: 'Spend' }],
  inspector: [{ to: '/ops', icon: ClipboardCheck, label: 'Inspections' }, { to: '/ops/work-orders', icon: ClipboardCheck, label: 'Quality' }],
  technician: [{ to: '/ops', icon: Wrench, label: 'My Work' }, { to: '/ops/work-orders', icon: Wrench, label: 'Jobs' }],
  contractor: [{ to: '/ops', icon: Wrench, label: 'Work' }, { to: '/ops/work-orders', icon: Wrench, label: 'Jobs' }],
  member: [{ to: '/ops', icon: LayoutGrid, label: 'Operations' }, { to: '/ops/work-orders', icon: Wrench, label: 'Work' }],
  viewer: [{ to: '/ops', icon: LayoutGrid, label: 'View' }, { to: '/ops/work-orders', icon: Wrench, label: 'Work' }],
};

const RT46_TAB = { to: '/rt46', icon: Landmark, label: 'RT46 Admin' };

export function BottomNav() {
  const { data: isRt46Admin } = useIsRt46Admin();
  const { data: org } = useOrganisation();
  const roleTabs = org ? ROLE_TABS[org.role] ?? [] : [];
  const tabs = [...BASE_TABS.slice(0, 1), ...roleTabs, ...BASE_TABS.slice(1)];
  if (isRt46Admin) tabs.splice(tabs.length - 1, 0, RT46_TAB);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-charcoal border-t border-gray-100 dark:border-gray-800 pb-[env(safe-area-inset-bottom)]">
      <div className="flex justify-around">
        {tabs.map(({ to, icon: Icon, label, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => cn('flex flex-col items-center gap-1 py-2.5 px-3 min-w-touch min-h-touch flex-1', isActive ? 'text-brand' : 'text-gray-400 dark:text-gray-500')}>
            <Icon className="w-6 h-6" strokeWidth={2} />
            <span className="text-[11px] font-medium">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
