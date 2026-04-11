import { useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Bell, Menu } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

const routeLabels: Record<string, string> = {
  '/client-portal': 'Dashboard',
  '/client-portal/invoices': 'Invoices',
  '/client-portal/projects': 'Projects',
  '/client-portal/documents': 'Documents',
  '/client-portal/vault': 'Vault',
  '/client-portal/support': 'Support',
  '/client-portal/profile': 'Profile',
};

interface Props {
  onMobileMenuOpen?: () => void;
}

export default function ClientPortalHeader({ onMobileMenuOpen }: Props) {
  const user = useAuthStore(s => s.user);
  const location = useLocation();
  const pageTitle = routeLabels[location.pathname] || 'Client Portal';

  return (
    <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="flex items-center justify-between h-14 px-4 md:px-6 lg:px-8">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onMobileMenuOpen} className="md:hidden p-1.5 rounded-md hover:bg-secondary text-muted-foreground">
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden sm:flex items-center gap-1 text-sm text-muted-foreground">
            <span>Client Portal</span>
            <span className="mx-1 text-border">/</span>
            <span className="text-foreground font-medium">{pageTitle}</span>
          </div>
          <span className="sm:hidden text-sm font-medium truncate">{pageTitle}</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors relative">
            <Bell className="h-4 w-4" />
          </button>
          <div className="hidden sm:flex items-center gap-2 ml-1 pl-3 border-l border-border">
            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
              {user?.full_name?.[0] || 'U'}
            </div>
            <div className="hidden lg:block min-w-0">
              <div className="text-xs font-medium truncate leading-tight">{user?.full_name}</div>
              <div className="text-[10px] text-muted-foreground truncate leading-tight">Client</div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
