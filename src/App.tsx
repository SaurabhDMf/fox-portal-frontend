import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, Outlet, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useAuthStore } from "@/stores/authStore";
import { usePermissionsRefresh } from "@/hooks/usePermissionsRefresh";
import { ConfirmDialogHost } from "@/lib/confirmDialog";
import { DependencyDeleteHost } from "@/lib/dependencyDelete";
import NotificationsSocketBridge from "@/hooks/useNotificationsSocket";

import Login from "./pages/Login";
import ClientLogin from "./pages/ClientLogin";
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
import SharedInbox from "./pages/admin/SharedInbox";
import InboxFormPage from "./pages/admin/InboxFormPage";
import InboxMembersPage from "./pages/admin/InboxMembersPage";
import Expenses from "./pages/admin/Expenses";
import BalanceSheet from "./pages/admin/BalanceSheet";
import Subscriptions from "./pages/admin/Subscriptions";
import Notifications from "./pages/admin/Notifications";
import InputSheet from "./pages/admin/InputSheet";
import ExpenseSheet from "./pages/admin/ExpenseSheet";

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
import CPChat from "./pages/client-portal/CPChat";
import CPSubscriptions from "./pages/client-portal/CPSubscriptions";

import NotFound from "./pages/NotFound";
import PublicInvoice from "./pages/PublicInvoice";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 3 * 60 * 1000,   // data stays fresh 3 min — no re-fetch on every mount
      gcTime:   15 * 60 * 1000,   // keep unused cache 15 min
    },
  },
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
  return <Navigate to="/client" replace />;
}

function ClientPortalChildRedirect() {
  return <Navigate to={`/client${window.location.pathname.replace(/^\/portal/, '')}${window.location.search}${window.location.hash}`} replace />;
}

// Subpath-preserving redirect: /from/anything → /to/anything (keeps query + hash)
function PathForward({ from, to }: { from: string; to: string }) {
  const location = useLocation();
  const rest = location.pathname.replace(new RegExp(`^${from}`), '');
  return <Navigate to={`${to}${rest}${location.search}${location.hash}`} replace />;
}

const App = () => (
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
      <NotificationsSocketBridge />
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/client-login" element={<ClientLogin />} />
        <Route path="/invoice/:token" element={<PublicInvoice />} />

        {/* Admin Portal — super_admin + admin only */}
        <Route path="/admin" element={<ProtectedRoute allowedRoles={['super_admin', 'admin']}><PortalLayout /></ProtectedRoute>}>
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
          <Route path="inbox" element={<SharedInbox />} />
          <Route path="inbox/new" element={<InboxFormPage />} />
          <Route path="inbox/:inboxId/settings" element={<InboxFormPage />} />
          <Route path="inbox/:inboxId/members" element={<InboxMembersPage />} />
          <Route path="tickets" element={<Tickets />} />
          <Route path="tickets/:id" element={<TicketDetail />} />
          <Route path="tracker" element={<Tracker />} />
          <Route path="payroll" element={<Payroll />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="balance-sheet" element={<BalanceSheet />} />
          <Route path="input-sheet"   element={<InputSheet />} />
          <Route path="expense-sheet" element={<ExpenseSheet />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="permissions" element={<Permissions />} />
          <Route path="roles" element={<RolesPermissions />} />
          <Route path="subscriptions" element={<Subscriptions />} />
          <Route path="notifications" element={<Notifications />} />
        </Route>

        {/* Sales Portal — sales_manager, sales_rep, presales.
            Routes mirror /admin so per-role permissions (not the URL prefix)
            decide what's visible / accessible. */}
        <Route path="/sales" element={<ProtectedRoute allowedRoles={['sales_manager', 'sales_rep', 'presales']}><PortalLayout /></ProtectedRoute>}>
          <Route index element={<AdminDashboard />} />
          <Route path="crm" element={<CRM />} />
          <Route path="crm/:id" element={<LeadDetail />} />
          <Route path="clients" element={<Clients />} />
          <Route path="clients/:id" element={<ClientDetail />} />
          <Route path="invoicing" element={<Invoicing />} />
          <Route path="chat" element={<Chat />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="vault" element={<Vault />} />
          <Route path="email" element={<EmailPage />} />
          <Route path="inbox" element={<SharedInbox />} />
          <Route path="inbox/new" element={<InboxFormPage />} />
          <Route path="inbox/:inboxId/settings" element={<InboxFormPage />} />
          <Route path="inbox/:inboxId/members" element={<InboxMembersPage />} />
          <Route path="tickets" element={<Tickets />} />
          <Route path="tickets/:id" element={<TicketDetail />} />
          <Route path="tracker" element={<Tracker />} />
          <Route path="payroll" element={<Payroll />} />
          <Route path="reports" element={<Reports />} />
          <Route path="notifications" element={<Notifications />} />
        </Route>

        {/* Team Portal (formerly /emp) */}
        <Route path="/team" element={<ProtectedRoute denyRoles={['super_admin', 'admin', 'sales_manager', 'sales_rep', 'presales', 'client']}><PortalLayout /></ProtectedRoute>}>
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
          <Route path="inbox" element={<SharedInbox />} />
          <Route path="inbox/new" element={<InboxFormPage />} />
          <Route path="inbox/:inboxId/settings" element={<InboxFormPage />} />
          <Route path="inbox/:inboxId/members" element={<InboxMembersPage />} />
          <Route path="tickets" element={<Tickets />} />
          <Route path="tickets/:id" element={<TicketDetail />} />
          <Route path="tracker" element={<Tracker />} />
          <Route path="payroll" element={<Payroll />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="profile" element={<EmpProfile />} />
          <Route path="notifications" element={<Notifications />} />
        </Route>

        {/* Client Portal (formerly /client-portal) */}
        <Route path="/client" element={<ProtectedRoute allowedRoles={['client']} loginPath="/client-login"><ClientPortalLayout /></ProtectedRoute>}>
          <Route index element={<CPDashboard />} />
          <Route path="invoices" element={<CPInvoices />} />
          <Route path="invoices/:id" element={<CPInvoiceDetail />} />
          <Route path="projects" element={<CPProjects />} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="tasks" element={<CPTasks />} />
          <Route path="chat" element={<CPChat />} />
          <Route path="documents" element={<CPDocuments />} />
          <Route path="vault" element={<CPVault />} />
          <Route path="support" element={<CPSupport />} />
          <Route path="support/:id" element={<CPTicketDetail />} />
          <Route path="profile" element={<CPProfile />} />
          <Route path="subscriptions" element={<CPSubscriptions />} />
          <Route path="notifications" element={<Notifications />} />
        </Route>

        {/* Legacy redirects — preserve old bookmarks */}
        <Route path="/emp/*" element={<PathForward from="/emp" to="/team" />} />
        <Route path="/emp" element={<PathForward from="/emp" to="/team" />} />
        <Route path="/client-portal/*" element={<PathForward from="/client-portal" to="/client" />} />
        <Route path="/client-portal" element={<PathForward from="/client-portal" to="/client" />} />
        <Route path="/portal" element={<ProtectedRoute allowedRoles={['client']} loginPath="/client-login"><Outlet /></ProtectedRoute>}>
          <Route index element={<ClientPortalRedirect />} />
          <Route path="*" element={<ClientPortalChildRedirect />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
      </PermissionsLoader>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
