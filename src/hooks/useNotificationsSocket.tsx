import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Bell, MessageSquare, CheckSquare, FileText, Target,
  Wallet, Calendar, Mail, Ticket, X,
} from 'lucide-react';
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

// Pick an icon based on notification type
function iconForType(type: string) {
  const map: Record<string, any> = {
    task: CheckSquare,
    mention: MessageSquare,
    message: MessageSquare,
    lead: Target,
    invoice: FileText,
    payroll: Wallet,
    leave: Calendar,
    ticket: Ticket,
    email: Mail,
  };
  return map[type] || Bell;
}

// Resolve a deep link if backend didn't provide one — best-effort fallback
function fallbackLinkForType(type: string): string {
  const role = useAuthStore.getState().user?.role;
  const adminRoles = ['super_admin', 'admin', 'sales_manager', 'sales_rep'];
  const base = role === 'client'
    ? '/client-portal'
    : adminRoles.includes(role || '') ? '/admin' : '/emp';

  switch (type) {
    case 'task':    return `${base}/projects`;
    case 'lead':    return `${base}/crm`;
    case 'mention':
    case 'message': return `${base}/chat`;
    case 'invoice': return role === 'client' ? `${base}/invoices` : `${base}/invoicing`;
    case 'payroll': return `${base}/payroll`;
    case 'leave':   return `${base}/payroll`;
    case 'ticket':  return role === 'client' ? `${base}/support` : `${base}/tickets`;
    case 'email':   return `${base}/email`;
    default:        return `${base}/notifications`;
  }
}

// Floating toast at top of screen — clickable, navigates to deep link.
// Uses window.location to avoid needing react-router context inside the hook.
function showNotificationToast(opts: {
  title: string;
  body: string;
  type: string;
  link: string;
}) {
  const Icon = iconForType(opts.type);
  const target = opts.link || fallbackLinkForType(opts.type);

  toast.custom((t) => (
    <div
      onClick={() => {
        toast.dismiss(t.id);
        if (target) window.location.assign(target);
      }}
      className={`pointer-events-auto cursor-pointer w-[360px] max-w-[calc(100vw-2rem)] bg-card border border-border rounded-xl shadow-lg overflow-hidden transition-all ${
        t.visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
      }`}
      role="alert"
    >
      <div className="flex items-start gap-3 p-3">
        <div className="shrink-0 w-9 h-9 rounded-full bg-primary/15 text-primary flex items-center justify-center">
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground truncate">{opts.title}</div>
          {opts.body && (
            <div className="text-xs text-muted-foreground line-clamp-2 break-words">{opts.body}</div>
          )}
          <div className="text-[10px] text-muted-foreground/70 mt-1 capitalize">
            {opts.type || 'notification'} · click to open
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); toast.dismiss(t.id); }}
          className="shrink-0 text-muted-foreground hover:text-foreground p-1 rounded transition-colors"
          aria-label="Dismiss notification"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  ), {
    duration: 6000,
    position: 'top-right',
  });
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
      qc.invalidateQueries({ queryKey: ['email-unread'] });
      qc.invalidateQueries({ queryKey: ['emails'] });
      // Bump the bell count
      bump('notifications');
      // Bump the module-specific count
      const mod = typeToModule[notif?.type] || '';
      if (mod) bump(mod);
      playNotificationSound();
      // Floating toast at top — clickable, navigates to deep link
      showNotificationToast({
        title: notif?.title || 'New notification',
        body:  notif?.body  || '',
        type:  notif?.type  || '',
        link:  notif?.link  || '',
      });
    };

    const handleNewMessage = (msg: any) => {
      // Only show if we're not already in the chat room that sent the message
      const currentPath = window.location.pathname;
      const isInRoom = currentPath.includes('/chat') &&
        new URLSearchParams(window.location.search).get('room') === msg?.room_id;
      if (!isInRoom) {
        bump('chat');
        playNotificationSound();
        const senderName = msg?.sender_name || msg?.from_name || 'New message';
        const preview    = (msg?.content || msg?.body || '').slice(0, 140);
        const role       = useAuthStore.getState().user?.role;
        const adminRoles = ['super_admin', 'admin', 'sales_manager', 'sales_rep'];
        const base       = role === 'client'
          ? '/client-portal'
          : adminRoles.includes(role || '') ? '/admin' : '/emp';
        const link       = msg?.room_id ? `${base}/chat?room=${msg.room_id}` : `${base}/chat`;
        showNotificationToast({
          title: senderName,
          body:  preview,
          type:  'message',
          link,
        });
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
