import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

interface Props {
  children: React.ReactNode;
  allowedRoles?: string[];
  denyRoles?: string[];
  loginPath?: string;
}

export default function ProtectedRoute({ children, allowedRoles, denyRoles, loginPath = '/login' }: Props) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) return <Navigate to={loginPath} replace />;

  if (denyRoles && user && denyRoles.includes(user.role)) {
    const store = useAuthStore.getState();
    return <Navigate to={store.getRedirectPath()} replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    const store = useAuthStore.getState();
    return <Navigate to={store.getRedirectPath()} replace />;
  }

  return <>{children}</>;
}
