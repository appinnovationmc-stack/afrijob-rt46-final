import { Link } from 'react-router-dom';
import {
  Boxes, ShoppingCart, FolderLock, AlertTriangle, CalendarClock, Gauge as GaugeIcon,
  ChevronRight, Bell, PackageX, ShieldAlert, Car, Users, Wrench, History,
} from 'lucide-react';
import { useOrganisation, usePermissions, isModuleEnabled, INDUSTRY_LABELS, INDUSTRY_CONFIG } from '@/hooks/useOrganisation';
import TechnicianDashboard from '@/pages/ops/TechnicianDashboard';
import OperationsManagerDashboard from '@/pages/ops/OperationsManagerDashboard';
import ProcurementDashboard from '@/pages/ops/ProcurementDashboard';
import ComplianceDashboard from '@/pages/ops/ComplianceDashboard';
import { useInventoryItems, useExpiringDocuments, isBelowReorderPoint } from '@/hooks/useAfriops';
import { useIncidents } from '@/hooks/useIncidents';
import { useDueMaintenanceSchedules } from '@/hooks/useMaintenanceSchedules';
import { useOpenSlaBreaches } from '@/hooks/useSla';
import { useWorkOrders } from '@/hooks/useWorkOrders';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/utils';

function Kpi({ label, value, tone = 'default', icon: Icon }: { label: string; value: string | number; tone?: 'default' | 'warning' | 'danger' | 'success'; icon: React.ElementType }) {
  const toneClass = {
    default: 'text-charcoal dark:text-white',
    warning: 'text-warning',
    danger: 'text-danger',
    success: 'text-success',
  }[tone];
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <Icon className="w-4 h-4 text-gray-400" />
      </div>
      <p className={cn('text-2xl font-heading font-bold', toneClass)}>{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}

// 'work_orders' is deliberately not one of the industry-config
// moduleKeys (it's not gated per industry_mode like the others) — it's
// the single cross-source view over every work order (AfriJob, RT46,
// and native Ops), so it's always shown regardless of enabled_modules.
const NAV_ITEMS = [
  { to: '/ops/work-orders', label: 'Work Orders', description: 'Every work order across AfriJob, RT46, and Ops', icon: Wrench, moduleKey: 'work_orders' },
  { to: '/ops/inventory', label: 'Inventory', description: 'Stock levels, movements, reorder points', icon: Boxes, moduleKey: 'inventory' },
  { to: '/ops/procurement', label: 'Procurement', description: 'Suppliers, purchase orders, receiving', icon: ShoppingCart, moduleKey: 'procurement' },
  { to: '/ops/documents', label: 'Document Vault', description: 'Compliance docs, expiry tracking, verification', icon: FolderLock, moduleKey: 'documents' },
  { to: '/ops/incidents', label: 'Incidents', description: 'Breakdowns, safety, accidents, security', icon: AlertTriangle, moduleKey: 'incidents' },
  { to: '/ops/maintenance', label: 'Preventive Maintenance', description: 'Schedules, due work, meter-based triggers', icon: CalendarClock, moduleKey: 'maintenance' },
  { to: '/ops/sla', label: 'SLA Tracking', description: 'Response/resolution targets, breach monitor', icon: GaugeIcon, moduleKey: 'sla' },
  { to: '/ops/notifications', label: 'Notifications', description: 'Alerts, preferences, channels', icon: Bell, moduleKey: 'notifications' },
];

const ADMIN_NAV_ITEMS = [
  { to: '/ops/admin/assets', label: 'Asset Registry', description: 'Sites, business units, asset types, assets', icon: Car, permission: 'assets.create' },
  { to: '/ops/admin/team', label: 'Team & Roles', description: 'Members and access levels', icon: Users, permission: 'org.manage_members' },
  // Same permission the audit_log RLS policy itself checks
  // ("org members can view audit log for their org" → org.manage_members)
  // — the nav gate matches the actual DB-enforced boundary, not a
  // separate client-side guess at who should see it.
  { to: '/ops/admin/audit', label: 'Audit Log', description: 'Every recorded change across the organisation', icon: History, permission: 'org.manage_members' },
];

export default function OpsDashboard() {
  const { data: org, isLoading: orgLoading } = useOrganisation();
  const { can } = usePermissions();
  const industryConfig = INDUSTRY_CONFIG[org?.industry_mode ?? 'general'];
  const visibleNavItems = NAV_ITEMS
    .filter((item) => item.moduleKey === 'work_orders' || isModuleEnabled(org?.enabled_modules, item.moduleKey))
    // Stable sort: priority modules for this industry float to the top,
    // in the order the config lists them; everything else keeps its
    // original relative order after that. This is the concrete effect
    // of industry_mode on the dashboard — not just a badge.
    .sort((a, b) => {
      const ai = industryConfig.priorityModules.indexOf(a.moduleKey);
      const bi = industryConfig.priorityModules.indexOf(b.moduleKey);
      const aRank = ai === -1 ? industryConfig.priorityModules.length : ai;
      const bRank = bi === -1 ? industryConfig.priorityModules.length : bi;
      return aRank - bRank;
    });
  const visibleAdminItems = ADMIN_NAV_ITEMS
    .filter((item) => can(item.permission))
    .map((item) =>
      item.to === '/ops/admin/assets'
        ? {
            ...item,
            label: `${industryConfig.assetLabelPlural} Registry`,
            description: `Sites, business units, ${industryConfig.assetLabelSingular.toLowerCase()} types, ${industryConfig.assetLabelPlural.toLowerCase()}`,
          }
        : item
    );
  const { data: items, isLoading: itemsLoading } = useInventoryItems();
  const { data: expiringDocs, isLoading: docsLoading } = useExpiringDocuments();
  const { data: openIncidents, isLoading: incidentsLoading } = useIncidents('reported');
  const { data: dueSchedules, isLoading: dueLoading } = useDueMaintenanceSchedules();
  const { data: breaches, isLoading: breachesLoading } = useOpenSlaBreaches();
  // Genuinely new KPI: open (non-terminal) work orders across every
  // source — nothing surfaced this count anywhere before today. Filtered
  // client-side rather than via useWorkOrders(status) since "open" here
  // means "not completed/cancelled/disputed", not a single status value.
  const { data: allWorkOrders, isLoading: workOrdersLoading } = useWorkOrders();
  const openWorkOrders = (allWorkOrders ?? []).filter(
    (w) => !['completed', 'cancelled', 'disputed'].includes(w.status)
  );

  if (!orgLoading && !org) {
    return (
      <div className="px-4 pt-6">
        <EmptyState
          icon={GaugeIcon}
          title="No organisation found"
          description="Your account isn't linked to an organisation yet. Contact your administrator."
        />
      </div>
    );
  }

  const isLoading = orgLoading || itemsLoading || docsLoading || incidentsLoading || dueLoading || breachesLoading || workOrdersLoading;
  const lowStockCount = (items ?? []).filter(isBelowReorderPoint).length;

  // Role determines what renders, not just what's hidden — a technician's
  // job is working an assigned queue, not scanning org-wide KPIs/module
  // nav. Every other role gets the full operations view below. Checked
  // after every hook above has already run (not as an early return before
  // them) so hook call order stays identical across renders regardless of
  // role — an early return here would violate the Rules of Hooks the
  // instant org.role resolves to 'technician' on a re-render.
  if (org?.role === 'technician') {
    return <TechnicianDashboard />;
  }
  // Only the exact 'operations_manager' role, not 'supervisor' — the two
  // are close but not proven equivalent, and guessing wrong here would put
  // someone in front of an org-wide action queue they don't actually own.
  if (org?.role === 'operations_manager') {
    return <OperationsManagerDashboard />;
  }
  if (org?.role === 'procurement_officer') {
    return <ProcurementDashboard />;
  }
  if (org?.role === 'inspector') {
    return <ComplianceDashboard />;
  }

  // Every KPI the dashboard can show, keyed to match industryConfig.kpiOrder.
  // Which ones actually render, and in what order, is resolved below from
  // industryConfig — this map itself doesn't decide relevance per industry.
  const KPI_DEFINITIONS: Record<string, { label: string; value: number; tone: 'default' | 'warning' | 'danger' | 'success'; icon: React.ElementType }> = {
    open_work_orders: {
      label: 'Open work orders',
      value: openWorkOrders.length,
      tone: openWorkOrders.length > 0 ? 'warning' : 'success',
      icon: Wrench,
    },
    sla_breaches: {
      label: 'SLA breaches (open)',
      value: breaches?.length ?? 0,
      tone: breaches && breaches.length > 0 ? 'danger' : 'success',
      icon: ShieldAlert,
    },
    maintenance_due: {
      label: 'Maintenance due ≤7d',
      value: dueSchedules?.length ?? 0,
      tone: dueSchedules && dueSchedules.length > 0 ? 'warning' : 'default',
      icon: CalendarClock,
    },
    open_incidents: {
      label: 'Open incidents',
      value: openIncidents?.length ?? 0,
      tone: openIncidents && openIncidents.length > 0 ? 'warning' : 'success',
      icon: AlertTriangle,
    },
    low_stock: {
      label: 'Low stock items',
      value: lowStockCount,
      tone: lowStockCount > 0 ? 'warning' : 'default',
      icon: PackageX,
    },
    expiring_documents: {
      label: 'Docs expiring/expired',
      value: expiringDocs?.length ?? 0,
      tone: (expiringDocs?.length ?? 0) > 0 ? 'warning' : 'default',
      icon: FolderLock,
    },
  };
  // kpiOrder picks exactly 4 tiles (the grid is 2x2) in industry priority
  // order; falls back to the general order for any key it doesn't list,
  // so a new industry config that forgets a key still renders something
  // sane instead of a blank tile.
  const kpiKeys = (industryConfig.kpiOrder.length ? industryConfig.kpiOrder : INDUSTRY_CONFIG.general.kpiOrder).slice(0, 4);

  return (
    <div className="px-4 pt-6 pb-6">
      <div className="mb-6">
        <p className="text-gray-500 dark:text-gray-400 text-sm flex items-center gap-1.5">
          <GaugeIcon className="w-4 h-4" /> {org?.organisation_name ?? 'Operations'}
          {org?.industry_mode && org.industry_mode !== 'general' && (
            <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-brand-50 text-brand dark:bg-charcoal-light uppercase tracking-wide">
              {INDUSTRY_LABELS[org.industry_mode]}
            </span>
          )}
        </p>
        <h1 className="font-heading font-bold text-2xl">Operations Control</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{industryConfig.tagline}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {isLoading ? (
          [1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)
        ) : (
          kpiKeys.map((key) => {
            const def = KPI_DEFINITIONS[key];
            if (!def) return null;
            return <Kpi key={key} label={def.label} value={def.value} tone={def.tone} icon={def.icon} />;
          })
        )}
      </div>

      {!isLoading && (expiringDocs?.length ?? 0) > 0 && (
        <div className="card mb-4 border border-warning/30 bg-warning/5">
          <p className="text-sm font-semibold text-warning">
            {expiringDocs!.length} document{expiringDocs!.length === 1 ? '' : 's'} expiring or expired
          </p>
        </div>
      )}

      <h2 className="font-heading font-bold text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 px-1">
        Modules
      </h2>
      {visibleNavItems.length === 0 ? (
        <EmptyState
          icon={GaugeIcon}
          title="No modules enabled"
          description="Your organisation admin hasn't turned on any Ops modules yet."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {visibleNavItems.map(({ to, label, description, icon: Icon }) => (
            <Link key={to} to={to} className="card flex items-center gap-3 active:scale-[0.98] transition-transform">
              <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-charcoal-light flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-brand" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{label}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{description}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
            </Link>
          ))}
        </div>
      )}

      {visibleAdminItems.length > 0 && (
        <>
          <h2 className="font-heading font-bold text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 px-1 mt-6">
            Admin
          </h2>
          <div className="flex flex-col gap-2">
            {visibleAdminItems.map(({ to, label, description, icon: Icon }) => (
              <Link key={to} to={to} className="card flex items-center gap-3 active:scale-[0.98] transition-transform">
                <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-charcoal-light flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-gray-500 dark:text-gray-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{description}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
