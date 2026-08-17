import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { isLocalId } from '@/lib/offlineDb';
import { JOB_STATUS_LABELS, formatDate } from '@/lib/utils';
import { CheckCircle2 } from 'lucide-react';

export function StatusTimeline({ jobId }: { jobId: string }) {
  const { data: history } = useQuery({
    queryKey: ['job-status-history', jobId],
    enabled: !isLocalId(jobId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_status_history')
        .select('*')
        .eq('job_id', jobId)
        .order('changed_at', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  if (!history?.length) return null;

  return (
    <div className="card">
      <h3 className="font-heading font-bold mb-3">Status Timeline</h3>
      <div className="flex flex-col gap-3">
        {history.map((h) => (
          <div key={h.id} className="flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 text-brand mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">{JOB_STATUS_LABELS[h.to_status]}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(h.changed_at)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
