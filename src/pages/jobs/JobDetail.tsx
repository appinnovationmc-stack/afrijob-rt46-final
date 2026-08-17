import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatusChip, PendingSyncBadge } from '@/components/ui/StatusChip';
import { PhotoGrid } from '@/components/jobs/PhotoGrid';
import { StatusTimeline } from '@/components/jobs/StatusTimeline';
import { PartsAndLabour } from '@/components/jobs/PartsAndLabour';
import { SignaturePad } from '@/components/jobs/SignaturePad';
import { JobReportButton } from '@/components/jobs/JobReportButton';
import { useJob, useJobPhotos, useUpdateJob } from '@/hooks/useJobs';
import { useToastStore } from '@/components/ui/Toast';
import { formatDate, JOB_TYPE_LABELS, JOB_STATUS_LABELS } from '@/lib/utils';
import { isLocalId } from '@/lib/offlineDb';
import { haptics } from '@/lib/haptics';
import { Share2 } from 'lucide-react';
import { Share } from '@capacitor/share';
import type { Enums } from '@/types/database.types';

const STATUS_FLOW: Enums<'job_status'>[] = ['draft', 'in_progress', 'waiting_for_parts', 'completed', 'submitted', 'paid'];

export default function JobDetail() {
  const { jobId } = useParams<{ jobId: string }>();
  const { data: job, isLoading } = useJob(jobId);
  const { data: photos } = useJobPhotos(jobId);
  const updateJob = useUpdateJob();
  const push = useToastStore((s) => s.push);
  const [tab, setTab] = useState<'before' | 'during' | 'after'>('before');

  if (isLoading || !job) {
    return (
      <div>
        <PageHeader title="Job" onBack />
        <div className="px-4 py-6 text-gray-400 text-sm">Loading…</div>
      </div>
    );
  }

  const currentIndex = STATUS_FLOW.indexOf(job.status);
  const nextStatus = STATUS_FLOW[currentIndex + 1];

  const advanceStatus = async () => {
    if (!nextStatus) return;
    try {
      await updateJob.mutateAsync({
        id: job.id,
        updates: {
          status: nextStatus,
          submitted_at: nextStatus === 'submitted' ? new Date().toISOString() : job.submitted_at,
          paid_at: nextStatus === 'paid' ? new Date().toISOString() : job.paid_at,
        },
      });
      haptics.success();
      push(`Job marked as ${JOB_STATUS_LABELS[nextStatus]}`, 'success');
    } catch (e) {
      haptics.error();
      push(e instanceof Error ? e.message : 'Failed to update status', 'error');
    }
  };

  const shareJob = async () => {
    await Share.share({
      title: `Job Card — ${job.vehicle_registration}`,
      text: `${job.vehicle_registration} — ${JOB_TYPE_LABELS[job.job_type]} — ${JOB_STATUS_LABELS[job.status]}`,
    });
  };

  return (
    <div>
      <PageHeader
        title={job.vehicle_registration}
        subtitle={JOB_TYPE_LABELS[job.job_type]}
        onBack
        right={
          <button onClick={shareJob} className="min-w-touch min-h-touch flex items-center justify-center">
            <Share2 className="w-5 h-5" />
          </button>
        }
      />

      <div className="px-4 py-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusChip status={job.status} />
            {job._pendingSync && <PendingSyncBadge />}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Created {formatDate(job.created_at)}</p>
        </div>

        {/* Vehicle details */}
        <div className="card">
          <h3 className="font-heading font-bold mb-3">Vehicle Details</h3>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-gray-500 dark:text-gray-400">Make / Model</dt>
            <dd className="text-right">{[job.vehicle_make, job.vehicle_model].filter(Boolean).join(' ') || '—'}</dd>
            <dt className="text-gray-500 dark:text-gray-400">Colour</dt>
            <dd className="text-right">{job.vehicle_colour || '—'}</dd>
            <dt className="text-gray-500 dark:text-gray-400">Odometer</dt>
            <dd className="text-right">{job.odometer ? `${job.odometer.toLocaleString()} km` : '—'}</dd>
            <dt className="text-gray-500 dark:text-gray-400">VIN</dt>
            <dd className="text-right font-mono text-xs">{job.vehicle_vin || '—'}</dd>
          </dl>
          {job.description && (
            <>
              <hr className="my-3 border-gray-100 dark:border-gray-800" />
              <p className="text-sm">{job.description}</p>
            </>
          )}
        </div>

        {/* Photos */}
        <div className="card">
          <h3 className="font-heading font-bold mb-3">Photos</h3>
          <div className="flex gap-2 mb-3">
            {(['before', 'during', 'after'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setTab(s)}
                className={`flex-1 rounded-lg py-2 text-sm font-semibold capitalize ${
                  tab === s ? 'bg-brand text-white' : 'bg-gray-100 dark:bg-charcoal-light text-gray-500'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <PhotoGrid jobId={job.id} stage={tab} photos={photos ?? []} />
        </div>

        {/* Parts, labour, signature and the PDF report all need a real
            (synced) job id — job_parts has a foreign key to jobs.id, and a
            report/signature generated against a local:… id would be
            orphaned the moment the job syncs and gets its real id. */}
        {isLocalId(job.id) ? (
          <div className="card border border-dashed border-gray-300 dark:border-gray-700 text-center py-6">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              This job will sync automatically once you're back online. Parts, labour, signature and the PDF report unlock right after.
            </p>
          </div>
        ) : (
          <>
            <PartsAndLabour jobId={job.id} labourHours={job.labour_hours} />
            <SignaturePad jobId={job.id} existingUrl={job.customer_signature_url} />
            <JobReportButton job={job} />
          </>
        )}

        <StatusTimeline jobId={job.id} />

        {nextStatus && (
          <button onClick={advanceStatus} disabled={updateJob.isPending} className="btn-primary">
            {updateJob.isPending ? 'Updating…' : `Mark as ${JOB_STATUS_LABELS[nextStatus]}`}
          </button>
        )}
      </div>
    </div>
  );
}
