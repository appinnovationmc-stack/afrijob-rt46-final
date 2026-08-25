import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CalendarClock, Gauge, Lightbulb, ShieldAlert, Wrench } from 'lucide-react';
import { useOrganisation, INDUSTRY_CONFIG, INDUSTRY_LABELS } from '@/hooks/useOrganisation';
import { useWorkOrders } from '@/hooks/useWorkOrders';
import { useIncidents } from '@/hooks/useIncidents';
import { useOpenSlaBreaches } from '@/hooks/useSla';
import { useDueMaintenanceSchedules } from '@/hooks/useMaintenanceSchedules';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { formatDate } from '@/lib/utils';

function Insight({ icon: Icon, title, body, href }: { icon: React.ElementType; title: string; body: string; href?: string }) {
  const content = (
    <div className="card flex gap-3 items-start active:scale-[0.99] transition-transform">
      <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-charcoal-light flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-brand" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-sm">{title}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-5">{body}</p>
      </div>
      {href && <ArrowRight className="w-4 h-4 text-gray-300 shrink-0 mt-1" />}
    </div>
  );
  return href ? <Link to={href}>{content}</Link> : content;
}

export default function OperationalIntelligence() {
  const { data: org, isLoading: orgLoading } = useOrganisation();
  const { data: workOrders, isLoading: workOrdersLoading } = useWorkOrders();
  const { data: incidents, isLoading: incidentsLoading } = useIncidents('reported');
  const { data: breaches, isLoading: breachesLoading } = useOpenSlaBreaches();
  const { data: dueMaintenance, isLoading: maintenanceLoading } = useDueMaintenanceSchedules();

  if (orgLoading) return <div className="px-4 pt-6 space-y-3"><SkeletonCard /><SkeletonCard /></div>;
  if (!org) return <div className="px-4 pt-6"><EmptyState icon={Gauge} title="No organisation found" description="Your account is not linked to an organisation." /></div>;

  const openWorkOrders = (workOrders ?? []).filter((w) => !['completed', 'cancelled', 'disputed'].includes(w.status));
  const urgentWork = openWorkOrders.filter((w) => w.priority === 'urgent' || w.priority === 'high');
  const overdueWork = openWorkOrders.filter((w) => w.due_at && new Date(w.due_at).getTime() < Date.now());
  const severeIncidents = (incidents ?? []).filter((i) => ['high', 'critical', 'severe'].includes(String(i.severity).toLowerCase()));
  const config = INDUSTRY_CONFIG[org.industry_mode ?? 'general'];
  const isLoading = workOrdersLoading || incidentsLoading || breachesLoading || maintenanceLoading;

  const insights: { icon: React.ElementType; title: string; body: string; href?: string }[] = [];
  if (overdueWork.length > 0) {
    insights.push({ icon: Wrench, title: `${overdueWork.length} work order${overdueWork.length === 1 ? '' : 's'} overdue`, body: `${overdueWork.filter((w) => w.priority === 'urgent').length} are urgent. Review the queue and reassign or escalate before downtime grows.`, href: '/ops/work-orders' });
  }
  if ((breaches?.length ?? 0) > 0) {
    insights.push({ icon: ShieldAlert, title: `${breaches!.length} open SLA breach${breaches!.length === 1 ? '' : 'es'}`, body: 'Acknowledge each breach, record the reason, and assign an owner so the exception has an auditable trail.', href: '/ops/sla' });
  }
  if (severeIncidents.length > 0) {
    insights.push({ icon: AlertTriangle, title: `${severeIncidents.length} high-severity incident${severeIncidents.length === 1 ? '' : 's'} reported`, body: 'Prioritise investigation and link corrective work to the affected asset or work order.', href: '/ops/incidents' });
  }
  if ((dueMaintenance?.length ?? 0) > 0) {
    insights.push({ icon: CalendarClock, title: `${dueMaintenance!.length} maintenance schedule${dueMaintenance!.length === 1 ? '' : 's'} due`, body: 'Prevent avoidable downtime by converting due schedules into planned work before the next operating window.', href: '/ops/maintenance' });
  }
  if (insights.length === 0) {
    insights.push({ icon: Lightbulb, title: 'Operations are within the monitored thresholds', body: 'No overdue work, open SLA breaches, high-severity incidents, or due maintenance exceptions were found in the current organisation view.' });
  }

  return (
    <div className="px-4 pt-6 pb-24">
      <div className="mb-5">
        <p className="text-gray-500 dark:text-gray-400 text-sm flex items-center gap-1.5"><Lightbulb className="w-4 h-4" /> {org.organisation_name}</p>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-heading font-bold text-2xl">Operational Intelligence</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{config.tagline} · {INDUSTRY_LABELS[org.industry_mode]}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-heading font-bold">{openWorkOrders.length}</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">open work orders</p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="card"><p className="text-2xl font-heading font-bold">{urgentWork.length}</p><p className="text-xs text-gray-500 dark:text-gray-400">High / urgent</p></div>
            <div className="card"><p className="text-2xl font-heading font-bold">{overdueWork.length}</p><p className="text-xs text-gray-500 dark:text-gray-400">Overdue</p></div>
            <div className="card"><p className="text-2xl font-heading font-bold">{breaches?.length ?? 0}</p><p className="text-xs text-gray-500 dark:text-gray-400">SLA breaches</p></div>
            <div className="card"><p className="text-2xl font-heading font-bold">{dueMaintenance?.length ?? 0}</p><p className="text-xs text-gray-500 dark:text-gray-400">Maintenance due</p></div>
          </div>

          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className="font-heading font-bold text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide">Recommended actions</h2>
            <span className="text-[10px] text-gray-400">Live operational data</span>
          </div>
          <div className="space-y-2.5 mb-6">
            {insights.map((item) => <Insight key={item.title} {...item} />)}
          </div>

          <div className="card">
            <p className="font-semibold text-sm mb-2">Decision context</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-5">
              These recommendations are deterministic operational rules calculated from the organisation's live work orders,
              incidents, SLA breaches and maintenance schedules. They never invent values. A future AI provider can consume
              this same structured context without changing the operational security model or replacing the underlying controls.
            </p>
            <p className="text-[11px] text-gray-400 mt-3">Generated {formatDate(new Date().toISOString())}</p>
          </div>
        </>
      )}
    </div>
  );
}
