import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useUpdateJob } from '@/hooks/useJobs';
import { useToastStore } from '@/components/ui/Toast';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { haptics } from '@/lib/haptics';
import { Eraser, PenLine, RotateCcw, Check } from 'lucide-react';

// Simple canvas signature capture. Deliberately kept online-only: a
// signature is a legal-ish artifact tied to job completion, and by that
// point in the flow the technician almost always has connectivity again —
// queuing it offline would add real complexity (base64 in Dexie, re-upload
// on sync) for a rare edge case. If that turns out wrong in the field, wire
// it through offlineDb.queuedPhotos the same way job photos are queued.
export function SignaturePad({ jobId, existingUrl }: { jobId: string; existingUrl: string | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasStrokes = useRef(false);
  const [isEmpty, setIsEmpty] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resigning, setResigning] = useState(false);
  const online = useNetworkStatus();
  const updateJob = useUpdateJob();
  const push = useToastStore((s) => s.push);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1A1A1A';
  }, [resigning]);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    drawing.current = true;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    hasStrokes.current = true;
    setIsEmpty(false);
  };

  const end = () => {
    drawing.current = false;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasStrokes.current = false;
    setIsEmpty(true);
  };

  const save = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasStrokes.current) return;
    setSaving(true);
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), (c) => c.charCodeAt(0));
      const path = `signatures/${jobId}-${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage
        .from('job-photos')
        .upload(path, bytes, { contentType: 'image/png' });
      if (uploadError) throw uploadError;
      const { data: pub } = supabase.storage.from('job-photos').getPublicUrl(path);
      await updateJob.mutateAsync({ id: jobId, updates: { customer_signature_url: pub.publicUrl } });
      haptics.success();
      push('Signature saved', 'success');
      setResigning(false);
    } catch (e) {
      haptics.error();
      push(e instanceof Error ? e.message : 'Could not save signature', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (existingUrl && !resigning) {
    return (
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-heading font-bold">Customer Signature</h3>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
            <Check className="w-3.5 h-3.5" /> Signed
          </span>
        </div>
        <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-charcoal-light p-3">
          <img src={existingUrl} alt="Customer signature" className="h-24 mx-auto object-contain" />
        </div>
        <button
          onClick={() => setResigning(true)}
          disabled={!online}
          className="btn-secondary w-full mt-3 flex items-center justify-center gap-1.5 text-sm"
        >
          <PenLine className="w-4 h-4" />
          Re-capture signature
        </button>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="font-heading font-bold mb-1">Customer Signature</h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Have the customer sign below to confirm the completed work.
      </p>
      <canvas
        ref={canvasRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        className="w-full h-40 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-charcoal-light touch-none"
      />
      <div className="flex gap-2 mt-3">
        <button onClick={clear} disabled={isEmpty} className="btn-secondary flex-1 flex items-center justify-center gap-1.5 text-sm">
          <Eraser className="w-4 h-4" />
          Clear
        </button>
        {resigning && (
          <button onClick={() => setResigning(false)} className="btn-secondary flex items-center justify-center gap-1.5 text-sm px-4">
            <RotateCcw className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={save}
          disabled={isEmpty || saving || !online}
          className="btn-primary flex-[2] flex items-center justify-center gap-1.5 text-sm"
        >
          {saving ? 'Saving…' : online ? 'Save Signature' : 'Offline — connect to save'}
        </button>
      </div>
    </div>
  );
}
