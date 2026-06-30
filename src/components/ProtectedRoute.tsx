import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

interface Props {
  children: React.ReactNode;
  allowedRoles?: string[];
  denyRoles?: string[];
  loginPath?: string;
}

// When a role check fails on a path under another portal, swap the portal
// prefix so the deep link is preserved (e.g. sales user on /admin/clients/123
// goes to /sales/clients/123, not to the bare /sales dashboard). Falls back
// to the role's home path when the URL isn't under a known portal prefix.
function redirectForRole(targetBase: string, currentPath: string, search: string, hash: string): string {
  const swapped = currentPath.replace(
    /^\/(admin|sales|team|emp|client-portal|client|portal)(\/|$)/,
    `${targetBase}$2`
  );
  if (swapped !== currentPath && swapped.startsWith(targetBase)) {
    return `${swapped}${search}${hash}`;
  }
  return targetBase;
}

export default function ProtectedRoute({ children, allowedRoles, denyRoles, loginPath = '/login' }: Props) {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) return <Navigate to={loginPath} replace />;

  if (denyRoles && user && denyRoles.includes(user.role)) {
    const store = useAuthStore.getState();
    const target = redirectForRole(store.getRedirectPath(), location.pathname, location.search, location.hash);
    return <Navigate to={target} replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    const store = useAuthStore.getState();
    const target = redirectForRole(store.getRedirectPath(), location.pathname, location.search, location.hash);
    return <Navigate to={target} replace />;
  }

  return <>{children}</>;
}
