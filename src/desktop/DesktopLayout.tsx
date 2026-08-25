import { Outlet } from 'react-router-dom';
import DesktopSidebar from './DesktopSidebar';

export default function DesktopLayout() {
  return (
    <div className="h-screen overflow-hidden bg-background">
      <DesktopSidebar />
      <div className="flex flex-col h-screen ml-60">
        <main className="flex-1 overflow-hidden relative">
          <div className="absolute inset-0 overflow-y-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
