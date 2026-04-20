import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, Outlet } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useAuthStore } from "@/stores/authStore";
import { usePermissionsRefresh } from "@/hooks/usePermissionsRefresh";
import { ConfirmDialogHost } from "@/lib/confirmDialog";
import { DependencyDeleteHost } from "@/lib/dependencyDelete";

import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import PortalLayout from "./components/layouts/PortalLayout";

// Admin
import AdminDashboard from "./pages/admin/AdminDashboard";
import CRM from "./pages/admin/CRM";
import LeadDetail from "./pages/admin/LeadDetail";
import Invoicing from "./pages/admin/Invoicing";
import Clients from "./pages/admin/Clients";
import ClientDetail from "./pages/admin/ClientDetail";
import Chat from "./pages/admin/Chat";
import Projects from "./pages/admin/Projects";
import ProjectDetail from "./pages/admin/ProjectDetail";
import Vault from "./pages/admin/Vault";
import Tickets from "./pages/admin/Tickets";
import TicketDetail from "./pages/admin/TicketDetail";
import Tracker from "./pages/admin/Tracker";
import Payroll from "./pages/admin/Payroll";
import AdminUsers from "./pages/admin/AdminUsers";
import Reports from "./pages/admin/Reports";
import AdminSettings from "./pages/admin/AdminSettings";
import Permissions from "./pages/admin/Permissions";
import RolesPermissions from "./pages/admin/RolesPermissions";
import EmailPage from "./pages/admin/Email";

// Employee
import EmpDashboard from "./pages/emp/EmpDashboard";
import EmpTasks from "./pages/emp/EmpTasks";
import EmpProfile from "./pages/emp/EmpProfile";

// New Client Portal
import ClientPortalLayout from "./components/layouts/ClientPortalLayout";
import CPDashboard from "./pages/client-portal/CPDashboard";
import CPInvoices from "./pages/client-portal/CPInvoices";
import CPInvoiceDetail from "./pages/client-portal/CPInvoiceDetail";
import CPProjects from "./pages/client-portal/CPProjects";
import CPProjectDetail from "./pages/client-portal/CPProjectDetail";
import CPDocuments from "./pages/client-portal/CPDocuments";
import CPVault from "./pages/client-portal/CPVault";
import CPSupport from "./pages/client-portal/CPSupport";
import CPTicketDetail from "./pages/client-portal/CPTicketDetail";
import CPProfile from "./pages/client-portal/CPProfile";
import CPTasks from "./pages/client-portal/CPTasks";

import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function RootRedirect() {
  const { isAuthenticated, getRedirectPath } = useAuthStore();
  if (isAuthenticated) return <Navigate to={getRedirectPath()} replace />;
  return <Navigate to="/login" replace />;
}

function PermissionsLoader({ children }: { children: React.ReactNode }) {
  usePermissionsRefresh();
  return <>{children}</>;
}

function ClientPortalRedirect() {
  return <Navigate to="/client-portal" replace />;
}

function ClientPortalChildRedirect() {
  return <Navigate to={`/client-portal${window.location.pathname.replace(/^\/portal/, '')}${window.location.search}${window.location.hash}`} replace />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <Toaster
      position="top-center"
      toastOptions={{
        className: '!bg-card !text-foreground !border !border-border !text-sm',
      }}
    />
    <ConfirmDialogHost />
    <DependencyDeleteHost />
    <BrowserRouter>
      <PermissionsLoader>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<Login />} />

        {/* Admin Portal */}
        <Route path="/admin" element={<ProtectedRoute allowedRoles={['super_admin', 'admin', 'sales_manager', 'sales_rep']}><PortalLayout /></ProtectedRoute>}>
          <Route index element={<AdminDashboard />} />
          <Route path="crm" element={<CRM />} />
          <Route path="crm/:id" element={<LeadDetail />} />
          <Route path="invoicing" element={<Invoicing />} />
          <Route path="clients" element={<Clients />} />
          <Route path="clients/:id" element={<ClientDetail />} />
          <Route path="chat" element={<Chat />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="vault" element={<Vault />} />
          <Route path="email" element={<EmailPage />} />
          <Route path="tickets" element={<Tickets />} />
          <Route path="tickets/:id" element={<TicketDetail />} />
          <Route path="tracker" element={<Tracker />} />
          <Route path="payroll" element={<Payroll />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="permissions" element={<Permissions />} />
          <Route path="roles" element={<RolesPermissions />} />
        </Route>

        {/* Employee Portal */}
        <Route path="/emp" element={<ProtectedRoute denyRoles={['super_admin', 'admin', 'sales_manager', 'sales_rep', 'client']}><PortalLayout /></ProtectedRoute>}>
          <Route index element={<EmpDashboard />} />
          <Route path="tasks" element={<EmpTasks />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="crm" element={<CRM />} />
          <Route path="crm/:id" element={<LeadDetail />} />
          <Route path="invoicing" element={<Invoicing />} />
          <Route path="chat" element={<Chat />} />
          <Route path="vault" element={<Vault />} />
          <Route path="email" element={<EmailPage />} />
          <Route path="tickets" element={<Tickets />} />
          <Route path="tickets/:id" element={<TicketDetail />} />
          <Route path="tracker" element={<Tracker />} />
          <Route path="payroll" element={<Payroll />} />
          <Route path="profile" element={<EmpProfile />} />
        </Route>

        {/* Legacy Client Portal (redirect) */}
        <Route path="/portal" element={<ProtectedRoute allowedRoles={['client']}><Outlet /></ProtectedRoute>}>
          <Route index element={<ClientPortalRedirect />} />
          <Route path="*" element={<ClientPortalChildRedirect />} />
        </Route>

        {/* New Client Portal */}
        <Route path="/client-portal" element={<ProtectedRoute allowedRoles={['client']}><ClientPortalLayout /></ProtectedRoute>}>
          <Route index element={<CPDashboard />} />
          <Route path="invoices" element={<CPInvoices />} />
          <Route path="invoices/:id" element={<CPInvoiceDetail />} />
          <Route path="projects" element={<CPProjects />} />
          <Route path="projects/:id" element={<CPProjectDetail />} />
          <Route path="tasks" element={<CPTasks />} />
          <Route path="documents" element={<CPDocuments />} />
          <Route path="vault" element={<CPVault />} />
          <Route path="support" element={<CPSupport />} />
          <Route path="support/:id" element={<CPTicketDetail />} />
          <Route path="profile" element={<CPProfile />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
      </PermissionsLoader>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
