import { FileText, Loader2, ExternalLink } from 'lucide-react';
import { useJobReport } from '@/hooks/useJobReport';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import type { DisplayJob } from '@/hooks/useJobs';

export function JobReportButton({ job }: { job: DisplayJob }) {
  const online = useNetworkStatus();
  const { generate, generating } = useJobReport(job.id);

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-1">
        <FileText className="w-4 h-4 text-brand" />
        <h3 className="font-heading font-bold">Job Report</h3>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Generate a branded PDF with vehicle details, photos, parts, labour and sign-off — ready to share with the customer or fleet manager.
      </p>
      <button
        onClick={generate}
        disabled={generating || !online}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
        {generating ? 'Generating…' : online ? 'Generate & Share Report' : 'Offline — connect to generate'}
      </button>
      {job.pdf_report_url && (
        <a
          href={job.pdf_report_url}
          target="_blank"
          rel="noreferrer"
          className="mt-2 flex items-center justify-center gap-1.5 text-xs font-semibold text-brand"
        >
          View last generated report
          <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  );
}
