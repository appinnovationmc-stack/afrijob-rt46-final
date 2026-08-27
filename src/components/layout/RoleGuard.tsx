import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useOrganisation } from '@/hooks/useOrganisation';
import type { OrganisationRole } from '@/lib/afriops/types';
import { SkeletonCard } from '@/components/ui/SkeletonCard';

export function RoleGuard({ roles }: { roles: OrganisationRole[] }) {
  const { data: org, isLoading } = useOrganisation();
  const location = useLocation();

  if (isLoading) {
    return <div className="px-4 pt-6"><SkeletonCard /></div>;
  }

  if (!org) return <Navigate to="/" replace />;

  if (!roles.includes(org.role)) {
    return <Navigate to="/ops" state={{ from: location.pathname }} replace />;
  }

  return <Outlet />;
}
