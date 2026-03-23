import { Outlet } from 'react-router-dom';
import AppSidebar from './AppSidebar';

export default function PortalLayout() {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className="md:ml-60 pb-20 md:pb-0 min-h-screen">
        <Outlet />
      </main>
    </div>
  );
}
