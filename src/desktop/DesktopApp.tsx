import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useAuthStore } from "@/stores/authStore";
import { usePermissionsRefresh } from "@/hooks/usePermissionsRefresh";
import { ConfirmDialogHost } from "@/lib/confirmDialog";
import { DependencyDeleteHost } from "@/lib/dependencyDelete";

import ProtectedRoute from "@/components/ProtectedRoute";
import DesktopLogin from "./DesktopLogin";
import DesktopLayout from "./DesktopLayout";

import CRM from "@/pages/admin/CRM";
import LeadDetail from "@/pages/admin/LeadDetail";
import Invoicing from "@/pages/admin/Invoicing";
import Vault from "@/pages/admin/Vault";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 3 * 60 * 1000,
      gcTime: 15 * 60 * 1000,
    },
  },
});

function RootRedirect() {
  const { isAuthenticated } = useAuthStore();
  return <Navigate to={isAuthenticated ? "/app" : "/login"} replace />;
}

function PermissionsLoader({ children }: { children: React.ReactNode }) {
  usePermissionsRefresh();
  return <>{children}</>;
}

const DesktopApp = () => (
  <QueryClientProvider client={queryClient}>
    <Toaster
      position="top-center"
      toastOptions={{
        style: { background: 'transparent', boxShadow: 'none', padding: 0, maxWidth: '100%' },
        className: '',
      }}
    />
    <ConfirmDialogHost />
    <DependencyDeleteHost />
    <BrowserRouter>
      <PermissionsLoader>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<DesktopLogin />} />

          <Route path="/app" element={<ProtectedRoute><DesktopLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="crm" replace />} />
            <Route path="crm" element={<CRM />} />
            <Route path="crm/:id" element={<LeadDetail />} />
            <Route path="invoicing" element={<Invoicing />} />
            <Route path="vault" element={<Vault />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </PermissionsLoader>
    </BrowserRouter>
  </QueryClientProvider>
);

export default DesktopApp;
