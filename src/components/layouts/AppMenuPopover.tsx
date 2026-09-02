import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutGrid, LogOut } from 'lucide-react';
import { useNavItems, GROUP_ORDER, type NavItem } from './useNavItems';
import { useAuthStore } from '@/stores/authStore';
import { useTabsStore } from '@/stores/tabsStore';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import ThemeLogo from '@/components/ThemeLogo';

// The single global navigation surface — replaces a persistent side nav
// with a grouped popover grid, reachable identically at every breakpoint.
// Also carries logout on small screens, where the header's own user-menu
// dropdown is hidden to save space.
export default function AppMenuPopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { visibleItems, isItemActive } = useNavItems();
  const { logout, refreshToken } = useAuthStore();
  const openTab = useTabsStore((s) => s.openTab);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try { await api.post('/auth/logout', { refreshToken }); } catch {}
    logout();
    toast.success('Logged out');
    navigate('/login');
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  // Flatten items with children into the grid too (a leaf pointing at the
  // parent's own path) — the popover is a launcher, not the place for
  // sub-navigation, which still lives on each module's own page.
  const flat: NavItem[] = visibleItems.map((item) =>
    item.children?.length ? { ...item, children: undefined } : item
  );

  const groups = GROUP_ORDER
    .map((g) => ({ name: g, items: flat.filter((i) => i.group === g) }))
    .filter((g) => g.items.length > 0);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
          open ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
        }`}
      >
        <LayoutGrid className="h-4 w-4" />
        <span className="hidden sm:inline">Menu</span>
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-[min(92vw,640px)] max-h-[75vh] overflow-y-auto bg-popover border border-border rounded-xl shadow-xl p-4 animate-fade-in">
          <div className="flex items-center gap-2 pb-3 mb-3 border-b border-border">
            <ThemeLogo className="h-6" />
            <span className="font-display font-semibold text-sm">Fox Portal</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-5">
            {groups.map((group) => (
              <div key={group.name} className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group.name}</p>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const active = isItemActive(item.path);
                    return (
                      <button
                        key={item.path}
                        type="button"
                        onClick={() => {
                          setOpen(false);
                          const iconKey = item.path.split('?')[0].split('/').filter(Boolean)[1] || 'dashboard';
                          openTab(item.path, item.label, iconKey);
                        }}
                        className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-sm text-left transition-colors ${
                          active ? 'bg-primary/15 text-primary font-medium' : 'text-foreground/80 hover:bg-secondary'
                        }`}
                      >
                        <item.icon className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={handleLogout}
            className="sm:hidden flex items-center gap-2 w-full mt-4 pt-3 px-2 py-2 border-t border-border rounded-lg text-sm text-foreground/80 hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>
      )}
    </div>
  );
}
