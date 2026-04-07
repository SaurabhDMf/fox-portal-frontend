import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';

/**
 * On app load (when authenticated), refresh permissions from GET /api/v1/auth/permissions
 * and update the store.
 */
export function usePermissionsRefresh() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setPermissions = useAuthStore((s) => s.setPermissions);

  useEffect(() => {
    if (!isAuthenticated) return;

    api.get('/auth/permissions')
      .then((res) => {
        const data = res.data;
        if (data?.permissions) {
          setPermissions(data.permissions, data.enabled_modules);
        }
      })
      .catch(() => {
        // Silently fail — keep existing permissions from login
      });
  }, [isAuthenticated, setPermissions]);
}
