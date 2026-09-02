import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface Tab {
  id: string;
  path: string;
  label: string;
  icon?: string;
}

type NavigateFn = (path: string) => void;

// The actual react-router navigate function, registered by <TabBar /> once it
// mounts inside <BrowserRouter>. Kept outside the store (not persisted, not
// serializable) so store actions can be called from anywhere — including
// places rendered above the Router, like toast click handlers.
let navigateFn: NavigateFn | null = null;

// Falls back to a hard navigation if no router navigate has been registered
// yet (or ever, e.g. inside a layout this tab system isn't wired into) —
// keeps behavior safe instead of silently doing nothing.
function go(path: string) {
  if (navigateFn) navigateFn(path);
  else window.location.assign(path);
}

// Groups a path into its tab identity: portal prefix + first module segment,
// e.g. "/admin/crm/55" (a lead detail) and "/admin/crm/payments" both belong
// to the "/admin/crm" tab — so drilling into a detail/sub-view from a list
// never spawns a duplicate tab, it just updates the existing tab's path.
export function moduleKeyFromPath(pathname: string): string {
  const clean = pathname.split('?')[0].split('#')[0];
  const parts = clean.split('/').filter(Boolean);
  if (parts.length <= 1) return `/${parts[0] || ''}`;
  return `/${parts[0]}/${parts[1]}`;
}

interface TabsState {
  tabs: Tab[];
  activeId: string | null;

  /** Wire the store to react-router's navigate — called once by <TabBar />. */
  registerNavigate: (fn: NavigateFn) => void;

  /**
   * Open a module as a tab: activates it if a tab for that module already
   * exists (navigating to whatever sub-path it was last on), otherwise
   * appends a new tab and activates it. This is the main entry point for
   * nav menus / header buttons / notification links.
   */
  openTab: (path: string, label: string, iconKey?: string) => void;

  /**
   * Close a tab. If it was the active tab, activate a sensible neighbor
   * (the tab to its left, or whatever is now leftmost). Closing the very
   * last tab falls back to opening the portal's dashboard so the view is
   * never blank.
   */
  closeTab: (id: string) => void;

  setActiveTab: (id: string) => void;

  /**
   * Reconcile the tab list with the current URL. Called on every location
   * change so that: (a) first landing in a portal seeds exactly one tab,
   * (b) a hard refresh re-syncs against whatever tabs persisted, (c)
   * in-page navigation within the active tab's module (e.g. list → detail)
   * updates that tab's stored path instead of drifting away from it, and
   * (d) any navigation that didn't go through openTab() still gets a tab
   * so the bar never shows a state that doesn't match the page on screen.
   */
  syncLocation: (fullPath: string, label: string, iconKey?: string) => void;
}

export const useTabsStore = create<TabsState>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeId: null,

      registerNavigate: (fn) => {
        navigateFn = fn;
      },

      openTab: (path, label, iconKey) => {
        const id = moduleKeyFromPath(path);
        const { tabs } = get();
        const existing = tabs.find((t) => t.id === id);
        if (existing) {
          set({ activeId: existing.id });
          go(existing.path);
        } else {
          const tab: Tab = { id, path, label, icon: iconKey };
          set({ tabs: [...tabs, tab], activeId: id });
          go(path);
        }
      },

      closeTab: (id) => {
        const { tabs, activeId } = get();
        const idx = tabs.findIndex((t) => t.id === id);
        if (idx === -1) return;
        const wasActive = activeId === id;
        const remaining = tabs.filter((t) => t.id !== id);

        if (remaining.length === 0) {
          // Last tab closed — never leave the view blank. Fall back to the
          // dashboard of whichever portal that tab belonged to.
          const portal = tabs[idx].path.split('/').filter(Boolean)[0] || 'admin';
          const defaultPath = `/${portal}`;
          const fallback: Tab = { id: defaultPath, path: defaultPath, label: 'Dashboard', icon: 'dashboard' };
          set({ tabs: [fallback], activeId: fallback.id });
          go(defaultPath);
          return;
        }

        let nextActiveId = activeId;
        if (wasActive) {
          // Prefer the tab that was to its left; if it was leftmost, the
          // tab now occupying that spot (browser-tab convention).
          const neighbor = remaining[idx - 1] || remaining[0];
          nextActiveId = neighbor.id;
        }
        set({ tabs: remaining, activeId: nextActiveId });
        if (wasActive) {
          const nextTab = remaining.find((t) => t.id === nextActiveId);
          if (nextTab) go(nextTab.path);
        }
      },

      setActiveTab: (id) => {
        const tab = get().tabs.find((t) => t.id === id);
        if (!tab) return;
        set({ activeId: id });
        go(tab.path);
      },

      syncLocation: (fullPath, label, iconKey) => {
        const id = moduleKeyFromPath(fullPath);
        const { tabs, activeId } = get();
        const existing = tabs.find((t) => t.id === id);
        if (existing) {
          if (existing.path === fullPath && activeId === id) return;
          set({
            activeId: id,
            tabs: tabs.map((t) => (t.id === id ? { ...t, path: fullPath } : t)),
          });
        } else {
          const tab: Tab = { id, path: fullPath, label, icon: iconKey };
          set({ tabs: [...tabs, tab], activeId: id });
        }
      },
    }),
    {
      name: 'foxportal-tabs',
      // Per-browser-tab convenience, not synced app state — sessionStorage
      // survives a hard refresh but not a new tab/window or another device.
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ tabs: state.tabs, activeId: state.activeId }),
    }
  )
);
