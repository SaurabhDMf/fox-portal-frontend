import { NavLink, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import {
  LayoutDashboard, Users, Building2, CreditCard, MessageSquare, FolderKanban,
  FileText, Shield, Clock, Wallet, BarChart3, Settings, Lock, Ticket,
  ChevronLeft, LogOut, Globe, ListChecks, Activity, BookOpen
} from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';

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

export default function AppSidebar() {
  const { user, permissions, logout, refreshToken } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
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
    try {
      await api.post('/auth/logout', { refreshToken });
    } catch {}
    logout();
    toast.success('Logged out');
    navigate('/login');
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex flex-col fixed left-0 top-0 h-screen bg-[hsl(var(--sidebar-background))] border-r border-border z-40 transition-all duration-300 ${
          collapsed ? 'w-16' : 'w-60'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-14 px-3 border-b border-border flex-shrink-0">
          {!collapsed && (
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                <div className="w-3.5 h-3.5 rounded bg-primary" />
              </div>
              <span className="font-semibold text-sm text-foreground truncate">UBP</span>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className={`h-4 w-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {visibleItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== '/sa' && item.path !== '/admin' && item.path !== '/emp' && item.path !== '/portal' && location.pathname.startsWith(item.path));
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/sa' || item.path === '/admin' || item.path === '/emp' || item.path === '/portal'}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 group ${
                  isActive
                    ? 'bg-primary/15 text-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
                title={item.label}
              >
                <item.icon className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-primary' : ''}`} />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* User section */}
        <div className="border-t border-border p-3 flex-shrink-0">
          {!collapsed && (
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                {user?.full_name?.[0] || 'U'}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{user?.full_name}</div>
                <div className="text-xs text-muted-foreground truncate">{user?.role?.replace('_', ' ')}</div>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[hsl(var(--sidebar-background))] border-t border-border z-40 flex items-center justify-around px-1 py-1.5 safe-area-pb">
        {visibleItems.slice(0, 5).map((item) => {
          const isActive = location.pathname === item.path || (item.path.split('/').length > 2 && location.pathname.startsWith(item.path));
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={['/', '/sa', '/admin', '/emp', '/portal'].includes(item.path)}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] transition-colors ${
                isActive ? 'text-primary' : 'text-muted-foreground'
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
