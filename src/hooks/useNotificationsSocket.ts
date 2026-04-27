import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { useUnreadStore, typeToModule } from '@/stores/unreadStore';
import { getSocket } from '@/hooks/useSocket';
import api from '@/lib/api';

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.25);
    setTimeout(() => ctx.close().catch(() => {}), 600);
  } catch {}
}

async function fetchAndSeedUnreadCounts() {
  try {
    const { data } = await api.get('/notifications/unread-counts');
    useUnreadStore.getState().setAll({
      notifications: data.notifications || 0,
      chat:          data.chat          || 0,
      email:         data.email         || 0,
    });
  } catch {}
}

export function useNotificationsSocket() {
  const qc              = useQueryClient();
  const accessToken     = useAuthStore((s) => s.accessToken);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId          = useAuthStore((s) => s.user?.id);
  const { bump }        = useUnreadStore();

  // Seed counts from backend on first auth
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchAndSeedUnreadCounts();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !accessToken || !userId) return;

    let socket: ReturnType<typeof getSocket>;
    try { socket = getSocket(accessToken); } catch { return; }

    const handleNewNotification = (notif: any) => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      // Bump the bell count
      bump('notifications');
      // Bump the module-specific count
      const mod = typeToModule[notif?.type] || '';
      if (mod) bump(mod);
      playNotificationSound();
    };

    const handleNewMessage = (msg: any) => {
      // Only bump if we're not already in the chat room that sent the message
      const currentPath = window.location.pathname;
      const isInRoom = currentPath.includes('/chat') &&
        new URLSearchParams(window.location.search).get('room') === msg?.room_id;
      if (!isInRoom) {
        bump('chat');
        playNotificationSound();
      }
      qc.invalidateQueries({ queryKey: ['chat-rooms'] });
    };

    socket.on('new_notification', handleNewNotification);
    socket.on('new_message',      handleNewMessage);

    return () => {
      socket.off('new_notification', handleNewNotification);
      socket.off('new_message',      handleNewMessage);
    };
  }, [qc, accessToken, isAuthenticated, userId, bump]);
}

export default function NotificationsSocketBridge() {
  useNotificationsSocket();
  return null;
}
