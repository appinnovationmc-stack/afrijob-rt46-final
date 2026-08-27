import { Link } from 'react-router-dom';
import { FileText, ShoppingCart, TrendingUp, Wrench } from 'lucide-react';
import { usePurchaseOrders } from '@/hooks/useAfriops';
import { useWorkOrders } from '@/hooks/useWorkOrders';
import { useOrganisation } from '@/hooks/useOrganisation';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { formatCurrencyZAR, formatDate } from '@/lib/utils';

export default function FinanceDashboard() {
  const { data: org, isLoading: orgLoading } = useOrganisation();
  const { data: purchaseOrders, isLoading: poLoading } = usePurchaseOrders();
  const { data: workOrders, isLoading: woLoading } = useWorkOrders();

  if (!orgLoading && !org) return <div className="px-4 pt-6"><EmptyState icon={TrendingUp} title="No organisation found" description="Your account isn't linked to an organisation." /></div>;
  if (orgLoading) return <div className="px-4 pt-6 space-y-2"><SkeletonCard /><SkeletonCard /></div>;

  const pos = purchaseOrders ?? [];
  const work = workOrders ?? [];
  const openPos = pos.filter((p) => !['received', 'cancelled'].includes(p.status));
  const realisedWork = work.filter((w) => w.actual_cost != null).reduce((sum, w) => sum + (w.actual_cost ?? 0), 0);
  const pendingApproval = pos.filter((p) => p.status === 'submitted');

  return <div className="px-4 pt-6 pb-8 max-w-6xl mx-auto">
    <header className="mb-6"><p className="text-xs uppercase tracking-wide font-semibold text-gray-500">{org?.organisation_name} · Finance</p><h1 className="font-heading font-bold text-2xl mt-1">Cost &amp; Commitments</h1><p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Track realised operational costs and the procurement queue without inventing unverified PO totals.</p></header>
    {(poLoading || woLoading) ? <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">{[1,2,3,4].map((i) => <SkeletonCard key={i} />)}</div> : <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <div className="card"><p className="text-2xl font-heading font-bold">{formatCurrencyZAR(realisedWork)}</p><p className="text-xs text-gray-500 mt-1">Recorded work cost</p></div>
      <div className="card"><p className="text-2xl font-heading font-bold">{openPos.length}</p><p className="text-xs text-gray-500 mt-1">Open purchase orders</p></div>
      <div className="card"><p className="text-2xl font-heading font-bold">{pendingApproval.length}</p><p className="text-xs text-gray-500 mt-1">Awaiting approval</p></div>
      <div className="card"><p className="text-2xl font-heading font-bold">{work.length}</p><p className="text-xs text-gray-500 mt-1">Work orders tracked</p></div>
    </div>}

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <section className="card"><div className="flex items-center gap-2 mb-3"><ShoppingCart className="w-4 h-4 text-brand"/><h2 className="font-heading font-bold">Purchase queue</h2></div>
        {openPos.length === 0 ? <p className="text-xs text-gray-500">No open purchase orders.</p> : <div className="space-y-2">{openPos.slice(0,6).map((po) => <Link key={po.id} to="/ops/procurement" className="block rounded-lg border border-gray-100 dark:border-charcoal-light p-3"><p className="text-sm font-medium">PO {po.id.slice(0,8)}</p><p className="text-xs text-gray-500 mt-1">{po.status.replace('_',' ')} · {formatDate(po.created_at)}</p></Link>)}</div>}
      </section>
      <section className="card"><div className="flex items-center gap-2 mb-3"><Wrench className="w-4 h-4 text-brand"/><h2 className="font-heading font-bold">Recorded work costs</h2></div>
        {work.filter((w) => w.actual_cost != null).length === 0 ? <p className="text-xs text-gray-500">No recorded work-order costs.</p> : <div className="space-y-2">{work.filter((w) => w.actual_cost != null).slice(0,6).map((w) => <Link key={w.id} to={`/ops/work-orders/${w.id}`} className="block rounded-lg border border-gray-100 dark:border-charcoal-light p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-medium truncate">{w.description || w.category}</p><span className="text-xs font-semibold shrink-0">{formatCurrencyZAR(w.actual_cost ?? 0)}</span></div><p className="text-xs text-gray-500 mt-1">{w.status} · {w.source_system}</p></Link>)}</div>}
      </section>
    </div>
    <div className="mt-4 flex gap-2"><Link to="/ops/procurement" className="inline-flex items-center gap-2 btn-primary !py-2"><ShoppingCart className="w-4 h-4"/> Procurement</Link><Link to="/ops/documents" className="inline-flex items-center gap-2 btn-secondary !py-2"><FileText className="w-4 h-4"/> Cost documents</Link></div>
  </div>;
}
