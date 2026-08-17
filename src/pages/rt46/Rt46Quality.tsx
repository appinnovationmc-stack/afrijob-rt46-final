import { useState } from 'react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import {
  ClipboardCheck, Camera as CameraIcon, MapPin, CheckSquare, Square, Plus,
  FileText, AlertTriangle, RotateCcw, FileDown,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import {
  useWorkOrders, useChecklistItems, useToggleChecklistItem, useEvidence, useAddEvidence,
  useWorkOrderParts, useAddWorkOrderPart, useUpdateWorkOrderLabour, useQualityReviews,
  useSubmitQualityReview, useReworkCases, useCanComplete, useSignedUrl,
} from '@/hooks/useRt46';
import { useRt46WorkOrderReport } from '@/hooks/useRt46WorkOrderReport';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { offlineDb, newLocalId } from '@/lib/offlineDb';
import { supabase } from '@/lib/supabase';
import { rt46, type EvidenceStage, type QualityOutcome } from '@/lib/rt46';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToastStore } from '@/components/ui/Toast';
import { cn, formatCurrencyZAR, formatDate } from '@/lib/utils';

const STAGES: { key: EvidenceStage; label: string }[] = [
  { key: 'before', label: 'Before' },
  { key: 'during', label: 'During' },
  { key: 'after', label: 'After' },
];

function EvidenceThumb({ evidence }: { evidence: { id: string; storage_path: string; latitude: number; longitude: number } }) {
  const { data: url } = useSignedUrl('rt46-evidence', evidence.storage_path);
  return (
    <div className="aspect-square rounded-lg overflow-hidden relative bg-gray-100 dark:bg-charcoal-light">
      {url && <img src={url} className="w-full h-full object-cover" />}
      <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] px-1 py-0.5 flex items-center gap-0.5">
        <MapPin className="w-2.5 h-2.5" /> {evidence.latitude.toFixed(3)},{evidence.longitude.toFixed(3)}
      </div>
    </div>
  );
}

function EvidenceSection({ workOrderId, merchantId }: { workOrderId: string; merchantId: string }) {
  const { data: evidence } = useEvidence(workOrderId);
  const addEvidence = useAddEvidence();
  const userId = useAuthStore((s) => s.user?.id);
  const push = useToastStore((s) => s.push);
  const online = useNetworkStatus();
  const [capturing, setCapturing] = useState<EvidenceStage | null>(null);

  const capture = async (stage: EvidenceStage) => {
    if (!userId) return;
    setCapturing(stage);
    try {
      const photo = await Camera.getPhoto({ resultType: CameraResultType.Base64, source: CameraSource.Camera, quality: 80, saveToGallery: false });

      let latitude: number | null = null, longitude: number | null = null;
      try {
        const pos = await Geolocation.getCurrentPosition({ timeout: 8000 });
        latitude = pos.coords.latitude;
        longitude = pos.coords.longitude;
      } catch {
        push('GPS location is required for evidence photos — enable location and try again', 'error');
        setCapturing(null);
        return;
      }

      const takenAt = new Date().toISOString();

      if (!online) {
        await offlineDb.queuedRt46Evidence.put({
          localId: newLocalId(), workOrderId, merchantId, stage,
          dataUrl: `data:image/jpeg;base64,${photo.base64String}`,
          latitude, longitude, takenAt, uploadedBy: userId, synced: false,
        });
        push(`${stage} photo saved with GPS + timestamp — will upload once back online`, 'info');
        return;
      }

      const path = `${merchantId}/${workOrderId}/${stage}-${Date.now()}.jpg`;
      const bytes = Uint8Array.from(atob(photo.base64String!), (c) => c.charCodeAt(0));
      const { error: uploadError } = await supabase.storage.from('rt46-evidence').upload(path, bytes, { contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;

      await addEvidence.mutateAsync({
        work_order_id: workOrderId, stage, storage_path: path,
        latitude, longitude, taken_at: takenAt, uploaded_by: userId,
      });
      push(`${stage} photo captured with GPS + timestamp`, 'success');
    } catch (e: any) {
      push(e.message ?? 'Failed to capture photo', 'error');
    } finally {
      setCapturing(null);
    }
  };

  return (
    <div className="space-y-3">
      {STAGES.map((s) => {
        const items = (evidence ?? []).filter((e) => e.stage === s.key);
        return (
          <div key={s.key}>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{s.label} ({items.length})</p>
              <button
                className="text-xs text-brand font-semibold flex items-center gap-1"
                disabled={capturing === s.key}
                onClick={() => capture(s.key)}
              >
                <CameraIcon className="w-3.5 h-3.5" /> {capturing === s.key ? 'Capturing…' : 'Capture'}
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {items.map((e) => <EvidenceThumb key={e.id} evidence={e} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ChecklistSection({ workOrderId }: { workOrderId: string }) {
  const { data: items, isLoading } = useChecklistItems(workOrderId);
  const toggle = useToggleChecklistItem();
  const userId = useAuthStore((s) => s.user?.id);
  const online = useNetworkStatus();
  const push = useToastStore((s) => s.push);

  if (isLoading) return <p className="text-xs text-gray-400">Loading checklist…</p>;
  if (!items?.length) return <p className="text-xs text-gray-400">No checklist template for this job category, or job not yet allocated.</p>;

  return (
    <div className="space-y-1.5">
      {items.map((item) => (
        <button
          key={item.id}
          className="w-full flex items-start gap-2 text-left py-1.5"
          onClick={async () => {
            if (!userId) return;
            const nextChecked = !item.is_checked;
            if (!online) {
              await offlineDb.queuedRt46ChecklistUpdates.put({
                localId: newLocalId(), itemId: item.id, isChecked: nextChecked,
                actorId: userId, notes: null, createdAt: new Date().toISOString(), synced: false,
              });
              push('Saved — will sync once back online', 'info');
              return;
            }
            toggle.mutate({ id: item.id, checked: nextChecked, actorId: userId });
          }}
        >
          {item.is_checked ? <CheckSquare className="w-4 h-4 text-success shrink-0 mt-0.5" /> : <Square className="w-4 h-4 text-gray-300 shrink-0 mt-0.5" />}
          <span className={cn('text-sm', item.is_checked && 'text-gray-400 line-through')}>{item.quality_checklist_templates?.item_text}</span>
        </button>
      ))}
    </div>
  );
}

function PartsAndLabourSection({ workOrderId, merchantId, labourHours, labourRate }: { workOrderId: string; merchantId: string; labourHours: number | null; labourRate: number | null }) {
  const { data: parts } = useWorkOrderParts(workOrderId);
  const addPart = useAddWorkOrderPart();
  const updateLabour = useUpdateWorkOrderLabour();
  const push = useToastStore((s) => s.push);
  const userId = useAuthStore((s) => s.user?.id);
  const [form, setForm] = useState({ part_name: '', part_number: '', description: '', source: 'oem' as const, quantity: '1', billed_unit_cost: '' });
  const [hours, setHours] = useState(labourHours?.toString() ?? '');
  const [rate, setRate] = useState(labourRate?.toString() ?? '');
  const [invoiceUploading, setInvoiceUploading] = useState(false);

  const partsTotal = (parts ?? []).reduce((s, p) => s + Number(p.quantity) * Number(p.billed_unit_cost), 0);
  const labourTotal = (Number(hours) || 0) * (Number(rate) || 0);

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Parts</p>
        {(parts ?? []).map((p) => (
          <div key={p.id} className="flex items-center justify-between text-xs py-1 border-b border-gray-100 dark:border-gray-800">
            <div>
              <span className="font-medium">{p.part_name}</span> <span className="text-gray-400">#{p.part_number} · {p.source}</span>
              {p.variance_pct != null && Number(p.variance_pct) > 25 && (
                <span className="text-danger font-semibold ml-1">+{Number(p.variance_pct).toFixed(0)}% vs benchmark</span>
              )}
            </div>
            <span className="font-mono">{formatCurrencyZAR(Number(p.quantity) * Number(p.billed_unit_cost))}</span>
          </div>
        ))}
        <div className="grid grid-cols-2 gap-2 mt-2">
          <input className="input !py-2 text-xs" placeholder="Part name" value={form.part_name} onChange={(e) => setForm({ ...form, part_name: e.target.value })} />
          <input className="input !py-2 text-xs" placeholder="Part number" value={form.part_number} onChange={(e) => setForm({ ...form, part_number: e.target.value })} />
          <input className="input !py-2 text-xs col-span-2" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <select className="input !py-2 text-xs" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value as any })}>
            <option value="oem">OEM</option>
            <option value="aftermarket">Aftermarket</option>
            <option value="salvage">Salvage</option>
            <option value="other">Other</option>
          </select>
          <input className="input !py-2 text-xs" type="number" placeholder="Qty" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          <input className="input !py-2 text-xs col-span-2" type="number" placeholder="Unit price (ZAR)" value={form.billed_unit_cost} onChange={(e) => setForm({ ...form, billed_unit_cost: e.target.value })} />
        </div>
        <button
          className="btn-secondary w-full mt-2 text-xs !py-2 flex items-center justify-center gap-1"
          onClick={async () => {
            if (!form.part_name || !form.part_number || !form.description || !form.billed_unit_cost) {
              push('Part number, description, quantity, unit price and source are all required', 'error');
              return;
            }
            try {
              await addPart.mutateAsync({
                work_order_id: workOrderId, part_name: form.part_name, part_number: form.part_number,
                description: form.description, source: form.source, quantity: Number(form.quantity),
                billed_unit_cost: Number(form.billed_unit_cost), reference_id: null,
              });
              setForm({ part_name: '', part_number: '', description: '', source: 'oem', quantity: '1', billed_unit_cost: '' });
              push('Part added', 'success');
            } catch (e: any) {
              push(e.message ?? 'Failed to add part — an abnormally low unit price or missing field may have been rejected', 'error');
            }
          }}
        >
          <Plus className="w-3.5 h-3.5" /> Add part
        </button>
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Labour</p>
        <div className="grid grid-cols-2 gap-2">
          <input className="input !py-2 text-xs" type="number" placeholder="Hours" value={hours} onChange={(e) => setHours(e.target.value)} />
          <input className="input !py-2 text-xs" type="number" placeholder="Rate/hr (ZAR)" value={rate} onChange={(e) => setRate(e.target.value)} />
        </div>
        <button
          className="btn-secondary w-full mt-2 text-xs !py-2"
          onClick={async () => {
            try {
              await updateLabour.mutateAsync({ workOrderId, labourHours: Number(hours), labourRate: Number(rate) });
              push('Labour recorded', 'success');
            } catch (e: any) { push(e.message ?? 'Failed to save labour', 'error'); }
          }}
        >
          Save labour
        </button>
      </div>

      <div className="rounded-lg bg-gray-50 dark:bg-charcoal-light px-3 py-2 text-xs space-y-0.5">
        <div className="flex justify-between"><span>Parts total</span><span className="font-mono">{formatCurrencyZAR(partsTotal)}</span></div>
        <div className="flex justify-between"><span>Labour total</span><span className="font-mono">{formatCurrencyZAR(labourTotal)}</span></div>
        <div className="flex justify-between font-semibold border-t border-gray-200 dark:border-gray-700 pt-1 mt-1"><span>Job total</span><span className="font-mono">{formatCurrencyZAR(partsTotal + labourTotal)}</span></div>
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Invoice photo (required over R10,000)</p>
        <label className="btn-secondary w-full text-xs !py-2 flex items-center justify-center gap-1.5 cursor-pointer">
          <FileText className="w-3.5 h-3.5" /> {invoiceUploading ? 'Uploading…' : 'Upload invoice photo'}
          <input
            type="file" accept="image/*" className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file || !userId) return;
              setInvoiceUploading(true);
              try {
                const path = `${merchantId}/${workOrderId}/invoice-${Date.now()}.jpg`;
                const { error: uploadError } = await supabase.storage.from('rt46-evidence').upload(path, file, { contentType: file.type || 'image/jpeg' });
                if (uploadError) throw uploadError;
                const { error } = await rt46.from('work_order_invoices').insert({ work_order_id: workOrderId, storage_path: path, uploaded_by: userId });
                if (error) throw error;
                push('Invoice uploaded', 'success');
              } catch (err: any) {
                push(err.message ?? 'Failed to upload invoice', 'error');
              } finally {
                setInvoiceUploading(false);
              }
            }}
          />
        </label>
      </div>
    </div>
  );
}

function QualityReviewSection({ workOrderId }: { workOrderId: string }) {
  const { data: reviews } = useQualityReviews(workOrderId);
  const { data: rework } = useReworkCases(workOrderId);
  const { data: blocker } = useCanComplete(workOrderId);
  const submitReview = useSubmitQualityReview();
  const userId = useAuthStore((s) => s.user?.id);
  const push = useToastStore((s) => s.push);
  const [score, setScore] = useState('90');
  const [outcome, setOutcome] = useState<QualityOutcome>('pass');
  const [notes, setNotes] = useState('');

  return (
    <div className="space-y-3">
      <div className={cn('rounded-lg px-3 py-2 text-xs font-medium', blocker ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success')}>
        {blocker ? <span className="flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Cannot close: {blocker}</span> : 'Ready to close — all requirements met.'}
      </div>

      {(rework ?? []).filter((r) => r.status !== 'resolved').length > 0 && (
        <div className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger flex items-center gap-1.5">
          <RotateCcw className="w-3.5 h-3.5" /> Open rework case in progress
        </div>
      )}

      <div>
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Submit quality review</p>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <input className="input !py-2 text-xs" type="number" min={0} max={100} placeholder="Score (0-100)" value={score} onChange={(e) => setScore(e.target.value)} />
          <select className="input !py-2 text-xs" value={outcome} onChange={(e) => setOutcome(e.target.value as QualityOutcome)}>
            <option value="pass">Pass</option>
            <option value="rework">Rework required</option>
            <option value="fail">Fail</option>
          </select>
        </div>
        <textarea className="input !py-2 text-xs min-h-[60px] mb-2" placeholder="Notes…" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <button
          className="btn-primary w-full text-xs !py-2.5"
          disabled={submitReview.isPending}
          onClick={async () => {
            if (!userId) return;
            try {
              await submitReview.mutateAsync({ workOrderId, score: Number(score), outcome, actorId: userId, notes });
              push('Quality review submitted', 'success');
              setNotes('');
            } catch (e: any) {
              push(e.message ?? 'Failed to submit review', 'error');
            }
          }}
        >
          Submit review
        </button>
      </div>

      {reviews && reviews.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">History</p>
          {reviews.map((r) => (
            <div key={r.id} className="text-xs py-1 border-t border-gray-100 dark:border-gray-800 flex justify-between">
              <span className="capitalize">{r.outcome} · {formatDate(r.created_at)}</span>
              <span className="font-mono">{r.score}/100</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Rt46Quality() {
  const { data: workOrders, isLoading } = useWorkOrders();
  const active = (workOrders ?? []).filter((w) => ['allocated', 'accepted', 'in_progress'].includes(w.status));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = active.find((w) => w.id === selectedId) ?? active[0] ?? null;
  const report = useRt46WorkOrderReport(selected?.id);

  return (
    <div className="px-4 pt-6 pb-6">
      <h1 className="font-heading font-bold text-2xl mb-1">Quality Control</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Checklists, GPS-tagged evidence, parts, labour, and rework decisions per work order.</p>

      {isLoading ? null : !active.length ? (
        <EmptyState icon={ClipboardCheck} title="No active work orders" description="Allocate a work order first from Fair Allocation." />
      ) : (
        <>
          <select
            className="input mb-4"
            value={selected?.id}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {active.map((w) => (
              <option key={w.id} value={w.id}>{w.category.replace('_', ' ')} — {w.id.slice(0, 8)}</option>
            ))}
          </select>

          {selected && (
            <div className="space-y-4">
              <button
                className="btn-secondary w-full text-sm !py-2.5 flex items-center justify-center gap-1.5"
                disabled={report.generating}
                onClick={() => report.generate()}
              >
                <FileDown className="w-4 h-4" /> {report.generating ? 'Generating report…' : 'Generate & share PDF report'}
              </button>
              <div className="card">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Checklist</p>
                <ChecklistSection workOrderId={selected.id} />
              </div>
              <div className="card">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Evidence</p>
                <EvidenceSection workOrderId={selected.id} merchantId={selected.allocated_merchant_id!} />
              </div>
              <div className="card">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Parts, Labour & Invoice</p>
                <PartsAndLabourSection workOrderId={selected.id} merchantId={selected.allocated_merchant_id!} labourHours={selected.labour_hours} labourRate={selected.labour_rate} />
              </div>
              <div className="card">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Quality Decision</p>
                <QualityReviewSection workOrderId={selected.id} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
