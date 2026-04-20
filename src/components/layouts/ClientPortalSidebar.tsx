import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useClientSidebarCollapsed } from './ClientPortalLayout';
import {
  LayoutDashboard, FileText, FolderKanban, BookOpen, Lock,
  Ticket, User, ChevronLeft, LogOut, X, ListTodo
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import ThemeLogo from '@/components/ThemeLogo';

const navItems = [
  { label: 'Dashboard', path: '/client-portal', icon: LayoutDashboard },
  { label: 'Invoices', path: '/client-portal/invoices', icon: FileText },
  { label: 'Projects', path: '/client-portal/projects', icon: FolderKanban },
  { label: 'Tasks', path: '/client-portal/tasks', icon: ListTodo },
  { label: 'Documents', path: '/client-portal/documents', icon: BookOpen },
  { label: 'Vault', path: '/client-portal/vault', icon: Lock },
  { label: 'Support', path: '/client-portal/support', icon: Ticket },
  { label: 'Profile', path: '/client-portal/profile', icon: User },
];

const rootPath = '/client-portal';

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function ClientPortalSidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const { user, logout, refreshToken } = useAuthStore();
  const { collapsed, setCollapsed } = useClientSidebarCollapsed();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try { await api.post('/auth/logout', { refreshToken }); } catch {}
    logout();
    toast.success('Logged out');
    navigate('/login');
  };

  const isActive = (path: string) =>
    location.pathname === path || (path !== rootPath && location.pathname.startsWith(path));

  const renderItems = (showLabels: boolean, onClick?: () => void) =>
    navItems.map((item) => {
      const active = isActive(item.path);
      return (
        <NavLink key={item.path} to={item.path} end={item.path === rootPath} onClick={onClick}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${
            active ? 'bg-primary/15 text-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
          }`} title={item.label}>
          <item.icon className={`h-4 w-4 flex-shrink-0 ${active ? 'text-primary' : ''}`} />
          {showLabels && <span className="truncate">{item.label}</span>}
        </NavLink>
      );
    });

  return (
    <>
      {/* Desktop sidebar */}
      <aside className={`hidden md:flex flex-col fixed left-0 top-0 h-screen bg-[hsl(var(--sidebar-background))] border-r border-border z-40 transition-all duration-300 ${collapsed ? 'w-16' : 'w-60'}`}>
        <div className="flex items-center justify-between h-14 px-3 border-b border-border flex-shrink-0">
          {!collapsed ? <ThemeLogo className="h-7 flex-shrink-0" /> : <ThemeLogo className="h-6 flex-shrink-0" />}
          <button onClick={() => setCollapsed(!collapsed)} className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
            <ChevronLeft className={`h-4 w-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>
        {!collapsed && (
          <div className="px-3 pt-4 pb-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Client Portal</span>
          </div>
        )}
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">{renderItems(!collapsed)}</nav>
        <div className="border-t border-border p-3 flex-shrink-0">
          {!collapsed && (
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">{user?.full_name?.[0] || 'U'}</div>
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{user?.full_name}</div>
                <div className="text-xs text-muted-foreground truncate">Client</div>
              </div>
            </div>
          )}
          <button onClick={handleLogout} className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all">
            <LogOut className="h-4 w-4 flex-shrink-0" />{!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={onMobileClose} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-[hsl(var(--sidebar-background))] border-r border-border flex flex-col animate-slide-up">
            <div className="flex items-center justify-between h-14 px-3 border-b border-border flex-shrink-0">
              <ThemeLogo className="h-7" />
              <button onClick={onMobileClose} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="px-3 pt-4 pb-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Client Portal</span>
            </div>
            <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">{renderItems(true, onMobileClose)}</nav>
            <div className="border-t border-border p-3">
              <button onClick={handleLogout} className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all">
                <LogOut className="h-4 w-4" /><span>Logout</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[hsl(var(--sidebar-background))] border-t border-border z-40 flex items-center justify-around px-1 py-1.5">
        {navItems.slice(0, 5).map((item) => {
          const active = isActive(item.path);
          return (
            <NavLink key={item.path} to={item.path} end={item.path === rootPath}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] transition-colors ${active ? 'text-primary' : 'text-muted-foreground'}`}>
              <item.icon className="h-5 w-5" /><span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </>
  );
}
