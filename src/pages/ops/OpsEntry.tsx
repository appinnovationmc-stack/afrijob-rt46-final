import { useOrganisation } from '@/hooks/useOrganisation';
import TechnicianDashboard from '@/pages/ops/TechnicianDashboard';
import OperationsManagerDashboard from '@/pages/ops/OperationsManagerDashboard';
import ProcurementDashboard from '@/pages/ops/ProcurementDashboard';
import ComplianceDashboard from '@/pages/ops/ComplianceDashboard';
import OrgAdminDashboard from '@/pages/ops/OrgAdminDashboard';
import ExecutiveDashboard from '@/pages/ops/ExecutiveDashboard';
import RoleWorkspace from '@/pages/ops/RoleWorkspace';
import { SkeletonCard } from '@/components/ui/SkeletonCard';

export default function OpsEntry() {
  const { data: org, isLoading } = useOrganisation();
  if (isLoading) return <div className="px-4 pt-6"><SkeletonCard /></div>;
  if (!org) return null;

  switch (org.role) {
    case 'technician': return <TechnicianDashboard />;
    case 'operations_manager': return <OperationsManagerDashboard />;
    case 'procurement_officer': return <ProcurementDashboard />;
    case 'inspector': return <ComplianceDashboard />;
    case 'admin': return <OrgAdminDashboard />;
    case 'owner': return <ExecutiveDashboard />;
    default: return <RoleWorkspace />;
  }
}
