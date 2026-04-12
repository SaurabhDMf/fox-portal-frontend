import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { disconnectSocket } from '@/hooks/useSocket';

export interface Permission {
  can_view: boolean;
  can_create: boolean;
  can_edit?: boolean;
  can_delete?: boolean;
  can_export?: boolean;
  own_only: boolean;
}

export interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
  avatar_url?: string;
  organization_id?: string;
  department?: string;
  job_title?: string;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  permissions: Record<string, Permission>;
  enabledModules: string[];
  isAuthenticated: boolean;
  setAuth: (data: { accessToken: string; refreshToken: string; user: User; permissions: Record<string, Permission>; enabled_modules?: string[] }) => void;
  setPermissions: (permissions: Record<string, Permission>, enabled_modules?: string[]) => void;
  logout: () => void;
  canView: (module: string) => boolean;
  canCreate: (module: string) => boolean;
  getRedirectPath: () => string;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      permissions: {},
      enabledModules: [],
      isAuthenticated: false,

      setAuth: (data) =>
        set({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          user: data.user,
          permissions: data.permissions || {},
          enabledModules: data.enabled_modules || [],
          isAuthenticated: true,
        }),

      setPermissions: (permissions, enabled_modules) =>
        set((state) => ({
          ...state,
          permissions: permissions || state.permissions,
          enabledModules: enabled_modules || state.enabledModules,
        })),

      logout: () => {
        disconnectSocket();
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          permissions: {},
          enabledModules: [],
          isAuthenticated: false,
        });
      },

      canView: (module: string) => {
        const perms = get().permissions;
        return perms[module]?.can_view ?? false;
      },

      canCreate: (module: string) => {
        const perms = get().permissions;
        return perms[module]?.can_create ?? false;
      },

      getRedirectPath: () => {
        const role = get().user?.role;
        const adminRoles = ['super_admin', 'admin', 'sales_manager', 'sales_rep'];
        const clientRoles = ['client'];
        if (adminRoles.includes(role || '')) return '/admin';
        if (clientRoles.includes(role || '')) return '/client-portal';
        if (role) return '/emp'; // All other authenticated roles → employee portal
        return '/login';
      },
    }),
    { name: 'ubp-auth' }
  )
);
