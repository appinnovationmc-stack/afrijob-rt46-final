import { NavLink } from 'react-router-dom';
import { Bell, BriefcaseBusiness, Building2, ClipboardCheck, FileText, Home, Landmark, Package, Settings, ShieldCheck, User, Wallet, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsRt46Admin } from '@/hooks/useRt46';
import { useOrganisation } from '@/hooks/useOrganisation';
import { getRoleConfig, isModuleEnabled } from '@/config/roleConfig';

const ICONS: Record<string, typeof Home> = {
  workspace: Building2,
  intelligence: ShieldCheck,
  work_orders: BriefcaseBusiness,
  inventory: Package,
  procurement: ClipboardCheck,
  documents: FileText,
  incidents: ShieldCheck,
  maintenance: Wrench,
  sla: ShieldCheck,
  notifications: Bell,
  assets: Building2,
  drivers: User,
  trips: BriefcaseBusiness,
  admin_team: Settings,
  finance: Wallet,
  rt46: Landmark,
};

export function BottomNav() {
  const { data: isRt46Admin } = useIsRt46Admin();
  const { data: org, isLoading } = useOrganisation();

  if (isLoading) return null;

  const config = getRoleConfig(org?.role);
  const configuredTabs = config.nav
    .filter((item) => !item.moduleKey || isModuleEnabled(org?.enabled_modules, item.moduleKey))
    .slice(0, 4);

  const tabs = configuredTabs.map((item) => ({
    to: item.to,
    label: item.label,
    icon: ICONS[item.moduleKey ?? 'workspace'] ?? Home,
  }));

  if (isRt46Admin && !tabs.some((tab) => tab.to === '/rt46')) {
    tabs.push({ to: '/rt46', label: 'RT46 Admin', icon: Landmark });
  }

  // Always keep Profile available, but never let it displace a role's first
  // four work destinations. The user's workspace is therefore the primary
  // mobile experience rather than the generic Home/Work/Ops shell.
  tabs.push({ to: '/profile', label: 'Profile', icon: User });

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-charcoal border-t border-gray-100 dark:border-gray-800 pb-[env(safe-area-inset-bottom)]" aria-label="Primary navigation">
      <div className="flex justify-around">
        {tabs.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            aria-label={label}
            className={({ isActive }) => cn(
              'flex flex-col items-center gap-1 py-2.5 px-3 min-w-touch min-h-touch flex-1',
              isActive ? 'text-brand' : 'text-gray-400 dark:text-gray-500'
            )}
          >
            <Icon className="w-6 h-6" strokeWidth={2} />
            <span className="text-[11px] font-medium">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
