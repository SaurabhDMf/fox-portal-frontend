import { NavLink, useNavigate } from 'react-router-dom';
import { Users, FileText, MessageSquare, Inbox, Lock, Bell, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import ThemeLogo from '@/components/ThemeLogo';

const navItems = [
  { label: 'Leads', path: '/app/crm', icon: Users },
  { label: 'Invoicing', path: '/app/invoicing', icon: FileText },
  { label: 'Chat', path: '/app/chat', icon: MessageSquare },
  { label: 'Shared Inbox', path: '/app/inbox', icon: Inbox },
  { label: 'Password Manager', path: '/app/vault', icon: Lock },
  { label: 'Notifications', path: '/app/notifications', icon: Bell },
];

export default function DesktopSidebar() {
  const { user, logout, refreshToken } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try { await api.post('/auth/logout', { refreshToken }); } catch {}
    logout();
    toast.success('Logged out');
    navigate('/login');
  };

  return (
    <aside className="flex flex-col fixed left-0 top-0 h-screen w-60 bg-sidebar border-r border-sidebar-border z-40">
      <div className="flex items-center h-14 border-b border-sidebar-border px-3 flex-shrink-0">
        <ThemeLogo className="h-7" forceVariant="dark" />
      </div>
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1.5">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
                isActive ? 'bg-sidebar-primary/15 text-sidebar-primary font-medium' : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent'
              }`
            }
          >
            <item.icon className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-sidebar-border p-3 flex-shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-sidebar-primary/20 flex items-center justify-center text-xs font-bold text-sidebar-primary flex-shrink-0">
            {user?.full_name?.[0] || 'U'}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium truncate text-sidebar-foreground">{user?.full_name}</div>
            <div className="text-xs text-sidebar-foreground/60 truncate capitalize">{user?.role?.replace('_', ' ')}</div>
          </div>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10 transition-all">
          <LogOut className="h-4 w-4 flex-shrink-0" /><span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
