import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

export default function Index() {
  const { isAuthenticated, getRedirectPath } = useAuthStore();
  if (isAuthenticated) return <Navigate to={getRedirectPath()} replace />;
  return <Navigate to="/login" replace />;
}
