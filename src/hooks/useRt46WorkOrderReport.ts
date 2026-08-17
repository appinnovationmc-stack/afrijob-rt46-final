import { useState } from 'react';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { supabase } from '@/lib/supabase';
import { rt46 } from '@/lib/rt46';
import { useToastStore } from '@/components/ui/Toast';
import type { RT46ReportEvidence } from '@/lib/pdf/RT46WorkOrderReport';
import type { WorkOrder, Merchant, ChecklistItem, Evidence, WorkOrderPart, QualityReview, Vehicle } from '@/lib/rt46';

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Generates the RT46 work order PDF: pulls the work order, checklist, evidence,
// parts, and latest quality review straight from Supabase, signs the (private)
// evidence photo URLs so @react-pdf/renderer can embed them, uploads the finished
// PDF to storage, stamps work_orders.pdf_report_url, then shares via the OS share
// sheet through Capacitor.
export function useRt46WorkOrderReport(workOrderId: string | undefined) {
  const [generating, setGenerating] = useState(false);
  const push = useToastStore((s) => s.push);

  const generate = async () => {
    if (!workOrderId) return;
    setGenerating(true);
    try {
      const [{ data: workOrder, error: woError }, { data: checklist, error: checklistError },
             { data: evidenceRows, error: evidenceError }, { data: parts, error: partsError },
             { data: reviews, error: reviewError }] = await Promise.all([
        rt46.from('work_orders').select('*').eq('id', workOrderId).single(),
        rt46.from('work_order_checklist_items').select('*, quality_checklist_templates(*)').eq('work_order_id', workOrderId),
        rt46.from('work_order_evidence').select('*').eq('work_order_id', workOrderId).order('taken_at'),
        rt46.from('work_order_parts').select('*').eq('work_order_id', workOrderId).order('created_at'),
        rt46.from('work_order_quality_reviews').select('*').eq('work_order_id', workOrderId).order('created_at', { ascending: false }).limit(1),
      ]);
      if (woError) throw woError;
      if (checklistError) throw checklistError;
      if (evidenceError) throw evidenceError;
      if (partsError) throw partsError;
      if (reviewError) throw reviewError;
      const wo = workOrder as WorkOrder;
      if (!wo) throw new Error('Work order not found');

      let merchant: Merchant | null = null;
      if (wo.allocated_merchant_id) {
        const { data } = await rt46.from('merchants').select('*').eq('id', wo.allocated_merchant_id).single();
        merchant = data as Merchant;
      }

      let vehicleLabel = wo.id.slice(0, 8);
      const { data: vehicle } = await rt46.from('vehicles').select('*').eq('id', wo.vehicle_id).single();
      if (vehicle) {
        const v = vehicle as Vehicle;
        vehicleLabel = v.registration || v.fleet_number || vehicleLabel;
      }

      // Sign each evidence photo (rt46-evidence bucket is private).
      const evidence: RT46ReportEvidence[] = [];
      for (const e of (evidenceRows ?? []) as Evidence[]) {
        const { data: signed } = await supabase.storage.from('rt46-evidence').createSignedUrl(e.storage_path, 3600);
        if (signed?.signedUrl) evidence.push({ ...e, url: signed.signedUrl });
      }

      const [{ pdf }, { RT46WorkOrderReport }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('@/lib/pdf/RT46WorkOrderReport'),
      ]);

      const generatedAt = new Date().toISOString();
      const blob = await pdf(
        RT46WorkOrderReport({
          workOrder: wo,
          merchant,
          vehicleLabel,
          checklist: (checklist ?? []) as ChecklistItem[],
          evidence,
          parts: (parts ?? []) as WorkOrderPart[],
          latestReview: (reviews?.[0] as QualityReview) ?? null,
          generatedAt,
        })
      ).toBlob();

      const base64 = await blobToBase64(blob);
      const fileName = `RT46-${vehicleLabel.replace(/\s+/g, '')}-${Date.now()}.pdf`;

      const storagePath = `${wo.allocated_merchant_id ?? 'unassigned'}/${wo.id}/${fileName}`;
      const { error: uploadError } = await supabase.storage
        .from('rt46-evidence')
        .upload(storagePath, blob, { contentType: 'application/pdf' });
      if (uploadError) throw uploadError;

      const { data: signedReport } = await supabase.storage.from('rt46-evidence').createSignedUrl(storagePath, 60 * 60 * 24 * 30);
      await rt46.from('work_orders').update({ pdf_report_url: storagePath }).eq('id', wo.id);

      const written = await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Cache });
      await Share.share({
        title: `RT46 Work Order Report — ${vehicleLabel}`,
        text: `RT46 work order report for ${vehicleLabel}`,
        url: written.uri,
        dialogTitle: 'Share work order report',
      });

      push('Report generated', 'success');
      return signedReport?.signedUrl;
    } catch (e) {
      push(e instanceof Error ? e.message : 'Could not generate report', 'error');
    } finally {
      setGenerating(false);
    }
  };

  return { generate, generating };
}
