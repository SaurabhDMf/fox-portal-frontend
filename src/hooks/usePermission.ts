import { useAuthStore } from '@/stores/authStore';
import { getPermission, type Module, type ModulePermission } from '@/lib/permissions';

/**
 * React hook that returns permissions for a given module based on current user's role.
 */
export function useModulePermission(module: Module): ModulePermission {
  const role = useAuthStore((s) => s.user?.role);
  return getPermission(role, module);
}

/**
 * Returns the current user's role
 */
export function useRole(): string | undefined {
  return useAuthStore((s) => s.user?.role);
}
