import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useUnreadStore } from '@/stores/unreadStore';
import { Bell, Search, Menu } from 'lucide-react';
import { useSidebarCollapsed } from './PortalLayout';
import ThemeToggle from '@/components/ThemeToggle';
import StatusDot from '@/components/chat/StatusDot';
import StatusPicker from '@/components/chat/StatusPicker';
import api from '@/lib/api';

const routeLabels: Record<string, string> = {
  '/sa': 'Dashboard',
  '/sa/organizations': 'Organizations',
  '/sa/users': 'Users',
  '/sa/plans': 'Plans',
  '/sa/audit-log': 'Audit Log',
  '/sa/permissions': 'Permissions',
  '/admin': 'Dashboard',
  '/admin/crm': 'Sales CRM',
  '/admin/invoicing': 'Invoices',
  '/admin/clients': 'Clients',
  '/admin/chat': 'Chat',
  '/admin/projects': 'Projects',
  '/admin/vault': 'Password Vault',
  '/admin/tickets': 'Support Tickets',
  '/admin/tracker': 'HR & Tracker',
  '/admin/payroll': 'Payroll',
  '/admin/users': 'Team & Users',
  '/admin/reports': 'Reports',
  '/admin/settings': 'Settings',
  '/emp': 'Dashboard',
  '/emp/tasks': 'My Tasks',
  '/emp/projects': 'Projects',
  '/emp/chat': 'Chat',
  '/emp/tracker': 'Tracker',
  '/emp/payroll': 'Payroll',
  '/emp/profile': 'Profile',
  '/portal': 'Dashboard',
  '/portal/invoices': 'Invoices',
  '/portal/projects': 'Projects',
  '/portal/documents': 'Documents',
  '/portal/messages': 'Messages',
  '/portal/support': 'Support',
};

function getBreadcrumbs(pathname: string) {
  const parts = pathname.split('/').filter(Boolean);
  const portal = parts[0] || '';
  const portalLabels: Record<string, string> = {
    sa: 'Super Admin',
    admin: 'Admin',
    emp: 'Employee',
    portal: 'Client Portal',
  };

  const crumbs: { label: string; path: string }[] = [
    { label: portalLabels[portal] || portal, path: `/${portal}` },
  ];

  if (parts.length > 1) {
    const fullPath = `/${parts[0]}/${parts[1]}`;
    const label = routeLabels[fullPath] || parts[1].charAt(0).toUpperCase() + parts[1].slice(1).replace(/-/g, ' ');
    crumbs.push({ label, path: fullPath });
  }

  if (parts.length > 2) {
    crumbs.push({ label: 'Detail', path: pathname });
  }

  return crumbs;
}

interface Props {
  onMobileMenuOpen?: () => void;
}

export default function AppHeader({ onMobileMenuOpen }: Props) {
  const user = useAuthStore(s => s.user);
  const navigate = useNavigate();
  const location = useLocation();
  const notifCount = useUnreadStore((s) => s.counts.notifications || 0);
  const clearNotif  = useUnreadStore((s) => s.clear);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [myStatus, setMyStatus] = useState('online');
  const [myStatusText, setMyStatusText] = useState('');
  const [myStatusEmoji, setMyStatusEmoji] = useState('');
  const crumbs = getBreadcrumbs(location.pathname);
  const pageTitle = routeLabels[location.pathname] || crumbs[crumbs.length - 1]?.label || '';

  // Fetch own status on mount
  useEffect(() => {
    api.get('/users/me').then(r => {
      const d = r.data?.data || r.data;
      if (d?.status) setMyStatus(d.status);
      if (d?.status_text) setMyStatusText(d.status_text);
      if (d?.status_emoji) setMyStatusEmoji(d.status_emoji);
    }).catch(() => {});
  }, []);

  const handleStatusChange = (status: string, text: string, emoji: string) => {
    setMyStatus(status);
    setMyStatusText(text);
    setMyStatusEmoji(emoji);
  };

  return (
    <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="flex items-center justify-between h-14 px-4 md:px-6 lg:px-8">
        {/* Left: breadcrumbs */}
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onMobileMenuOpen} className="md:hidden p-1.5 rounded-md hover:bg-secondary text-muted-foreground">
            <Menu className="h-5 w-5" />
          </button>
          <nav className="hidden sm:flex items-center gap-1 text-sm text-muted-foreground min-w-0">
            {crumbs.map((crumb, i) => (
              <span key={crumb.path} className="flex items-center gap-1 min-w-0">
                {i > 0 && <span className="mx-1 text-border">/</span>}
                <span className={i === crumbs.length - 1 ? 'text-foreground font-medium truncate' : 'truncate'}>
                  {crumb.label}
                </span>
              </span>
            ))}
          </nav>
          <span className="sm:hidden text-sm font-medium truncate">{pageTitle}</span>
        </div>

        {/* Right: search + notifications + user */}
        <div className="flex items-center gap-2">
          {/* Search */}
          {showSearch ? (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                autoFocus
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onBlur={() => { if (!searchQuery) setShowSearch(false); }}
                onKeyDown={e => e.key === 'Escape' && (setShowSearch(false), setSearchQuery(''))}
                placeholder="Search..."
                className="w-48 lg:w-64 pl-9 pr-3 py-1.5 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              />
            </div>
          ) : (
            <button onClick={() => setShowSearch(true)} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
              <Search className="h-4 w-4" />
            </button>
          )}

          {/* Theme toggle */}
          <ThemeToggle />

          {/* Notifications bell — shows live unread count */}
          <button
            onClick={() => {
              const base = location.pathname.startsWith('/emp') ? '/emp' : '/admin';
              clearNotif('notifications');
              navigate(`${base}/notifications`);
            }}
            className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors relative"
            title="Notifications"
          >
            <Bell className={`h-4 w-4 ${notifCount > 0 ? 'text-orange-500' : ''}`} />
            {notifCount > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-orange-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                {notifCount > 99 ? '99+' : notifCount}
              </span>
            ) : (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-muted-foreground/30" />
            )}
          </button>

          {/* User avatar with status */}
          <div className="hidden sm:flex items-center gap-2 ml-1 pl-3 border-l border-border">
            <StatusPicker
              currentStatus={myStatus}
              currentStatusText={myStatusText}
              currentStatusEmoji={myStatusEmoji}
              onStatusChange={handleStatusChange}
            >
              <button className="relative flex-shrink-0">
                <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                  {user?.full_name?.[0] || 'U'}
                </div>
                <StatusDot status={myStatus} className="absolute -bottom-0.5 -right-0.5 w-2 h-2" />
              </button>
            </StatusPicker>
            <div className="hidden lg:block min-w-0">
              <div className="text-xs font-medium truncate leading-tight">{user?.full_name}</div>
              <div className="text-[10px] text-muted-foreground truncate leading-tight">
                {myStatusText ? `${myStatusEmoji} ${myStatusText}` : <span className="capitalize">{user?.role?.replace('_', ' ')}</span>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
