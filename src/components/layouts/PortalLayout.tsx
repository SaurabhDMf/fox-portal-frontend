import { Outlet } from 'react-router-dom';
import AppHeader from './AppHeader';

export default function PortalLayout() {
  return (
    <div className="h-screen overflow-hidden bg-background">
      <div className="flex flex-col h-screen">
        <AppHeader />
        <main className="flex-1 overflow-hidden relative">
          <div className="absolute inset-0 overflow-y-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
