import { createContext, useContext, useState } from 'react';
import { Outlet } from 'react-router-dom';
import AppSidebar from './AppSidebar';

const SidebarContext = createContext({ collapsed: false, setCollapsed: (_: boolean) => {} });
export const useSidebarCollapsed = () => useContext(SidebarContext);

export default function PortalLayout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed }}>
      <div className="min-h-screen bg-background">
        <AppSidebar />
        <main className={`pb-20 md:pb-0 min-h-screen transition-[margin] duration-300 ${collapsed ? 'md:ml-16' : 'md:ml-60'}`}>
          <Outlet />
        </main>
      </div>
    </SidebarContext.Provider>
  );
}
