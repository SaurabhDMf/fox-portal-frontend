import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useSidebarCollapsed } from './PortalLayout';
import {
  LayoutDashboard, Users, Building2, CreditCard, MessageSquare, FolderKanban,
  FileText, Shield, Clock, Wallet, BarChart3, Settings, Lock, Ticket,
  ChevronLeft, LogOut, ListChecks, Activity, BookOpen, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import ThemeLogo from '@/components/ThemeLogo';

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  module?: string;
}

const saNav: NavItem[] = [
  { label: 'Dashboard', path: '/sa', icon: LayoutDashboard },
  { label: 'Organizations', path: '/sa/organizations', icon: Building2 },
  { label: 'Users', path: '/sa/users', icon: Users },
  { label: 'Plans', path: '/sa/plans', icon: CreditCard },
  { label: 'Audit Log', path: '/sa/audit-log', icon: Activity },
  { label: 'Permissions', path: '/sa/permissions', icon: Shield },
];

const adminNav: NavItem[] = [
  { label: 'Dashboard', path: '/admin', icon: LayoutDashboard },
  { label: 'CRM', path: '/admin/crm', icon: Users, module: 'crm' },
  { label: 'Invoicing', path: '/admin/invoicing', icon: FileText, module: 'invoicing' },
  { label: 'Clients', path: '/admin/clients', icon: Building2, module: 'clients' },
  { label: 'Chat', path: '/admin/chat', icon: MessageSquare, module: 'chat' },
  { label: 'Projects', path: '/admin/projects', icon: FolderKanban, module: 'projects' },
  { label: 'Vault', path: '/admin/vault', icon: Lock, module: 'vault' },
  { label: 'Tickets', path: '/admin/tickets', icon: Ticket, module: 'tickets' },
  { label: 'Tracker', path: '/admin/tracker', icon: Clock, module: 'tracker' },
  { label: 'Payroll', path: '/admin/payroll', icon: Wallet, module: 'payroll' },
  { label: 'Users', path: '/admin/users', icon: Users, module: 'users' },
  { label: 'Reports', path: '/admin/reports', icon: BarChart3, module: 'reports' },
  { label: 'Settings', path: '/admin/settings', icon: Settings },
];

const empNav: NavItem[] = [
  { label: 'Dashboard', path: '/emp', icon: LayoutDashboard },
  { label: 'Tasks', path: '/emp/tasks', icon: ListChecks },
  { label: 'Projects', path: '/emp/projects', icon: FolderKanban },
  { label: 'Chat', path: '/emp/chat', icon: MessageSquare },
  { label: 'Tracker', path: '/emp/tracker', icon: Clock },
  { label: 'Payroll', path: '/emp/payroll', icon: Wallet },
  { label: 'Profile', path: '/emp/profile', icon: Users },
];

const portalNav: NavItem[] = [
  { label: 'Dashboard', path: '/portal', icon: LayoutDashboard },
  { label: 'Invoices', path: '/portal/invoices', icon: FileText },
  { label: 'Projects', path: '/portal/projects', icon: FolderKanban },
  { label: 'Documents', path: '/portal/documents', icon: BookOpen },
  { label: 'Messages', path: '/portal/messages', icon: MessageSquare },
  { label: 'Support', path: '/portal/support', icon: Ticket },
];

function getNavItems(role: string): NavItem[] {
  switch (role) {
    case 'super_admin': return saNav;
    case 'admin':
    case 'sales_manager':
    case 'sales_rep': return adminNav;
    case 'resource':
    case 'freelancer': return empNav;
    case 'client': return portalNav;
    default: return [];
  }
}

const rootPaths = ['/sa', '/admin', '/emp', '/portal'];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function AppSidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const { user, permissions, logout, refreshToken } = useAuthStore();
  const { collapsed, setCollapsed } = useSidebarCollapsed();
  const location = useLocation();
  const navigate = useNavigate();
  const role = user?.role || '';
  const navItems = getNavItems(role);

  const visibleItems = navItems.filter((item) => {
    if (!item.module) return true;
    const perm = permissions[item.module];
    return !perm || perm.can_view;
  });

  const handleLogout = async () => {
    try { await api.post('/auth/logout', { refreshToken }); } catch {}
    logout();
    toast.success('Logged out');
    navigate('/login');
  };

  const isItemActive = (path: string) =>
    location.pathname === path || (!rootPaths.includes(path) && location.pathname.startsWith(path));

  const renderNavItems = (showLabels: boolean, onClick?: () => void) =>
    visibleItems.map((item) => {
      const active = isItemActive(item.path);
      return (
        <NavLink
          key={item.path}
          to={item.path}
          end={rootPaths.includes(item.path)}
          onClick={onClick}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
            active
              ? 'bg-primary/15 text-primary font-medium'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
          }`}
          title={item.label}
        >
          <item.icon className={`h-4 w-4 flex-shrink-0 ${active ? 'text-primary' : ''}`} />
          {showLabels && <span className="truncate">{item.label}</span>}
        </NavLink>
      );
    });

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex flex-col fixed left-0 top-0 h-screen bg-[hsl(var(--sidebar-background))] border-r border-border z-40 transition-all duration-300 ${
          collapsed ? 'w-16' : 'w-60'
        }`}
      >
        <div className="flex items-center justify-between h-14 px-3 border-b border-border flex-shrink-0">
          {!collapsed ? (
            <div className="flex items-center gap-2 min-w-0">
              <ThemeLogo className="h-7 flex-shrink-0" />
            </div>
          ) : (
            <ThemeLogo className="h-6 flex-shrink-0" />
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className={`h-4 w-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {renderNavItems(!collapsed)}
        </nav>

        <div className="border-t border-border p-3 flex-shrink-0">
          {!collapsed && (
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                {user?.full_name?.[0] || 'U'}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{user?.full_name}</div>
                <div className="text-xs text-muted-foreground truncate capitalize">{user?.role?.replace('_', ' ')}</div>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Mobile slide-over */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={onMobileClose} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-[hsl(var(--sidebar-background))] border-r border-border flex flex-col animate-slide-up">
            <div className="flex items-center justify-between h-14 px-3 border-b border-border flex-shrink-0">
              <div className="flex items-center gap-2">
                <ThemeLogo className="h-7" />
              </div>
              <button onClick={onMobileClose} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
              {renderNavItems(true, onMobileClose)}
            </nav>
            <div className="border-t border-border p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                  {user?.full_name?.[0] || 'U'}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{user?.full_name}</div>
                  <div className="text-xs text-muted-foreground truncate capitalize">{user?.role?.replace('_', ' ')}</div>
                </div>
              </div>
              <button onClick={handleLogout} className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all">
                <LogOut className="h-4 w-4" /><span>Logout</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[hsl(var(--sidebar-background))] border-t border-border z-40 flex items-center justify-around px-1 py-1.5">
        {visibleItems.slice(0, 5).map((item) => {
          const active = isItemActive(item.path);
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={rootPaths.includes(item.path)}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] transition-colors ${
                active ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </>
  );
}
