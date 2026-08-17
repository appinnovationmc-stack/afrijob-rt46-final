import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuthStore } from '@/store/authStore';
import { useWorkshopStore } from '@/store/workshopStore';
import { useDashboardStats, useJobs } from '@/hooks/useJobs';
import { useComplianceDocuments } from '@/hooks/useCompliance';
import { StatusChip, PendingSyncBadge } from '@/components/ui/StatusChip';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { FAB } from '@/components/ui/FAB';
import { EmptyState } from '@/components/ui/EmptyState';
import { offlineDb } from '@/lib/offlineDb';
import { formatDate } from '@/lib/utils';
import { ClipboardList, AlertTriangle, ChevronRight, X } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const profile = useAuthStore((s) => s.profile);
  const workshop = useWorkshopStore((s) => s.activeWorkshop);
  const { data: stats, isLoading: statsLoading } = useDashboardStats(workshop?.id);
  const { data: recentJobs, isLoading: jobsLoading } = useJobs(workshop?.id);
  const { data: docs } = useComplianceDocuments(workshop?.id);
  const conflicts = useLiveQuery(() => offlineDb.syncConflicts.toArray(), [], []);

  const expiringSoon = (docs ?? []).filter((d) => d.status !== 'valid');
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="px-4 pt-6">
      <div className="mb-6">
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          {greeting}, {profile?.full_name?.split(' ')[0] ?? 'there'}
        </p>
        <h1 className="font-heading font-bold text-2xl">{workshop?.name ?? 'Your Workshop'}</h1>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {statsLoading ? (
          [1, 2, 3].map((i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <div className="card text-center">
              <p className="text-2xl font-heading font-bold text-brand">{stats?.open ?? 0}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Open Jobs</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-heading font-bold text-success">{stats?.completedThisMonth ?? 0}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Paid This Month</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-heading font-bold text-warning">{stats?.pendingPayment ?? 0}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Pending Payment</p>
            </div>
          </>
        )}
      </div>

      {/* Sync conflicts — jobs edited offline that also changed on the server */}
      {!!conflicts?.length && (
        <div className="flex flex-col gap-2 mb-6">
          {conflicts.map((c) => (
            <div key={c.id} className="card border border-danger/30 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
              <button onClick={() => navigate(`/jobs/${c.jobId}`)} className="flex-1 text-left">
                <p className="text-sm font-semibold">Sync conflict — please review</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{c.message}</p>
              </button>
              <button
                onClick={() => offlineDb.syncConflicts.delete(c.id)}
                className="min-w-touch min-h-touch flex items-center justify-center text-gray-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Compliance alert */}
      {expiringSoon.length > 0 && (
        <button
          onClick={() => navigate('/compliance')}
          className="w-full card mb-6 flex items-center gap-3 border border-warning/30 text-left"
        >
          <AlertTriangle className="w-5 h-5 text-warning shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-sm">{expiringSoon.length} document{expiringSoon.length > 1 ? 's' : ''} need attention</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Expiring soon or expired</p>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </button>
      )}

      {/* Recent jobs */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-heading font-bold text-lg">Recent Jobs</h2>
        <button onClick={() => navigate('/jobs')} className="text-sm text-brand font-semibold">See all</button>
      </div>

      {jobsLoading ? (
        <div className="flex flex-col gap-3">
          <SkeletonCard /><SkeletonCard />
        </div>
      ) : !recentJobs?.length ? (
        <EmptyState
          icon={ClipboardList}
          title="No jobs yet"
          description="Tap the + button below to create your first job card."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {recentJobs.slice(0, 5).map((job) => (
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

      <FAB onClick={() => navigate('/jobs/new')} />
    </div>
  );
}
