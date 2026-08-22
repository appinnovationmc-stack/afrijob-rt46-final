import { useState } from 'react';
import { Boxes, ArrowDownCircle, ArrowUpCircle, X } from 'lucide-react';
import { useInventoryItems, useCreateInventoryItem, useRecordInventoryMovement, isBelowReorderPoint } from '@/hooks/useAfriops';
import { useSiteOptions } from '@/hooks/useAssetSitePickers';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { FAB } from '@/components/ui/FAB';
import { useToastStore } from '@/components/ui/Toast';
import { cn, formatCurrencyZAR } from '@/lib/utils';
import type { MovementType, InventoryItem } from '@/lib/afriops/types';

function NewItemModal({ onClose }: { onClose: () => void }) {
  const create = useCreateInventoryItem();
  const { data: sites } = useSiteOptions();
  const push = useToastStore((s) => s.push);
  const [form, setForm] = useState({ name: '', sku: '', category: '', unit: 'each', reorder_point: '', unit_cost: '', site_id: '' });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full sm:max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-heading font-bold">New inventory item</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="space-y-3">
          <input className="input" placeholder="Item name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          {!!sites?.length && (
            <select className="input" value={form.site_id} onChange={(e) => setForm({ ...form, site_id: e.target.value })}>
              <option value="">No specific site (org-wide)</option>
              {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <div className="grid grid-cols-2 gap-3">
            <input className="input" placeholder="SKU (optional)" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            <input className="input" placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <input className="input" placeholder="Unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            <input className="input" type="number" placeholder="Reorder pt" value={form.reorder_point} onChange={(e) => setForm({ ...form, reorder_point: e.target.value })} />
            <input className="input" type="number" placeholder="Unit cost" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} />
          </div>
        </div>
        <button
          className="btn-primary w-full mt-4"
          disabled={!form.name.trim() || !form.unit.trim() || create.isPending}
          onClick={async () => {
            try {
              await create.mutateAsync({
                name: form.name.trim(),
                unit: form.unit.trim(),
                sku: form.sku.trim() || undefined,
                category: form.category.trim() || undefined,
                reorder_point: form.reorder_point ? Number(form.reorder_point) : undefined,
                unit_cost: form.unit_cost ? Number(form.unit_cost) : undefined,
                site_id: form.site_id || undefined,
              });
              push('Item added', 'success');
              onClose();
            } catch (e: any) {
              push(e.message ?? 'Failed to add item', 'error');
            }
          }}
        >
          Add item
        </button>
      </div>
    </div>
  );
}

function MovementModal({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const record = useRecordInventoryMovement();
  const push = useToastStore((s) => s.push);
  const [type, setType] = useState<MovementType>('receipt');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full sm:max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-heading font-bold">Record movement — {item.name}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Currently on hand: {item.quantity_on_hand} {item.unit}</p>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {(['receipt', 'issue', 'adjustment', 'return'] as MovementType[]).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={cn('rounded-xl px-3 py-2 text-sm font-semibold capitalize', type === t ? 'bg-brand text-white' : 'bg-gray-100 dark:bg-charcoal-light text-gray-600 dark:text-gray-300')}
            >
              {t}
            </button>
          ))}
        </div>
        <input className="input mb-3" type="number" placeholder="Quantity" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        <input className="input mb-4" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <button
          className="btn-primary w-full"
          disabled={!quantity || Number(quantity) <= 0 || record.isPending}
          onClick={async () => {
            try {
              await record.mutateAsync({ inventory_item_id: item.id, movement_type: type, quantity: Number(quantity), note: note.trim() || undefined });
              push('Movement recorded', 'success');
              onClose();
            } catch (e: any) {
              push(e.message ?? 'Failed to record movement', 'error');
            }
          }}
        >
          Record
        </button>
      </div>
    </div>
  );
}

export default function Inventory() {
  const { data: items, isLoading } = useInventoryItems();
  const [showNew, setShowNew] = useState(false);
  const [movementItem, setMovementItem] = useState<InventoryItem | null>(null);

  return (
    <div className="px-4 pt-6 pb-24">
      <h1 className="font-heading font-bold text-2xl mb-1">Inventory</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
        Stock on hand across sites. Movements are the only way to change quantity — never edited directly.
      </p>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <SkeletonCard key={i} />)}</div>
      ) : !items?.length ? (
        <EmptyState icon={Boxes} title="No inventory items yet" description="Add your first item to start tracking stock." />
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const low = isBelowReorderPoint(item);
            return (
              <div key={item.id} className="card">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {item.sku ? `#${item.sku} · ` : ''}{item.category ?? 'Uncategorised'}
                    </p>
                  </div>
                  {low && (
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-danger/15 text-danger shrink-0">
                      Low stock
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-2 mb-3">
                  <span className={cn('text-xl font-heading font-bold', low && 'text-danger')}>{item.quantity_on_hand}</span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">{item.unit}</span>
                  {item.reorder_point !== null && (
                    <span className="text-xs text-gray-400 ml-auto">reorder at {item.reorder_point}</span>
                  )}
                </div>
                {item.unit_cost !== null && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Unit cost: {formatCurrencyZAR(item.unit_cost)}</p>
                )}
                <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <button className="btn-secondary flex-1 text-sm !py-2 flex items-center justify-center gap-1.5" onClick={() => setMovementItem(item)}>
                    <ArrowDownCircle className="w-4 h-4" /> Receive
                  </button>
                  <button className="btn-secondary flex-1 text-sm !py-2 flex items-center justify-center gap-1.5" onClick={() => setMovementItem(item)}>
                    <ArrowUpCircle className="w-4 h-4" /> Issue
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <FAB onClick={() => setShowNew(true)} label="New item" />
      {showNew && <NewItemModal onClose={() => setShowNew(false)} />}
      {movementItem && <MovementModal item={movementItem} onClose={() => setMovementItem(null)} />}
    </div>
  );
}
