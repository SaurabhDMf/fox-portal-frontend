import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { useTabsStore } from '@/stores/tabsStore';
import { tabIcon, deriveTabMeta } from '@/lib/tabMeta';

// Persistent browser-tab-style strip rendered inside PortalLayout, between
// AppHeader and the routed page content. Drives navigation via the same
// react-router navigate() used everywhere else, so the URL bar and
// deep-linking keep working — switching tabs is just navigate(tab.path).
export default function TabBar() {
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = useTabsStore((s) => s.tabs);
  const activeId = useTabsStore((s) => s.activeId);
  const setActiveTab = useTabsStore((s) => s.setActiveTab);
  const closeTab = useTabsStore((s) => s.closeTab);
  const registerNavigate = useTabsStore((s) => s.registerNavigate);
  const syncLocation = useTabsStore((s) => s.syncLocation);

  // Wire the store to this Router's navigate — TabBar only mounts inside
  // PortalLayout, which lives inside <BrowserRouter>, so this is always a
  // valid navigate function for the lifetime of the app.
  useEffect(() => {
    registerNavigate(navigate);
  }, [navigate, registerNavigate]);

  // Keep the tab list in sync with wherever the app actually is — seeds the
  // first tab on initial load, reconciles against persisted tabs on a hard
  // refresh, and tracks in-page transitions (e.g. list → detail) into the
  // active tab's stored path.
  useEffect(() => {
    const fullPath = location.pathname + location.search;
    const { label, iconKey } = deriveTabMeta(location.pathname);
    syncLocation(fullPath, label, iconKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);

  if (tabs.length === 0) return null;

  return (
    <div className="flex items-end gap-0.5 px-2 pt-1.5 bg-background border-b border-border overflow-x-auto scrollbar-thin">
      {tabs.map((tab) => {
        const Icon = tabIcon(tab.icon);
        const active = tab.id === activeId;
        return (
          <div
            key={tab.id}
            onClick={() => { if (!active) setActiveTab(tab.id); }}
            role="tab"
            aria-selected={active}
            className={`group flex items-center gap-1.5 h-8 pl-2.5 pr-1.5 rounded-t-lg text-xs font-medium cursor-pointer flex-shrink-0 max-w-[180px] transition-colors border ${
              active
                ? 'bg-accent text-foreground border-border border-b-accent -mb-px'
                : 'bg-transparent text-muted-foreground border-transparent hover:bg-secondary/70 hover:text-foreground'
            }`}
            title={tab.label}
          >
            <Icon className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">{tab.label}</span>
            <button
              onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
              className="ml-0.5 p-0.5 rounded flex-shrink-0 text-muted-foreground/60 hover:bg-destructive/15 hover:text-destructive transition-colors"
              aria-label={`Close ${tab.label}`}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
