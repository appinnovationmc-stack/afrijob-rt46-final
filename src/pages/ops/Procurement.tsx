import { useState } from 'react';
import { ShoppingCart, X, Trash2 } from 'lucide-react';
import {
  useSuppliers, useCreateSupplier, usePurchaseOrders, useCreatePurchaseOrder,
  useSubmitPurchaseOrder, useApprovePurchaseOrder, usePurchaseOrderItems,
  useReceivePurchaseOrderItem, PO_STATUS_META,
} from '@/hooks/useAfriops';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { FAB } from '@/components/ui/FAB';
import { useToastStore } from '@/components/ui/Toast';
import { cn, formatDate, formatCurrencyZAR } from '@/lib/utils';
import { usePermissions } from '@/hooks/useOrganisation';
import type { PurchaseOrder, Supplier } from '@/lib/afriops/types';

type Tab = 'orders' | 'suppliers';
type PoWithSupplier = PurchaseOrder & { supplier: Pick<Supplier, 'trading_name'> };

function NewSupplierModal({ onClose }: { onClose: () => void }) {
  const create = useCreateSupplier();
  const push = useToastStore((s) => s.push);
  const [form, setForm] = useState({ trading_name: '', contact_email: '', contact_phone: '' });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full sm:max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-heading font-bold">New supplier</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="space-y-3">
          <input className="input" placeholder="Trading name" value={form.trading_name} onChange={(e) => setForm({ ...form, trading_name: e.target.value })} />
          <input className="input" placeholder="Contact email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
          <input className="input" placeholder="Contact phone" value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
        </div>
        <button
          className="btn-primary w-full mt-4"
          disabled={!form.trading_name.trim() || create.isPending}
          onClick={async () => {
            try {
              await create.mutateAsync({
                trading_name: form.trading_name.trim(),
                contact_email: form.contact_email.trim() || undefined,
                contact_phone: form.contact_phone.trim() || undefined,
              });
              push('Supplier added', 'success');
              onClose();
            } catch (e: any) {
              push(e.message ?? 'Failed to add supplier', 'error');
            }
          }}
        >
          Add supplier
        </button>
      </div>
    </div>
  );
}

interface DraftLine { description: string; quantity: string; unit_cost: string }

function NewPoModal({ onClose }: { onClose: () => void }) {
  const { data: suppliers } = useSuppliers();
  const create = useCreatePurchaseOrder();
  const push = useToastStore((s) => s.push);
  const [supplierId, setSupplierId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([{ description: '', quantity: '1', unit_cost: '' }]);

  const total = lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unit_cost) || 0), 0);
  const valid = supplierId && lines.every((l) => l.description.trim() && Number(l.quantity) > 0 && Number(l.unit_cost) >= 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full sm:max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-heading font-bold">New purchase order</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <select className="input mb-3" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
          <option value="">Select supplier…</option>
          {(suppliers ?? []).map((s) => (
            <option key={s.id} value={s.id}>{s.trading_name}</option>
          ))}
        </select>

        <div className="space-y-2 mb-3">
          {lines.map((line, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input className="input flex-1" placeholder="Description" value={line.description}
                onChange={(e) => setLines(lines.map((l, j) => (j === i ? { ...l, description: e.target.value } : l)))} />
              <input className="input w-16 !px-2" type="number" placeholder="Qty" value={line.quantity}
                onChange={(e) => setLines(lines.map((l, j) => (j === i ? { ...l, quantity: e.target.value } : l)))} />
              <input className="input w-24 !px-2" type="number" placeholder="Cost" value={line.unit_cost}
                onChange={(e) => setLines(lines.map((l, j) => (j === i ? { ...l, unit_cost: e.target.value } : l)))} />
              {lines.length > 1 && (
                <button onClick={() => setLines(lines.filter((_, j) => j !== i))}>
                  <Trash2 className="w-4 h-4 text-danger" />
                </button>
              )}
            </div>
          ))}
        </div>
        <button className="text-sm text-brand font-semibold mb-3" onClick={() => setLines([...lines, { description: '', quantity: '1', unit_cost: '' }])}>
          + Add line
        </button>

        <input className="input mb-3" placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />

        <p className="text-sm font-semibold mb-4">Total: {formatCurrencyZAR(total)}</p>

        <button
          className="btn-primary w-full"
          disabled={!valid || create.isPending}
          onClick={async () => {
            try {
              await create.mutateAsync({
                supplier_id: supplierId,
                notes: notes.trim() || undefined,
                items: lines.map((l) => ({ description: l.description.trim(), quantity: Number(l.quantity), unit_cost: Number(l.unit_cost) })),
              });
              push('Purchase order created as draft', 'success');
              onClose();
            } catch (e: any) {
              push(e.message ?? 'Failed to create purchase order', 'error');
            }
          }}
        >
          Create draft
        </button>
      </div>
    </div>
  );
}

function ReceiveLineControl({
  item,
  onReceive,
  pending,
}: {
  item: { id: string; quantity: number; received_quantity: number };
  onReceive: (quantity: number) => void;
  pending: boolean;
}) {
  const remaining = item.quantity - item.received_quantity;
  const [qty, setQty] = useState(String(remaining));

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <input
        className="input !w-16 !px-2 !py-1.5 text-xs"
        type="number"
        min={1}
        max={remaining}
        value={qty}
        onChange={(e) => setQty(e.target.value)}
      />
      <button
        className="btn-secondary !py-1.5 !px-3 text-xs"
        disabled={pending || !Number(qty) || Number(qty) <= 0 || Number(qty) > remaining}
        onClick={() => onReceive(Number(qty))}
      >
        Receive
      </button>
    </div>
  );
}

function PoCard({ po }: { po: PoWithSupplier }) {
  const push = useToastStore((s) => s.push);
  const submit = useSubmitPurchaseOrder();
  const approve = useApprovePurchaseOrder();
  const receiveItem = useReceivePurchaseOrderItem();
  const { can } = usePermissions();
  const [expanded, setExpanded] = useState(false);
  const { data: poItems } = usePurchaseOrderItems(expanded ? po.id : undefined);
  const meta = PO_STATUS_META[po.status];

  return (
    <div className="card">
      <button className="w-full text-left" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start justify-between mb-1">
          <p className="font-semibold text-sm">{po.supplier?.trading_name ?? 'Supplier'}</p>
          <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold shrink-0', meta.className)}>
            {meta.label}
          </span>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(po.created_at)}</p>
      </button>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 space-y-2">
          {(poItems ?? []).map((item) => (
            <div key={item.id} className="flex items-center justify-between text-sm">
              <div>
                <p>{item.description}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {item.received_quantity}/{item.quantity} received · {formatCurrencyZAR(item.unit_cost)} each
                </p>
              </div>
              {(po.status === 'approved' || po.status === 'ordered' || po.status === 'partially_received') && can('procurement.receive') ? (
                item.received_quantity < item.quantity && (
                  <ReceiveLineControl
                    item={item}
                    pending={receiveItem.isPending}
                    onReceive={async (quantity) => {
                      try {
                        await receiveItem.mutateAsync({ purchaseOrderItemId: item.id, quantity });
                        push('Item received', 'success');
                      } catch (e: any) {
                        push(e.message ?? 'Failed to receive item', 'error');
                      }
                    }}
                  />
                )
              ) : null}
            </div>
          ))}

          <div className="flex gap-2 pt-2">
            {po.status === 'draft' && (
              <button
                className="btn-primary flex-1 text-sm !py-2"
                disabled={submit.isPending}
                onClick={async () => {
                  try {
                    await submit.mutateAsync(po.id);
                    push('Submitted for approval', 'success');
                  } catch (e: any) {
                    push(e.message ?? 'Failed to submit', 'error');
                  }
                }}
              >
                Submit for approval
              </button>
            )}
            {po.status === 'submitted' && can('procurement.approve') && (
              <button
                className="btn-primary flex-1 text-sm !py-2"
                disabled={approve.isPending}
                onClick={async () => {
                  try {
                    await approve.mutateAsync(po.id);
                    push('Purchase order approved', 'success');
                  } catch (e: any) {
                    push(e.message ?? 'Approval failed', 'error');
                  }
                }}
              >
                Approve
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Procurement() {
  const [tab, setTab] = useState<Tab>('orders');
  const { data: orders, isLoading: ordersLoading } = usePurchaseOrders();
  const { data: suppliers, isLoading: suppliersLoading } = useSuppliers();
  const [showNewPo, setShowNewPo] = useState(false);
  const [showNewSupplier, setShowNewSupplier] = useState(false);

  return (
    <div className="px-4 pt-6 pb-24">
      <h1 className="font-heading font-bold text-2xl mb-1">Procurement</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Suppliers and purchase orders.</p>

      <div className="flex gap-2 mb-5">
        <button className={cn('flex-1 rounded-xl px-3 py-2 text-sm font-semibold', tab === 'orders' ? 'bg-brand text-white' : 'bg-gray-100 dark:bg-charcoal-light text-gray-600 dark:text-gray-300')} onClick={() => setTab('orders')}>
          Purchase Orders
        </button>
        <button className={cn('flex-1 rounded-xl px-3 py-2 text-sm font-semibold', tab === 'suppliers' ? 'bg-brand text-white' : 'bg-gray-100 dark:bg-charcoal-light text-gray-600 dark:text-gray-300')} onClick={() => setTab('suppliers')}>
          Suppliers
        </button>
      </div>

      {tab === 'orders' ? (
        ordersLoading ? (
          <div className="space-y-3">{[1, 2, 3].map((i) => <SkeletonCard key={i} />)}</div>
        ) : !orders?.length ? (
          <EmptyState icon={ShoppingCart} title="No purchase orders yet" description="Create one once you have a supplier on file." />
        ) : (
          <div className="space-y-3">{orders.map((po) => <PoCard key={po.id} po={po} />)}</div>
        )
      ) : suppliersLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <SkeletonCard key={i} />)}</div>
      ) : !suppliers?.length ? (
        <EmptyState icon={ShoppingCart} title="No suppliers yet" />
      ) : (
        <div className="space-y-3">
          {suppliers.map((s) => (
            <div key={s.id} className="card">
              <p className="font-semibold text-sm">{s.trading_name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{s.contact_email ?? '—'} {s.contact_phone ? `· ${s.contact_phone}` : ''}</p>
            </div>
          ))}
        </div>
      )}

      <FAB onClick={() => (tab === 'orders' ? setShowNewPo(true) : setShowNewSupplier(true))} label={tab === 'orders' ? 'New PO' : 'New supplier'} />
      {showNewPo && <NewPoModal onClose={() => setShowNewPo(false)} />}
      {showNewSupplier && <NewSupplierModal onClose={() => setShowNewSupplier(false)} />}
    </div>
  );
}
