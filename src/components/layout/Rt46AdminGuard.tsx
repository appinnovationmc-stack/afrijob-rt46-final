import { Outlet } from 'react-router-dom';
import { Landmark } from 'lucide-react';
import { useIsRt46Admin } from '@/hooks/useRt46';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCard } from '@/components/ui/SkeletonCard';

// Every /rt46/* route is a National Treasury program-administrator back
// office — a different persona from the workshop user the rest of the app
// serves. Guarding it once here (rather than per-page) means a sub-page can
// never be reached by URL without the check running first.
export function Rt46AdminGuard() {
  const { data: isAdmin, isLoading } = useIsRt46Admin();

  if (isLoading) {
    return (
      <div className="px-4 pt-6">
        <SkeletonCard />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="px-4 pt-6">
        <EmptyState
          icon={Landmark}
          title="RT46 admin access required"
          description="Your account isn't registered as an RT46 program administrator. Contact National Treasury program support if you believe this is incorrect."
        />
      </div>
    );
  }

  return <Outlet />;
}
