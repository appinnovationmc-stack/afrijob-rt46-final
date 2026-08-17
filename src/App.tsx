import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { useWorkshopStore } from '@/store/workshopStore';
import { supabase } from '@/lib/supabase';
import { AppShell } from '@/components/layout/AppShell';
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
  const init = useAuthStore((s) => s.init);
  const profile = useAuthStore((s) => s.profile);
  const loadWorkshops = useWorkshopStore((s) => s.loadWorkshops);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    init().then((fn) => (cleanup = fn));
    return () => cleanup?.();
  }, [init]);

  // Picks up a workshop name stashed by SignUp when email confirmation was
  // required (no session was available at signup time to satisfy the RLS
  // insert check) — creates it the first time we see an authenticated
  // profile with no workshops yet.
  useEffect(() => {
    if (!profile?.id) return;
    const pendingName = localStorage.getItem('afrijob:pending-workshop-name');
    if (!pendingName) {
      loadWorkshops(profile.id);
      return;
    }
    (async () => {
      const { error } = await supabase.from('workshops').insert({ owner_id: profile.id, name: pendingName });
      localStorage.removeItem('afrijob:pending-workshop-name');
      if (error) console.error('Failed to create pending workshop', error);
      await loadWorkshops(profile.id);
    })();
  }, [profile?.id, loadWorkshops]);

  return (
    <QueryClientProvider client={queryClient}>
      <ToastViewport />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
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
            <Route path="/rt46" element={<Rt46Dashboard />} />
            <Route path="/rt46/merchants" element={<Rt46Merchants />} />
            <Route path="/rt46/work-orders" element={<Rt46WorkOrders />} />
            <Route path="/rt46/fraud-flags" element={<Rt46FraudFlags />} />
            <Route path="/rt46/compliance" element={<Rt46Compliance />} />
            <Route path="/rt46/quality" element={<Rt46Quality />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
