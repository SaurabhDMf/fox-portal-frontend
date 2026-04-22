import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { getSocket } from '@/hooks/useSocket';

/**
 * Subscribes to the backend `new_notification` socket event for the current
 * user and invalidates the React Query `['notifications']` cache so that the
 * notification bell badge, banner, and Notifications page all refresh
 * instantly without waiting for the polling interval.
 *
 * Mount this once at the app root (inside QueryClientProvider) — it is a
 * no-op when the user is not authenticated.
 */
export function useNotificationsSocket() {
  const qc = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId = useAuthStore((s) => s.user?.id);

  useEffect(() => {
    if (!isAuthenticated || !accessToken || !userId) return;

    let socket;
    try {
      socket = getSocket(accessToken);
    } catch {
      return;
    }

    const handleNewNotification = () => {
      // Invalidate every query whose key starts with 'notifications'
      // (covers ['notifications'], ['notifications', 'unread'], etc.)
      qc.invalidateQueries({ queryKey: ['notifications'] });
    };

    socket.on('new_notification', handleNewNotification);

    return () => {
      socket.off('new_notification', handleNewNotification);
    };
  }, [qc, accessToken, isAuthenticated, userId]);
}

export default function NotificationsSocketBridge() {
  useNotificationsSocket();
  return null;
}
