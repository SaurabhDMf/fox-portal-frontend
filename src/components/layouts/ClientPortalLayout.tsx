import { createContext, useContext, useState } from 'react';
import { Outlet } from 'react-router-dom';
import ClientPortalSidebar from './ClientPortalSidebar';
import ClientPortalHeader from './ClientPortalHeader';

const SidebarContext = createContext({ collapsed: false, setCollapsed: (_: boolean) => {} });
export const useClientSidebarCollapsed = () => useContext(SidebarContext);

export default function ClientPortalLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
      <div className="min-h-screen bg-background">
        <ClientPortalSidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
        <div className={`pb-20 md:pb-0 min-h-screen transition-[margin] duration-300 ${collapsed ? 'md:ml-16' : 'md:ml-60'}`}>
          <ClientPortalHeader onMobileMenuOpen={() => setMobileMenuOpen(true)} />
          <main>
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarContext.Provider>
  );
}
