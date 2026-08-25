import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Wrench, AlertTriangle, CalendarClock, FileText, Gauge, Boxes, History, Timer } from 'lucide-react';
import {
  useAsset, useAssetWorkOrders, useAssetIncidents, useAssetMaintenanceSchedules, useAssetDocuments, useAssetSlaBreaches,
} from '@/hooks/useAssetRegistry';
import { useAssetParts } from '@/hooks/useWorkOrderParts';
import { useAuditLog, AUDIT_ACTION_LABELS, AUDIT_SEVERITY_LABELS, type AuditSeverity } from '@/hooks/useAuditLog';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  ComplianceStatusChip, EnumStatusChip,
  ASSET_STATUS_STYLES, ASSET_STATUS_LABELS,
  WORK_ORDER_STATUS_STYLES, WORK_ORDER_STATUS_LABELS,
  INCIDENT_STATUS_STYLES, INCIDENT_STATUS_LABELS,
} from '@/components/ui/StatusChip';
import { formatDate, formatCurrencyZAR, cn } from '@/lib/utils';
import { useOrganisation, INDUSTRY_CONFIG } from '@/hooks/useOrganisation';

type Tab = 'overview' | 'work-orders' | 'parts' | 'maintenance' | 'incidents' | 'documents' | 'sla' | 'audit';

const TABS: { id: Tab; label: string; icon: typeof Wrench }[] = [
  { id: 'overview', label: 'Overview', icon: Gauge },
  { id: 'work-orders', label: 'Work Orders', icon: Wrench },
  { id: 'parts', label: 'Parts', icon: Boxes },
  { id: 'maintenance', label: 'Maintenance', icon: CalendarClock },
  { id: 'incidents', label: 'Incidents', icon: AlertTriangle },
  { id: 'sla', label: 'SLA', icon: Timer },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'audit', label: 'Audit', icon: History },
];

const AUDIT_SEVERITY_STYLES: Record<AuditSeverity, string> = {
  info: 'text-gray-500 dark:text-gray-400',
  warning: 'text-amber-600 dark:text-amber-400',
  critical: 'text-danger',
};

// SOURCE_LABELS makes work_orders.source_system readable — 'afrijob' is the
// legacy per-workshop job-card flow, 'rt46' is the government programme,
// 'native' is created directly in the generic Ops work-order UI. Showing
// this per row is the point: it's a single history that's honest about
// where each item originated, rather than hiding the seam or pretending
// there's only ever been one system.
const SOURCE_LABELS: Record<string, string> = { afrijob: 'AfriOps', rt46: 'RT46', native: 'Ops' };

// Same idea as SOURCE_LABELS but for the Parts tab: work_order_parts_unified
// rows carry `source` = 'job_parts' (recorded via a workshop job's Parts &
// Labour form) or 'inventory_movements' (issued from the Ops Inventory
// module against this asset's work order). Both are real usage — this just
// says where each line came from, same honesty as the Work Orders tab.
const PART_SOURCE_LABELS: Record<string, string> = { job_parts: 'Job', inventory_movements: 'Inventory' };

export default function AssetDetail() {
  const { assetId } = useParams<{ assetId: string }>();
  const [tab, setTab] = useState<Tab>('overview');
  const { data: org } = useOrganisation();
  const industryConfig = INDUSTRY_CONFIG[org?.industry_mode ?? 'general'];

  const { data: asset, isLoading: assetLoading } = useAsset(assetId);
  const { data: workOrders } = useAssetWorkOrders(assetId);
  const { data: parts } = useAssetParts(assetId);
  const { data: incidents } = useAssetIncidents(assetId);
  const { data: maintenance } = useAssetMaintenanceSchedules(assetId);
  const { data: documents } = useAssetDocuments(assetId);
  // Audit tab is scoped to this asset's own record changes (entity_type
  // 'asset', entity_id = this asset). It intentionally does NOT pull in
  // audit rows for this asset's work orders/incidents/parts/maintenance —
  // those already have their own timelines in their respective tabs above,
  // and merging cross-entity audit rows here would need a second query
  // per related entity id list; scoping to the asset record itself is the
  // honest, verifiable slice rather than a half-merged approximation.
  const { data: assetAudit } = useAuditLog({ entityType: 'asset', entityId: assetId }, 0);
  const { data: slaBreaches } = useAssetSlaBreaches(assetId);

  if (assetLoading) {
    return (
      <div className="px-4 pt-6 pb-24">
        <SkeletonCard /><SkeletonCard />
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="px-4 pt-6 pb-24">
        <EmptyState icon={Gauge} title={`${industryConfig.assetLabelSingular} not found`} description="This may have been removed, or you don't have access to it." />
      </div>
    );
  }

  const openWorkOrders = (workOrders ?? []).filter((w) => !['completed', 'closed', 'cancelled'].includes(w.status));
  const totalCost = (workOrders ?? []).reduce((sum, w) => sum + (w.actual_cost ?? 0), 0);
  const overdueMaintenance = (maintenance ?? []).filter((m) => m.active && m.next_due_at && new Date(m.next_due_at) < new Date());
  const openIncidents = (incidents ?? []).filter((i) => i.status !== 'resolved' && i.status !== 'closed');
  const unacknowledgedSlaBreaches = (slaBreaches ?? []).filter((b) => !b.acknowledged_at);
  const partsTotal = (parts ?? []).reduce((sum, p) => sum + (p.line_total ?? 0), 0);

  const title = [asset.manufacturer, asset.model].filter(Boolean).join(' ') || asset.asset_number || industryConfig.assetLabelSingular;

  return (
    <div className="px-4 pt-6 pb-24">
      <Link to="/ops/admin/assets" className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 mb-3">
        <ArrowLeft className="w-4 h-4" /> {industryConfig.assetLabelPlural}
      </Link>

      <div className="flex items-start justify-between mb-1">
        <div>
          <h1 className="font-heading font-bold text-2xl">{title}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {asset.asset_number && <span className="font-mono">{asset.asset_number}</span>}
            {asset.registration && <span> · {asset.registration}</span>}
            {asset.year && <span> · {asset.year}</span>}
          </p>
        </div>
        <EnumStatusChip status={asset.status} styles={ASSET_STATUS_STYLES} labels={ASSET_STATUS_LABELS} />
      </div>

      {/* At-a-glance row — the "what needs attention right now" summary,
          computed from the same data the tabs below show in full. */}
      <div className="grid grid-cols-2 gap-2 my-4">
        <div className="card !py-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">Open work</p>
          <p className="font-heading font-bold text-lg">{openWorkOrders.length}</p>
        </div>
        <div className="card !py-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">Total cost</p>
          <p className="font-heading font-bold text-lg">{formatCurrencyZAR(totalCost)}</p>
        </div>
        <div className={cn('card !py-3', overdueMaintenance.length > 0 && 'border-danger/40')}>
          <p className="text-xs text-gray-500 dark:text-gray-400">Overdue maintenance</p>
          <p className={cn('font-heading font-bold text-lg', overdueMaintenance.length > 0 && 'text-danger')}>
            {overdueMaintenance.length}
          </p>
        </div>
        <div className={cn('card !py-3', openIncidents.length > 0 && 'border-danger/40')}>
          <p className="text-xs text-gray-500 dark:text-gray-400">Open incidents</p>
          <p className={cn('font-heading font-bold text-lg', openIncidents.length > 0 && 'text-danger')}>
            {openIncidents.length}
          </p>
        </div>
        <div className={cn('card !py-3', unacknowledgedSlaBreaches.length > 0 && 'border-danger/40')}>
          <p className="text-xs text-gray-500 dark:text-gray-400">Unacknowledged SLA breaches</p>
          <p className={cn('font-heading font-bold text-lg', unacknowledgedSlaBreaches.length > 0 && 'text-danger')}>
            {unacknowledgedSlaBreaches.length}
          </p>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto mb-4 -mx-4 px-4">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap shrink-0 transition-colors',
              tab === id ? 'bg-brand text-white' : 'bg-gray-100 dark:bg-charcoal-light text-gray-600 dark:text-gray-300'
            )}
          >
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="card space-y-2 text-sm">
          <Row label="Manufacturer" value={asset.manufacturer} />
          <Row label="Model" value={asset.model} />
          <Row label="VIN" value={asset.vin} mono />
          <Row label="Serial number" value={asset.serial_number} mono />
          <Row label="Meter" value={asset.meter_value != null ? `${asset.meter_value} (${asset.meter_type})` : null} />
          <Row label="Commissioned" value={formatDate(asset.commissioned_at)} />
          {asset.retired_at && <Row label="Retired" value={formatDate(asset.retired_at)} />}
        </div>
      )}

      {tab === 'work-orders' && (
        (workOrders ?? []).length === 0 ? (
          <EmptyState icon={Wrench} title="No work orders" description="Nothing has been logged against this asset yet." />
        ) : (
          <div className="space-y-2">
            {workOrders!.map((w) => (
              <div key={w.id} className="card !py-3">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="font-medium text-sm flex-1">{w.description || w.category}</p>
                  <EnumStatusChip status={w.status} styles={WORK_ORDER_STATUS_STYLES} labels={WORK_ORDER_STATUS_LABELS} />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {SOURCE_LABELS[w.source_system ?? ''] ?? w.source_system} · {w.category} · {w.priority} priority
                  {w.actual_cost != null && <span> · {formatCurrencyZAR(w.actual_cost)}</span>}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {w.completed_at ? `Completed ${formatDate(w.completed_at)}` : w.due_at ? `Due ${formatDate(w.due_at)}` : formatDate(w.created_at)}
                </p>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'parts' && (
        (parts ?? []).length === 0 ? (
          <EmptyState icon={Boxes} title="No parts logged" description="No parts have been recorded against this asset's work orders yet." />
        ) : (
          <div className="space-y-2">
            {parts!.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">{p.description}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {PART_SOURCE_LABELS[p.source ?? ''] ?? p.source} · {p.quantity} × {p.unit_cost != null ? formatCurrencyZAR(p.unit_cost) : '—'} · {formatDate(p.created_at)}
                  </p>
                  {/* Only inventory_movements-sourced lines can carry a real supplier
                      link (receipted against a PO via purchase_order_item_id).
                      job_parts has no PO column, so those rows never show this —
                      no fabricated procurement trail for legacy job-card entries. */}
                  {p.supplier_name && (
                    <p className="text-xs text-gray-400 mt-0.5">via {p.supplier_name}</p>
                  )}
                </div>
                <p className="font-semibold">{p.line_total != null ? formatCurrencyZAR(p.line_total) : '—'}</p>
              </div>
            ))}
            <hr className="border-gray-100 dark:border-gray-800 my-1" />
            <div className="flex items-center justify-between text-sm font-semibold">
              <span>Parts total</span>
              <span>{formatCurrencyZAR(partsTotal)}</span>
            </div>
          </div>
        )
      )}

      {tab === 'maintenance' && (
        (maintenance ?? []).length === 0 ? (
          <EmptyState icon={CalendarClock} title="No maintenance schedules" description="No preventive maintenance is configured for this asset." />
        ) : (
          <div className="space-y-2">
            {maintenance!.map((m) => {
              const overdue = m.active && m.next_due_at && new Date(m.next_due_at) < new Date();
              return (
                <div key={m.id} className={cn('card !py-3', overdue && 'border-danger/40')}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-medium text-sm flex-1">{m.name}</p>
                    {!m.active && <span className="text-xs text-gray-400">Inactive</span>}
                    {overdue && <span className="text-xs font-semibold text-danger">Overdue</span>}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {m.trigger_type} · {m.next_due_at ? `Next due ${formatDate(m.next_due_at)}` : 'No due date set'}
                  </p>
                </div>
              );
            })}
          </div>
        )
      )}

      {tab === 'incidents' && (
        (incidents ?? []).length === 0 ? (
          <EmptyState icon={AlertTriangle} title="No incidents" description="No incidents have been reported for this asset." />
        ) : (
          <div className="space-y-2">
            {incidents!.map((i) => (
              <div key={i.id} className="card !py-3">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="font-medium text-sm flex-1">{i.category}</p>
                  <EnumStatusChip status={i.status} styles={INCIDENT_STATUS_STYLES} labels={INCIDENT_STATUS_LABELS} />
                </div>
                {i.description && <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{i.description}</p>}
                <p className="text-xs text-gray-400 mt-0.5">{i.severity} severity · {formatDate(i.occurred_at)}</p>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'audit' && (
        (assetAudit?.entries ?? []).length === 0 ? (
          <EmptyState icon={History} title="No audit history" description="No changes have been recorded against this asset record yet." />
        ) : (
          <div className="space-y-2">
            {assetAudit!.entries.map((entry) => (
              <div key={entry.id} className="card !py-3">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="font-medium text-sm flex-1">{AUDIT_ACTION_LABELS[entry.action] ?? entry.action}</p>
                  <span className={cn('text-xs font-medium', AUDIT_SEVERITY_STYLES[entry.severity])}>
                    {AUDIT_SEVERITY_LABELS[entry.severity]}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {entry.actor?.full_name ?? 'System'} · {formatDate(entry.created_at)}
                </p>
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'sla' && (
        (slaBreaches ?? []).length === 0 ? (
          <EmptyState icon={Timer} title="No SLA breaches" description="This asset's work orders have not breached any SLA target." />
        ) : (
          <div className="space-y-2">
            {slaBreaches!.map((b) => (
              <div key={b.id} className={cn('card !py-3', !b.acknowledged_at && 'border-danger/40')}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="font-medium text-sm flex-1 capitalize">{b.metric} breach</p>
                  {!b.acknowledged_at && <span className="text-xs font-semibold text-danger">Unacknowledged</span>}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {b.minutes_over} min over target · Breached {formatDate(b.breached_at)}
                </p>
                {b.acknowledged_at && (
                  <p className="text-xs text-gray-400 mt-0.5">Acknowledged {formatDate(b.acknowledged_at)}</p>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'documents' && (
        (documents ?? []).length === 0 ? (
          <EmptyState icon={FileText} title="No documents" description="No compliance documents are attached to this asset." />
        ) : (
          <div className="space-y-2">
            {documents!.map((d) => (
              <div key={d.id} className="card !py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{d.doc_type}</p>
                  {d.expiry_date && <p className="text-xs text-gray-500 dark:text-gray-400">Expires {formatDate(d.expiry_date)}</p>}
                </div>
                <ComplianceStatusChip status={d.status} />
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex justify-between py-1 border-b border-gray-100 dark:border-charcoal-light last:border-0">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className={cn('font-medium', mono && 'font-mono text-xs')}>{value}</span>
    </div>
  );
}
