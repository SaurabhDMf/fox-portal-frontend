import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

export interface ClientPermissions {
  can_view_invoices?: boolean;
  can_view_projects?: boolean;
  can_view_tasks?: boolean;
  can_view_documents?: boolean;
  can_view_vault?: boolean;
  can_view_support?: boolean;
  can_create_tasks?: boolean;
  [key: string]: boolean | undefined;
}

/**
 * Fetches the current client's permissions from /client/me.
 * Returns an empty object while loading or if the user is not a client.
 * Missing permission keys default to `true` (show by default) — backend
 * explicitly returns `false` to hide a section.
 */
export function useClientPermissions(): ClientPermissions {
  const role = useAuthStore((s) => s.user?.role);
  const isClient = role === 'client';

  const { data } = useQuery({
    queryKey: ['cp-me-permissions'],
    queryFn: () => api.get('/client/me').then((r) => r.data?.data || r.data || {}),
    enabled: isClient,
    staleTime: 5 * 60 * 1000,
  });

  return (data?.permissions || {}) as ClientPermissions;
}
