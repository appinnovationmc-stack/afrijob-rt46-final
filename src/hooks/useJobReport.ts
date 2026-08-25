import { useState } from 'react';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { supabase } from '@/lib/supabase';
import { offlineDb, isLocalId } from '@/lib/offlineDb';
import { useToastStore } from '@/components/ui/Toast';
import { haptics } from '@/lib/haptics';
import type { JobReportPhoto } from '@/lib/pdf/JobReportDocument';
import type { Tables } from '@/types/database.types';

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Generates the branded PDF report for a job: pulls every piece the report
// needs straight from Supabase (not the offline cache — a report is only
// ever generated once the job has fully synced), renders it with
// @react-pdf/renderer, uploads it to storage, stamps jobs.pdf_report_url,
// then hands it to the OS share sheet via Capacitor.
export function useJobReport(jobId: string | undefined) {
  const [generating, setGenerating] = useState(false);
  const push = useToastStore((s) => s.push);

  const generate = async () => {
    if (!jobId || isLocalId(jobId)) {
      push('This job needs to finish syncing before a report can be generated', 'info');
      return;
    }
    setGenerating(true);
    try {
      const [{ data: job, error: jobError }, { data: parts, error: partsError }, { data: photoRows, error: photosError }, { data: statusHistory, error: historyError }] =
        await Promise.all([
          supabase.from('jobs').select('*').eq('id', jobId).single(),
          supabase.from('job_parts').select('*').eq('job_id', jobId).order('created_at', { ascending: true }),
          supabase.from('job_photos').select('*').eq('job_id', jobId).order('taken_at', { ascending: true }),
          supabase.from('job_status_history').select('*').eq('job_id', jobId).order('changed_at', { ascending: true }),
        ]);
      if (jobError) throw jobError;
      if (partsError) throw partsError;
      if (photosError) throw photosError;
      if (historyError) throw historyError;
      if (!job) throw new Error('Job not found');

      const { data: workshop, error: workshopError } = await supabase
        .from('workshops')
        .select('*')
        .eq('id', job.workshop_id)
        .single();
      if (workshopError) throw workshopError;

      let technicianName = '';
      const technicianId = job.assigned_to ?? job.created_by;
      if (technicianId) {
        const { data: tech } = await supabase.from('profiles').select('full_name').eq('id', technicianId).single();
        technicianName = tech?.full_name ?? '';
      }

      const photos: JobReportPhoto[] = (photoRows ?? []).map((p: Tables<'job_photos'>) => ({
        url: supabase.storage.from('job-photos').getPublicUrl(p.storage_path).data.publicUrl,
        stage: p.stage,
        takenAt: p.taken_at,
      }));

      // Both @react-pdf/renderer and its React-tree of Document/Page/etc are
      // sizeable (~600kB+) and only ever needed on this one action, so they
      // stay out of the main bundle and load on demand here.
      const [{ pdf }, { JobReportDocument }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('@/lib/pdf/JobReportDocument'),
      ]);

      const generatedAt = new Date().toISOString();
      const blob = await pdf(
        JobReportDocument({
          workshop,
          job,
          photos,
          parts: parts ?? [],
          statusHistory: statusHistory ?? [],
          technicianName,
          signatureUrl: job.customer_signature_url,
          generatedAt,
        })
      ).toBlob();

      const base64 = await blobToBase64(blob);
      const fileName = `AfriOps-${job.vehicle_registration.replace(/\s+/g, '')}-${Date.now()}.pdf`;

      // Upload to storage so the report is retrievable later from the job record.
      const storagePath = `reports/${job.id}/${fileName}`;
      const { error: uploadError } = await supabase.storage
        .from('job-photos')
        .upload(storagePath, blob, { contentType: 'application/pdf' });
      if (uploadError) throw uploadError;
      const { data: pub } = supabase.storage.from('job-photos').getPublicUrl(storagePath);
      await supabase.from('jobs').update({ pdf_report_url: pub.publicUrl }).eq('id', job.id);
      await offlineDb.jobsCache.put({ ...job, pdf_report_url: pub.publicUrl });

      // Write to a local cache file so the native share sheet can attach the
      // actual PDF (an https URL alone won't render as a file in most share
      // targets like WhatsApp/Email).
      const written = await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Cache });
      await Share.share({
        title: `Job Report — ${job.vehicle_registration}`,
        text: `AfriOps report for ${job.vehicle_registration}`,
        url: written.uri,
        dialogTitle: 'Share job report',
      });

      haptics.success();
      push('Report generated', 'success');
      return pub.publicUrl;
    } catch (e) {
      haptics.error();
      push(e instanceof Error ? e.message : 'Could not generate report', 'error');
    } finally {
      setGenerating(false);
    }
  };

  return { generate, generating };
}
