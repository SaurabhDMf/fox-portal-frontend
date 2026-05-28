import { useAuthStore, type Permission } from '@/stores/authStore';
import { getPermission, type Module, type ModulePermission } from '@/lib/permissions';

/**
 * React hook that returns permissions for a given module.
 * Prefers API-returned permissions (from login/refresh), falls back to local matrix.
 */
export function useModulePermission(module: Module): ModulePermission {
  const role = useAuthStore((s) => s.user?.role);
  const apiPerms = useAuthStore((s) => s.permissions);

  // If we have API permissions for this module, use those
  const ap = apiPerms?.[module];
  if (ap) {
    return {
      canView: ap.can_view ?? false,
      canCreate: ap.can_create ?? false,
      canEdit: ap.can_edit ?? false,
      canDelete: ap.can_delete ?? false,
      canExport: ap.can_export ?? false,
      ownOnly: ap.own_only ?? false,
      teamOnly: false,
    };
  }

  // Fallback to local permission matrix
  return getPermission(role, module);
}

/**
 * Returns the current user's role
 */
export function useRole(): string | undefined {
  return useAuthStore((s) => s.user?.role);
}
