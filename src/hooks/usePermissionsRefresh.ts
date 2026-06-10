import { useEffect, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';

export function usePermissionsRefresh() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const setPermissions = useAuthStore((s) => s.setPermissions);

  const refresh = useCallback(() => {
    if (!isAuthenticated || !accessToken) return;

    api.get('/permissions/my')
      .then((res) => {
        const data = res.data?.data || res.data;
        if (data?.permissions && Object.keys(data.permissions).length > 0) {
          const derivedModules = Object.keys(data.permissions).filter(m => data.permissions[m]?.can_view);
          setPermissions(data.permissions, data.enabled_modules ?? derivedModules, data.grants);
        }
      })
      .catch(() => {});
  }, [isAuthenticated, accessToken, setPermissions]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [refresh]);
}
