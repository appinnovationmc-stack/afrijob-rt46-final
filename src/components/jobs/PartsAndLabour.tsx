import { useState } from 'react';
import { useJobParts, useAddJobPart, useDeleteJobPart } from '@/hooks/useJobParts';
import { useUpdateJob } from '@/hooks/useJobs';
import { useInventoryItems } from '@/hooks/useAfriops';
import { useToastStore } from '@/components/ui/Toast';
import { formatCurrencyZAR } from '@/lib/utils';
import { haptics } from '@/lib/haptics';
import { Plus, Trash2, Wrench } from 'lucide-react';

export function PartsAndLabour({ jobId, labourHours }: { jobId: string; labourHours: number | null }) {
  const { data: parts, isLoading } = useJobParts(jobId);
  const addPart = useAddJobPart();
  const deletePart = useDeleteJobPart();
  const updateJob = useUpdateJob();
  const push = useToastStore((s) => s.push);
  // Org-scoped catalog, only populated when this job's org has inventory
  // tracking set up. Empty/undefined for orgs without it — the picker below
  // just doesn't render, ad-hoc part entry keeps working as before.
  const { data: catalogItems } = useInventoryItems();

  const [partName, setPartName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitCost, setUnitCost] = useState('');
  const [catalogItemId, setCatalogItemId] = useState('');
  const [hours, setHours] = useState(labourHours != null ? String(labourHours) : '');

  const partsTotal = (parts ?? []).reduce((sum, p) => sum + (p.unit_cost ?? 0) * p.quantity, 0);

  const onSelectCatalogItem = (id: string) => {
    setCatalogItemId(id);
    const item = catalogItems?.find((i) => i.id === id);
    if (item) {
      setPartName(item.name);
      if (item.unit_cost != null) setUnitCost(String(item.unit_cost));
    }
  };

  const onAddPart = async () => {
    if (!partName.trim()) return;
    try {
      await addPart.mutateAsync({
        job_id: jobId,
        part_name: partName.trim(),
        quantity: Number(quantity) || 1,
        unit_cost: unitCost ? Number(unitCost) : null,
        inventory_item_id: catalogItemId || null,
      });
      setPartName('');
      setQuantity('1');
      setUnitCost('');
      setCatalogItemId('');
      haptics.light();
    } catch (e) {
      haptics.error();
      push(e instanceof Error ? e.message : 'Could not add part', 'error');
    }
  };

  const onSaveHours = async () => {
    try {
      await updateJob.mutateAsync({ id: jobId, updates: { labour_hours: hours ? Number(hours) : null } });
      push('Labour hours saved', 'success');
    } catch (e) {
      push(e instanceof Error ? e.message : 'Could not save labour hours', 'error');
    }
  };

  return (
    <div className="card">
      <h3 className="font-heading font-bold mb-3">Parts & Labour</h3>

      {!isLoading && !!parts?.length && (
        <div className="flex flex-col gap-2 mb-3">
          {parts.map((p) => (
            <div key={p.id} className="flex items-center justify-between text-sm">
              <div>
                <p className="font-medium">{p.part_name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {p.quantity} × {p.unit_cost != null ? formatCurrencyZAR(p.unit_cost) : '—'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <p className="font-semibold">{p.unit_cost != null ? formatCurrencyZAR(p.unit_cost * p.quantity) : '—'}</p>
                <button
                  onClick={() => deletePart.mutate({ id: p.id, jobId })}
                  className="text-gray-400 hover:text-danger min-w-touch min-h-touch flex items-center justify-center"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          <hr className="border-gray-100 dark:border-gray-800 my-1" />
          <div className="flex items-center justify-between text-sm font-semibold">
            <span>Parts total</span>
            <span>{formatCurrencyZAR(partsTotal)}</span>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 mb-4">
        {!!catalogItems?.length && (
          <select
            className="input"
            value={catalogItemId}
            onChange={(e) => onSelectCatalogItem(e.target.value)}
          >
            <option value="">Ad-hoc part (not in stock catalog)</option>
            {catalogItems.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} — {i.quantity_on_hand} {i.unit} on hand
              </option>
            ))}
          </select>
        )}
        <input
          className="input"
          placeholder="Part name"
          value={partName}
          onChange={(e) => {
            setPartName(e.target.value);
            if (catalogItemId) setCatalogItemId(''); // typing manually detaches from the catalog pick
          }}
        />
        <div className="grid grid-cols-2 gap-2">
          <input className="input" type="number" min="1" placeholder="Qty" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          <input className="input" type="number" min="0" step="0.01" placeholder="Unit cost (R)" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
        </div>
        <button onClick={onAddPart} disabled={addPart.isPending || !partName.trim()} className="btn-secondary flex items-center justify-center gap-1.5">
          <Plus className="w-4 h-4" />
          Add Part
        </button>
      </div>

      <hr className="border-gray-100 dark:border-gray-800 mb-4" />

      <div className="flex items-center gap-2 mb-2">
        <Wrench className="w-4 h-4 text-brand" />
        <p className="text-sm font-semibold">Labour Hours</p>
      </div>
      <div className="flex gap-2">
        <input className="input" type="number" min="0" step="0.25" placeholder="0" value={hours} onChange={(e) => setHours(e.target.value)} />
        <button onClick={onSaveHours} disabled={updateJob.isPending} className="btn-secondary shrink-0">
          Save
        </button>
      </div>
    </div>
  );
}
