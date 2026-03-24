import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useAuthStore } from "@/stores/authStore";

import Login from "./pages/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import PortalLayout from "./components/layouts/PortalLayout";

// Super Admin
import SADashboard from "./pages/sa/SADashboard";
import SAOrganizations from "./pages/sa/SAOrganizations";
import SAUsers from "./pages/sa/SAUsers";
import SAPlans from "./pages/sa/SAPlans";
import SAAuditLog from "./pages/sa/SAAuditLog";
import SAPermissions from "./pages/sa/SAPermissions";
import SAProfile from "./pages/sa/SAProfile";

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

// Employee
import EmpDashboard from "./pages/emp/EmpDashboard";
import EmpTasks from "./pages/emp/EmpTasks";
import EmpProfile from "./pages/emp/EmpProfile";

// Client Portal
import ClientDashboard from "./pages/portal/ClientDashboard";
import ClientInvoices from "./pages/portal/ClientInvoices";
import ClientProjects from "./pages/portal/ClientProjects";
import ClientDocuments from "./pages/portal/ClientDocuments";
import ClientSupport from "./pages/portal/ClientSupport";

import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function RootRedirect() {
  const { isAuthenticated, getRedirectPath } = useAuthStore();
  if (isAuthenticated) return <Navigate to={getRedirectPath()} replace />;
  return <Navigate to="/login" replace />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <Toaster
      position="top-right"
      toastOptions={{
        className: '!bg-card !text-foreground !border !border-border !text-sm',
      }}
    />
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<Login />} />

        {/* Super Admin Portal */}
        <Route path="/sa" element={<ProtectedRoute allowedRoles={['super_admin']}><PortalLayout /></ProtectedRoute>}>
          <Route index element={<SADashboard />} />
          <Route path="organizations" element={<SAOrganizations />} />
          <Route path="users" element={<SAUsers />} />
          <Route path="plans" element={<SAPlans />} />
          <Route path="audit-log" element={<SAAuditLog />} />
          <Route path="permissions" element={<SAPermissions />} />
        </Route>

        {/* Admin Portal */}
        <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin', 'sales_manager', 'sales_rep']}><PortalLayout /></ProtectedRoute>}>
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
          <Route path="tickets" element={<Tickets />} />
          <Route path="tickets/:id" element={<TicketDetail />} />
          <Route path="tracker" element={<Tracker />} />
          <Route path="payroll" element={<Payroll />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>

        {/* Employee Portal */}
        <Route path="/emp" element={<ProtectedRoute allowedRoles={['resource', 'freelancer']}><PortalLayout /></ProtectedRoute>}>
          <Route index element={<EmpDashboard />} />
          <Route path="tasks" element={<EmpTasks />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="chat" element={<Chat />} />
          <Route path="tracker" element={<Tracker />} />
          <Route path="payroll" element={<Payroll />} />
          <Route path="profile" element={<EmpProfile />} />
        </Route>

        {/* Client Portal */}
        <Route path="/portal" element={<ProtectedRoute allowedRoles={['client']}><PortalLayout /></ProtectedRoute>}>
          <Route index element={<ClientDashboard />} />
          <Route path="invoices" element={<ClientInvoices />} />
          <Route path="projects" element={<ClientProjects />} />
          <Route path="documents" element={<ClientDocuments />} />
          <Route path="messages" element={<Chat />} />
          <Route path="support" element={<ClientSupport />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
