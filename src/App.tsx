import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { useWorkshopStore } from '@/store/workshopStore';
import { supabase } from '@/lib/supabase';
import { createOrganisationAndWorkshop } from '@/lib/organisations';
import { AppShell } from '@/components/layout/AppShell';
import { Rt46AdminGuard } from '@/components/layout/Rt46AdminGuard';
import { ToastViewport } from '@/components/ui/Toast';
import Login from '@/pages/auth/Login';
import SignUp from '@/pages/auth/SignUp';
import Dashboard from '@/pages/Dashboard';
import JobList from '@/pages/jobs/JobList';
import NewJob from '@/pages/jobs/NewJob';
import JobDetail from '@/pages/jobs/JobDetail';
import ComplianceVault from '@/pages/compliance/ComplianceVault';
import Profile from '@/pages/profile/Profile';
import Rt46Dashboard from '@/pages/rt46/Rt46Dashboard';
import Rt46Merchants from '@/pages/rt46/Rt46Merchants';
import Rt46WorkOrders from '@/pages/rt46/Rt46WorkOrders';
import Rt46FraudFlags from '@/pages/rt46/Rt46FraudFlags';
import Rt46Compliance from '@/pages/rt46/Rt46Compliance';
import Rt46Quality from '@/pages/rt46/Rt46Quality';
import OpsDashboard from '@/pages/ops/OpsDashboard';
import WorkOrderList from '@/pages/ops/WorkOrderList';
import WorkOrderDetail from '@/pages/ops/WorkOrderDetail';
import Inventory from '@/pages/ops/Inventory';
import Procurement from '@/pages/ops/Procurement';
import DocumentVault from '@/pages/ops/DocumentVault';
import Incidents from '@/pages/ops/Incidents';
import MaintenanceSchedules from '@/pages/ops/MaintenanceSchedules';
import SlaDashboard from '@/pages/ops/SlaDashboard';
import OpsNotifications from '@/pages/ops/Notifications';
import AssetRegistry from '@/pages/ops/admin/AssetRegistry';
import ServiceProviders from '@/pages/ops/admin/ServiceProviders';
import OrgSettings from '@/pages/ops/admin/OrgSettings';
import Billing from '@/pages/ops/admin/Billing';
import PermissionMatrix from '@/pages/ops/admin/PermissionMatrix';
import Team from '@/pages/ops/admin/Team';
import AuditLog from '@/pages/ops/admin/AuditLog';
import SuperAdmin from '@/pages/ops/admin/SuperAdmin';
import AssetDetail from '@/pages/ops/admin/AssetDetail';
import AcceptInvite, { getPendingInviteToken } from '@/pages/auth/AcceptInvite';
import { useAcceptInvitation } from '@/hooks/useTeam';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuthStore();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>;
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

// Split out from App so every hook here (useAcceptInvitation in
// particular, which calls useMutation internally) runs *inside*
// QueryClientProvider rather than during App's own render, before the
// provider exists. Calling a react-query hook before its provider is
// mounted throws immediately on render — with no error boundary in this
// app, that showed up as a blank white screen with no visible error.
function AppContent() {
  const init = useAuthStore((s) => s.init);
  const profile = useAuthStore((s) => s.profile);
  const loadWorkshops = useWorkshopStore((s) => s.loadWorkshops);
  const acceptInvitation = useAcceptInvitation();

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    init().then((fn) => (cleanup = fn));
    return () => cleanup?.();
  }, [init]);

  // Picks up a workshop name stashed by SignUp when email confirmation was
  // required (no session was available at signup time to satisfy the RLS
  // insert check) — creates it the first time we see an authenticated
  // profile with no workshops yet. Also picks up a pending invite token
  // stashed by AcceptInvite.tsx for the same reason (signup needed to
  // happen first) so the person doesn't have to reopen the invite link.
  useEffect(() => {
    if (!profile?.id) return;
    const pendingInviteToken = getPendingInviteToken();
    if (pendingInviteToken) {
      acceptInvitation.mutate(pendingInviteToken, {
        onSettled: () => localStorage.removeItem('afrijob:pending-invite-token'),
      });
    }
    const pendingName = localStorage.getItem('afrijob:pending-workshop-name');
    if (!pendingName) {
      loadWorkshops(profile.id);
      return;
    }
    (async () => {
      try {
        await createOrganisationAndWorkshop(supabase, profile.id, pendingName);
      } catch (error) {
        console.error('Failed to create pending workshop', error);
      }
      localStorage.removeItem('afrijob:pending-workshop-name');
      await loadWorkshops(profile.id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, loadWorkshops]);

  return (
    <>
      <ToastViewport />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/accept-invite" element={<AcceptInvite />} />
          <Route
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/jobs" element={<JobList />} />
            <Route path="/jobs/new" element={<NewJob />} />
            <Route path="/jobs/:jobId" element={<JobDetail />} />
            <Route path="/compliance" element={<ComplianceVault />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/rt46" element={<Rt46AdminGuard />}>
              <Route index element={<Rt46Dashboard />} />
              <Route path="merchants" element={<Rt46Merchants />} />
              <Route path="work-orders" element={<Rt46WorkOrders />} />
              <Route path="fraud-flags" element={<Rt46FraudFlags />} />
              <Route path="compliance" element={<Rt46Compliance />} />
              <Route path="quality" element={<Rt46Quality />} />
            </Route>
            <Route path="/ops" element={<OpsDashboard />} />
            <Route path="/ops/inventory" element={<Inventory />} />
            <Route path="/ops/procurement" element={<Procurement />} />
            <Route path="/ops/documents" element={<DocumentVault />} />
            <Route path="/ops/incidents" element={<Incidents />} />
            <Route path="/ops/maintenance" element={<MaintenanceSchedules />} />
            <Route path="/ops/sla" element={<SlaDashboard />} />
            <Route path="/ops/notifications" element={<OpsNotifications />} />
            <Route path="/ops/work-orders" element={<WorkOrderList />} />
            <Route path="/ops/work-orders/:workOrderId" element={<WorkOrderDetail />} />
            <Route path="/ops/admin/assets" element={<AssetRegistry />} />
            <Route path="/ops/admin/assets/:assetId" element={<AssetDetail />} />
            <Route path="/ops/admin/service-providers" element={<ServiceProviders />} />
            <Route path="/ops/admin/settings" element={<OrgSettings />} />
            <Route path="/ops/admin/billing" element={<Billing />} />
            <Route path="/ops/admin/permissions" element={<PermissionMatrix />} />
            <Route path="/ops/admin/team" element={<Team />} />
            <Route path="/ops/admin/audit" element={<AuditLog />} />
            <Route path="/ops/admin/super-admin" element={<SuperAdmin />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}
