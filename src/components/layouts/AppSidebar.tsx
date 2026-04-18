import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useSidebarCollapsed } from './PortalLayout';
import {
  LayoutDashboard, Users, Building2, MessageSquare, FolderKanban,
  FileText, Shield, Clock, Wallet, BarChart3, Settings, Lock, Ticket,
  ChevronLeft, LogOut, ListChecks, BookOpen, X, Mail
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

const adminNav: NavItem[] = [
  { label: 'Dashboard', path: '/admin', icon: LayoutDashboard },
  { label: 'CRM', path: '/admin/crm', icon: Users, module: 'crm' },
  { label: 'Invoicing', path: '/admin/invoicing', icon: FileText, module: 'invoicing' },
  { label: 'Clients', path: '/admin/clients', icon: Building2, module: 'clients' },
  { label: 'Chat', path: '/admin/chat', icon: MessageSquare, module: 'chat' },
  { label: 'Projects', path: '/admin/projects', icon: FolderKanban, module: 'projects' },
  { label: 'Vault', path: '/admin/vault', icon: Lock, module: 'vault' },
  { label: 'Email', path: '/admin/email', icon: Mail, module: 'email' },
  { label: 'Tickets', path: '/admin/tickets', icon: Ticket, module: 'tickets' },
  { label: 'Tracker', path: '/admin/tracker', icon: Clock, module: 'tracker' },
  { label: 'Payroll', path: '/admin/payroll', icon: Wallet, module: 'payroll' },
  { label: 'Users', path: '/admin/users', icon: Users, module: 'users' },
  { label: 'Reports', path: '/admin/reports', icon: BarChart3, module: 'reports' },
  { label: 'Settings', path: '/admin/settings', icon: Settings },
];

const empNav: NavItem[] = [
  { label: 'Dashboard', path: '/emp', icon: LayoutDashboard },
  { label: 'Projects', path: '/emp/projects', icon: FolderKanban, module: 'projects' },
  { label: 'CRM', path: '/emp/crm', icon: Users, module: 'crm' },
  { label: 'Invoicing', path: '/emp/invoicing', icon: FileText, module: 'invoicing' },
  { label: 'Chat', path: '/emp/chat', icon: MessageSquare, module: 'chat' },
  { label: 'Vault', path: '/emp/vault', icon: Lock, module: 'vault' },
  { label: 'Email', path: '/emp/email', icon: Mail, module: 'email' },
  { label: 'Tickets', path: '/emp/tickets', icon: Ticket, module: 'tickets' },
  { label: 'Tracker', path: '/emp/tracker', icon: Clock, module: 'tracker' },
  { label: 'Payroll', path: '/emp/payroll', icon: Wallet, module: 'payroll' },
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
  const adminRoles = ['super_admin', 'admin', 'sales_manager', 'sales_rep'];
  const clientRoles = ['client'];
  if (adminRoles.includes(role)) return adminNav;
  if (clientRoles.includes(role)) return portalNav;
  // All other roles (resource, freelancer, custom roles) → employee nav
  return empNav;
}

const rootPaths = ['/admin', '/emp', '/portal'];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function AppSidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const { user, permissions, enabledModules, logout, refreshToken } = useAuthStore();
  const { collapsed, setCollapsed } = useSidebarCollapsed();
  const location = useLocation();
  const navigate = useNavigate();
  const role = user?.role || '';
  const navItems = getNavItems(role);

  const visibleItems = navItems.filter((item) => {
    // Always show items without a module key (Dashboard, Settings, Profile)
    if (!item.module) return true;

    // Strictly filter by enabled_modules — if the array exists, module MUST be in it
    if (enabledModules && enabledModules.length > 0) {
      if (!enabledModules.includes(item.module)) return false;
    }

    // Also check can_view permission — hide if explicitly denied
    if (permissions && Object.keys(permissions).length > 0) {
      const mp = permissions[item.module];
      if (!mp || !mp.can_view) return false;
    }

    return true;
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
        <NavLink key={item.path} to={item.path} end={rootPaths.includes(item.path)} onClick={onClick}
          className={`group relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
            active ? 'bg-primary/15 text-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
          } ${!showLabels ? 'justify-center' : ''}`}>
          <item.icon className={`h-4 w-4 flex-shrink-0 ${active ? 'text-primary' : ''}`} />
          {showLabels && <span className="truncate">{item.label}</span>}
          {!showLabels && (
            <span className="pointer-events-none fixed left-16 ml-2 px-2 py-1 rounded-md bg-popover text-popover-foreground text-xs whitespace-nowrap shadow-md border border-border opacity-0 group-hover:opacity-100 transition-opacity z-[60]">
              {item.label}
            </span>
          )}
        </NavLink>
      );
    });

  return (
    <>
      <aside className={`hidden md:flex flex-col fixed left-0 top-0 h-screen bg-[hsl(var(--sidebar-background))] border-r border-border z-40 transition-all duration-300 ${collapsed ? 'w-16' : 'w-60'}`}>
        <div className={`flex items-center h-14 border-b border-border flex-shrink-0 ${collapsed ? 'justify-center px-2' : 'justify-between px-3'}`}>
          {!collapsed && <ThemeLogo className="h-7 flex-shrink-0" />}
          <button onClick={() => setCollapsed(!collapsed)} className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
            <ChevronLeft className={`h-4 w-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1.5">{renderNavItems(!collapsed)}</nav>
        <div className="border-t border-border p-3 flex-shrink-0">
          {!collapsed && (
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">{user?.full_name?.[0] || 'U'}</div>
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{user?.full_name}</div>
                <div className="text-xs text-muted-foreground truncate capitalize">{user?.role?.replace('_', ' ')}</div>
              </div>
            </div>
          )}
          <button onClick={handleLogout} className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all">
            <LogOut className="h-4 w-4 flex-shrink-0" />{!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={onMobileClose} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-[hsl(var(--sidebar-background))] border-r border-border flex flex-col animate-slide-up">
            <div className="flex items-center justify-between h-14 px-3 border-b border-border flex-shrink-0">
              <ThemeLogo className="h-7" />
              <button onClick={onMobileClose} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground"><X className="h-4 w-4" /></button>
            </div>
            <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1.5">{renderNavItems(true, onMobileClose)}</nav>
            <div className="border-t border-border p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">{user?.full_name?.[0] || 'U'}</div>
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

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[hsl(var(--sidebar-background))] border-t border-border z-40 flex items-center justify-around px-1 py-1.5">
        {visibleItems.slice(0, 5).map((item) => {
          const active = isItemActive(item.path);
          return (
            <NavLink key={item.path} to={item.path} end={rootPaths.includes(item.path)}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] transition-colors ${active ? 'text-primary' : 'text-muted-foreground'}`}>
              <item.icon className="h-5 w-5" /><span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </>
  );
}
