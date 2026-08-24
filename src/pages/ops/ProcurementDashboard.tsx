import { Link } from 'react-router-dom';
import { ShoppingCart, PackageX, Truck, FileEdit, type LucideIcon } from 'lucide-react';
import { usePurchaseOrders, PO_STATUS_META, useInventoryItems, isBelowReorderPoint, useSuppliers } from '@/hooks/useAfriops';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDate, cn } from '@/lib/utils';

// A procurement officer's job is the PO lifecycle: what's still a draft
// (needs submitting), what's submitted (needs someone else's approval —
// shown here as visibility, not an action this role takes), what's
// approved/ordered but not yet received, and what inventory is running low
// enough to justify raising a new PO in the first place. Distinct from
// Operations Manager's cross-module queue — this is one module, worked
// deeply, not a slice of everything.
export default function ProcurementDashboard() {
  const { data: purchaseOrders, isLoading: poLoading } = usePurchaseOrders();
  const { data: items, isLoading: itemsLoading } = useInventoryItems();
  const { data: suppliers } = useSuppliers();

  const drafts = (purchaseOrders ?? []).filter((po) => po.status === 'draft');
  const awaitingApproval = (purchaseOrders ?? []).filter((po) => po.status === 'submitted');
  const inTransit = (purchaseOrders ?? []).filter((po) => po.status === 'approved' || po.status === 'ordered' || po.status === 'partially_received');
  const lowStock = (items ?? []).filter(isBelowReorderPoint);

  const supplierName = (supplierId: string) => suppliers?.find((s) => s.id === supplierId)?.trading_name ?? 'Unknown supplier';
  const isLoading = poLoading || itemsLoading;

  return (
    <div className="px-4 pt-6 pb-6">
      <div className="mb-6">
        <p className="text-gray-500 dark:text-gray-400 text-sm flex items-center gap-1.5">
          <ShoppingCart className="w-4 h-4" /> Procurement
        </p>
        <h1 className="font-heading font-bold text-2xl">Purchase Orders</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className={cn('card !py-3', drafts.length > 0 && 'border-warning/40')}>
          <p className="text-xs text-gray-500 dark:text-gray-400">Drafts to submit</p>
          <p className={cn('font-heading font-bold text-lg', drafts.length > 0 && 'text-warning')}>{drafts.length}</p>
        </div>
        <div className="card !py-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">Awaiting approval</p>
          <p className="font-heading font-bold text-lg">{awaitingApproval.length}</p>
        </div>
        <div className="card !py-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">In transit</p>
          <p className="font-heading font-bold text-lg">{inTransit.length}</p>
        </div>
        <div className={cn('card !py-3', lowStock.length > 0 && 'border-danger/40')}>
          <p className="text-xs text-gray-500 dark:text-gray-400">Low stock items</p>
          <p className={cn('font-heading font-bold text-lg', lowStock.length > 0 && 'text-danger')}>{lowStock.length}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
      ) : (
        <>
          <Section title="Drafts to submit" icon={FileEdit} empty="No draft purchase orders." href="/ops/procurement">
            {drafts.slice(0, 5).map((po) => (
              <Link key={po.id} to="/ops/procurement" className="card !py-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{supplierName(po.supplier_id)}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(po.created_at)}</p>
                </div>
                <StatusBadge status={po.status} />
              </Link>
            ))}
          </Section>

          <Section title="Awaiting approval" icon={ShoppingCart} empty="Nothing pending approval." href="/ops/procurement">
            {awaitingApproval.slice(0, 5).map((po) => (
              <Link key={po.id} to="/ops/procurement" className="card !py-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{supplierName(po.supplier_id)}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(po.created_at)}</p>
                </div>
                <StatusBadge status={po.status} />
              </Link>
            ))}
          </Section>

          <Section title="In transit" icon={Truck} empty="Nothing approved or ordered right now." href="/ops/procurement">
            {inTransit.slice(0, 5).map((po) => (
              <Link key={po.id} to="/ops/procurement" className="card !py-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{supplierName(po.supplier_id)}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(po.created_at)}</p>
                </div>
                <StatusBadge status={po.status} />
              </Link>
            ))}
          </Section>

          <Section title="Low stock" icon={PackageX} empty="Nothing is below its reorder point." href="/ops/inventory">
            {lowStock.slice(0, 5).map((item) => (
              <div key={item.id} className="card !py-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{item.name}</p>
                  <p className="text-xs text-danger">{item.quantity_on_hand} on hand · reorder at {item.reorder_point}</p>
                </div>
              </div>
            ))}
          </Section>
        </>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: keyof typeof PO_STATUS_META }) {
  const meta = PO_STATUS_META[status];
  return <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase shrink-0', meta.className)}>{meta.label}</span>;
}

function Section({
  title, icon: Icon, empty, href, children,
}: {
  title: string; icon: LucideIcon; empty: string; href: string; children: React.ReactNode;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2 px-1">
        <h2 className="font-heading font-bold text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide">{title}</h2>
        <Link to={href} className="text-xs text-brand font-medium">View all</Link>
      </div>
      {hasChildren ? <div className="space-y-2">{children}</div> : <EmptyState icon={Icon} title="All clear" description={empty} />}
    </div>
  );
}
