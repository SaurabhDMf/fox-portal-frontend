import { useEffect, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';

export function usePermissionsRefresh() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const setPermissions = useAuthStore((s) => s.setPermissions);
  const setUser = useAuthStore((s) => s.setUser);

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

    // Also refresh the user's own profile so role changes made by an admin
    // (e.g. promoting a user to Admin) take effect without requiring the user
    // to log out and back in. Only patch fields we actually get back.
    api.get('/auth/me')
      .then((res) => {
        const u = res.data?.data || res.data?.user || res.data;
        if (!u) return;
        const patch: any = {};
        if (u.role) patch.role = u.role;
        if (u.full_name) patch.full_name = u.full_name;
        if (u.email) patch.email = u.email;
        if (u.avatar_url !== undefined) patch.avatar_url = u.avatar_url;
        if (Object.keys(patch).length) setUser(patch);
      })
      .catch(() => {});
  }, [isAuthenticated, accessToken, setPermissions, setUser]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [refresh]);
}
