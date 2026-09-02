import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useUnreadStore } from '@/stores/unreadStore';
import { useTabsStore } from '@/stores/tabsStore';
import { Bell, Search, Palette, Check, LogOut, MessageSquare, Inbox, RotateCcw } from 'lucide-react';
import AppMenuPopover from './AppMenuPopover';
import NotificationsPanel from './NotificationsPanel';
import ThemeToggle from '@/components/ThemeToggle';
import StatusDot from '@/components/chat/StatusDot';
import StatusPicker from '@/components/chat/StatusPicker';
import api from '@/lib/api';
import toast from 'react-hot-toast';

const accentColors = [
  { name: 'Indigo',   value: '244 94% 62%' },
  { name: 'Violet',   value: '270 80% 60%' },
  { name: 'Blue',     value: '213 100% 62%' },
  { name: 'Emerald',  value: '157 87% 46%' },
  { name: 'Amber',    value: '35 100% 63%' },
  { name: 'Rose',     value: '4 100% 64%' },
  { name: 'Teal',     value: '173 80% 40%' },
  { name: 'Cyan',     value: '190 90% 50%' },
  { name: 'Pink',     value: '330 81% 60%' },
  { name: 'Orange',   value: '21 90% 55%' },
  { name: 'Lime',     value: '84 70% 45%' },
  { name: 'Slate',    value: '215 20% 45%' },
];

const ACCENT_STORAGE_KEY = 'fox-accent-color';

// Section labels keyed by the second URL segment so they work across all
// portals (/admin, /sales, /team, /client) without per-portal duplicates.
// Exported so the tab bar (src/lib/tabMeta.ts) can derive matching tab
// labels from the same single source of truth.
export const sectionLabels: Record<string, string> = {
  crm: 'Sales CRM',
  invoicing: 'Invoices',
  invoices: 'Invoices',
  clients: 'Clients',
  chat: 'Chat',
  projects: 'Projects',
  vault: 'Password Manager',
  inbox: 'Shared Inbox',
  tickets: 'Support Tickets',
  tracker: 'HR & Tracker',
  payroll: 'Payroll',
  expenses: 'Expenses',
  users: 'Team & Users',
  reports: 'Reports',
  settings: 'Settings',
  permissions: 'Permissions',
  roles: 'Roles & Permissions',
  subscriptions: 'Subscriptions',
  notifications: 'Notifications',
  tasks: 'Notes',
  profile: 'Profile',
  documents: 'Documents',
  messages: 'Messages',
  support: 'Support',
  'balance-sheet': 'Balance Sheet',
  'input-sheet':   'Input Sheet',
  'expense-sheet': 'Expense Sheet',
  organizations: 'Organizations',
  plans: 'Plans',
  'audit-log': 'Audit Log',
};

const portalLabels: Record<string, string> = {
  sa: 'Super Admin',
  admin: 'Admin',
  sales: 'Sales',
  team: 'Team',
  client: 'Client',
  // legacy — kept so a momentary URL before redirect still shows a label
  emp: 'Team',
  portal: 'Client',
  'client-portal': 'Client',
};

function getBreadcrumbs(pathname: string) {
  const parts = pathname.split('/').filter(Boolean);
  const portal = parts[0] || '';

  const crumbs: { label: string; path: string }[] = [
    { label: portalLabels[portal] || portal, path: `/${portal}` },
  ];

  if (parts.length > 1) {
    const fullPath = `/${parts[0]}/${parts[1]}`;
    const label = sectionLabels[parts[1]] || parts[1].charAt(0).toUpperCase() + parts[1].slice(1).replace(/-/g, ' ');
    crumbs.push({ label, path: fullPath });
  }

  if (parts.length > 2) {
    crumbs.push({ label: 'Detail', path: pathname });
  }

  return crumbs;
}

export default function AppHeader() {
  const { user, logout, refreshToken } = useAuthStore();
  const openTab = useTabsStore((s) => s.openTab);
  const navigate = useNavigate();
  const location = useLocation();
  const notifCount  = useUnreadStore((s) => s.counts.notifications || 0);
  const chatCount   = useUnreadStore((s) => s.counts.chat || 0);
  const inboxCount  = useUnreadStore((s) => s.counts.inbox || 0);
  const totalCount  = notifCount + chatCount;
  const clearNotif  = useUnreadStore((s) => s.clear);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [myStatus, setMyStatus] = useState('online');
  const [myStatusText, setMyStatusText] = useState('');
  const [myStatusEmoji, setMyStatusEmoji] = useState('');
  const [showAppearance, setShowAppearance] = useState(false);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [selectedAccent, setSelectedAccent] = useState<string | null>(null);
  const appearanceRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const isAdmin = ['super_admin', 'admin'].includes(user?.role || '');
  const crumbs = getBreadcrumbs(location.pathname);
  const pageTitle = crumbs[crumbs.length - 1]?.label || '';

  const handleLogout = async () => {
    try { await api.post('/auth/logout', { refreshToken }); } catch {}
    logout();
    toast.success('Logged out');
    navigate('/login');
  };

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

  const applyAccent = (value: string) => {
    setSelectedAccent(value);
    document.documentElement.style.setProperty('--primary', value);
    document.documentElement.style.setProperty('--accent', value);
    document.documentElement.style.setProperty('--ring', value);
    try { localStorage.setItem(ACCENT_STORAGE_KEY, value); } catch {}
  };

  // Removing the inline overrides (rather than setting a hardcoded value)
  // lets the stylesheet's own light/dark default apply again — those two
  // defaults differ (teal at different lightness per theme), so a fixed
  // reset value would only be correct for one theme.
  const resetAccent = () => {
    setSelectedAccent(null);
    document.documentElement.style.removeProperty('--primary');
    document.documentElement.style.removeProperty('--accent');
    document.documentElement.style.removeProperty('--ring');
    try { localStorage.removeItem(ACCENT_STORAGE_KEY); } catch {}
  };

  // Restore a previously chosen accent on load — applyAccent itself isn't
  // called (no need to re-persist what we just read back).
  useEffect(() => {
    try {
      const stored = localStorage.getItem(ACCENT_STORAGE_KEY);
      if (stored) {
        setSelectedAccent(stored);
        document.documentElement.style.setProperty('--primary', stored);
        document.documentElement.style.setProperty('--accent', stored);
        document.documentElement.style.setProperty('--ring', stored);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!showAppearance) return;
    const handler = (e: MouseEvent) => {
      if (appearanceRef.current && !appearanceRef.current.contains(e.target as Node))
        setShowAppearance(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showAppearance]);

  useEffect(() => {
    if (!showNotifPanel) return;
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node))
        setShowNotifPanel(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showNotifPanel]);

  return (
    <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="flex items-center justify-between h-14 px-4 md:px-6 lg:px-8">
        {/* Left: breadcrumbs + profile (avatar, name, status, designation) */}
        <div className="flex items-center gap-3 min-w-0">
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

          <div className="hidden sm:flex items-center gap-2 ml-2 pl-3 border-l border-border min-w-0">
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
                {myStatusText
                  ? `${myStatusEmoji} ${myStatusText}`
                  : (user?.job_title || <span className="capitalize">{user?.role?.replace('_', ' ')}</span>)}
              </div>
            </div>
          </div>
        </div>

        {/* Right: menu + search + notifications + user */}
        <div className="flex items-center gap-2">
          <AppMenuPopover />

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

          {/* Appearance (admin only) */}
          {isAdmin && (
            <div ref={appearanceRef} className="relative">
              <button
                onClick={() => setShowAppearance(v => !v)}
                className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                title="Appearance"
              >
                <Palette className="h-4 w-4" />
              </button>
              {showAppearance && (
                <div className="absolute right-0 top-11 z-50 w-64 bg-popover border border-border rounded-xl shadow-xl p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Accent Color</p>
                    <button
                      onClick={resetAccent}
                      disabled={selectedAccent === null}
                      title="Reset to default"
                      className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:pointer-events-none"
                    >
                      <RotateCcw className="h-3 w-3" /> Default
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {accentColors.map(c => (
                      <button
                        key={c.value}
                        onClick={() => applyAccent(c.value)}
                        className={`relative flex flex-col items-center gap-1.5 p-2 rounded-lg transition-all ${selectedAccent === c.value ? 'ring-2 ring-primary bg-primary/10' : 'hover:bg-secondary'}`}
                      >
                        <div className="w-6 h-6 rounded-full" style={{ background: `hsl(${c.value})` }} />
                        <span className="text-[10px] text-muted-foreground">{c.name}</span>
                        {selectedAccent === c.value && <Check className="h-2.5 w-2.5 text-primary absolute top-1 right-1" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Module activity icons — visible only while that module has
              unread activity, so no matter what page you're on you can see
              at a glance that new chat messages or inbox threads arrived. */}
          {chatCount > 0 && (
            <button
              onClick={() => {
                clearNotif('chat');
                openTab(`${location.pathname.startsWith('/emp') ? '/emp' : '/admin'}/chat`, 'Chat', 'chat');
              }}
              className="p-2 rounded-lg hover:bg-secondary transition-colors relative"
              title={`${chatCount} unread chat message${chatCount === 1 ? '' : 's'}`}
            >
              <MessageSquare className="h-4 w-4 text-primary" />
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center leading-none">
                {chatCount > 99 ? '99+' : chatCount}
              </span>
            </button>
          )}

          {inboxCount > 0 && (
            <button
              onClick={() => {
                clearNotif('inbox');
                openTab(`${location.pathname.startsWith('/emp') ? '/emp' : '/admin'}/inbox`, 'Shared Inbox', 'inbox');
              }}
              className="p-2 rounded-lg hover:bg-secondary transition-colors relative"
              title={`${inboxCount} unread inbox thread${inboxCount === 1 ? '' : 's'}`}
            >
              <Inbox className="h-4 w-4 text-primary" />
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center leading-none">
                {inboxCount > 99 ? '99+' : inboxCount}
              </span>
            </button>
          )}

          {/* Notifications bell — opens a dropdown panel, not a full-screen
              page. Click the bell again (or the panel's × / click-outside)
              to close it. */}
          <div ref={notifRef} className="relative">
          <button
            onClick={() => {
              setShowNotifPanel(v => !v);
              clearNotif('notifications');
            }}
            className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors relative"
            title="Notifications"
          >
            <Bell className={`h-4 w-4 ${totalCount > 0 ? 'text-orange-500' : ''}`} />
            {totalCount > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-orange-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                {totalCount > 99 ? '99+' : totalCount}
              </span>
            ) : (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-muted-foreground/30" />
            )}
          </button>
          {showNotifPanel && <NotificationsPanel onClose={() => setShowNotifPanel(false)} />}
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 ml-1 pl-3 border-l border-border text-muted-foreground hover:text-destructive transition-colors"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden lg:inline text-sm font-medium">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
