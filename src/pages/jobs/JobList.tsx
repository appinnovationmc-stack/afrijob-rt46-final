import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { useWorkshopStore } from '@/store/workshopStore';
import { useJobs } from '@/hooks/useJobs';
import { StatusChip, PendingSyncBadge } from '@/components/ui/StatusChip';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { FAB } from '@/components/ui/FAB';
import { formatDate, JOB_STATUS_LABELS } from '@/lib/utils';
import { ClipboardList, Search } from 'lucide-react';
import type { Enums } from '@/types/database.types';

const FILTERS: (Enums<'job_status'> | 'all')[] = ['all', 'draft', 'in_progress', 'waiting_for_parts', 'completed', 'submitted', 'paid'];

export default function JobList() {
  const navigate = useNavigate();
  const workshop = useWorkshopStore((s) => s.activeWorkshop);
  const [filter, setFilter] = useState<Enums<'job_status'> | 'all'>('all');
  const [search, setSearch] = useState('');
  const { data: jobs, isLoading } = useJobs(workshop?.id, filter === 'all' ? undefined : filter);

  const filtered = useMemo(() => {
    if (!jobs) return [];
    if (!search.trim()) return jobs;
    const q = search.trim().toLowerCase();
    return jobs.filter((j) => j.vehicle_registration.toLowerCase().includes(q));
  }, [jobs, search]);

  return (
    <div>
      <PageHeader title="Jobs" subtitle={workshop?.name} />

      <div className="px-4 pt-4">
        <div className="relative mb-3">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Search by vehicle reg…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4 no-scrollbar">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap ${
                filter === f ? 'bg-brand text-white' : 'bg-gray-100 dark:bg-charcoal-light text-gray-600 dark:text-gray-300'
              }`}
            >
              {f === 'all' ? 'All' : JOB_STATUS_LABELS[f]}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex flex-col gap-3">
            <SkeletonCard /><SkeletonCard /><SkeletonCard />
          </div>
        ) : !filtered.length ? (
          <EmptyState icon={ClipboardList} title="No jobs found" description="Try a different filter or create a new job." />
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((job) => (
              <button
                key={job.id}
                onClick={() => navigate(`/jobs/${job.id}`)}
                className="card flex items-center justify-between text-left"
              >
                <div>
                  <p className="font-mono font-bold">{job.vehicle_registration}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(job.created_at)}</p>
                </div>
                {job._pendingSync ? <PendingSyncBadge /> : <StatusChip status={job.status} />}
              </button>
            ))}
          </div>
        )}
      </div>

      <FAB onClick={() => navigate('/jobs/new')} />
    </div>
  );
}
