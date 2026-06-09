import { createContext, useContext, useState } from 'react';
import { Outlet } from 'react-router-dom';
import AppSidebar from './AppSidebar';
import AppHeader from './AppHeader';

const SidebarContext = createContext({ collapsed: false, setCollapsed: (_: boolean) => {} });
export const useSidebarCollapsed = () => useContext(SidebarContext);

export default function PortalLayout() {
  const [collapsed, setCollapsed] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
      <div className="h-screen overflow-hidden bg-background">
        <AppSidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
        <div className={`flex flex-col h-screen transition-[margin] duration-300 ${collapsed ? 'md:ml-16' : 'md:ml-60'}`}>
          <AppHeader onMobileMenuOpen={() => setMobileMenuOpen(true)} />
          <main className="flex-1 overflow-hidden relative">
            <div className="absolute inset-0 overflow-y-auto pb-20 md:pb-0">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarContext.Provider>
  );
}
