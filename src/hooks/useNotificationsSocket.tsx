import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Bell, MessageSquare, CheckSquare, FileText, Target,
  Wallet, Calendar, Mail, Ticket, X, Send,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useUnreadStore, typeToModule } from '@/stores/unreadStore';
import { getSocket } from '@/hooks/useSocket';
import api from '@/lib/api';

// Singleton AudioContext — created once, unlocked on first user gesture
let _audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext {
  if (!_audioCtx || _audioCtx.state === 'closed') {
    _audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return _audioCtx;
}

// Call on any user interaction so the context is pre-unlocked for future sounds
export function unlockAudioContext() {
  try {
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  } catch {}
}

function playBeep(ctx: AudioContext) {
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = 'sine';
  // Two-tone ping: high → low
  osc.frequency.setValueAtTime(940, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(520, ctx.currentTime + 0.12);
  gain.gain.setValueAtTime(0.35, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.3);
}

function playNotificationSound() {
  try {
    const ctx = getAudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().then(() => playBeep(ctx)).catch(() => {});
    } else {
      playBeep(ctx);
    }
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

// Avatar initials helper for toast
function ToastAvatar({ name, type }: { name: string; type: string }) {
  const Icon = iconForType(type);
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const colors = ['bg-violet-600','bg-blue-600','bg-emerald-600','bg-orange-500','bg-pink-600','bg-cyan-600'];
  const color  = colors[(name.charCodeAt(0) || 0) % colors.length];
  if (type === 'message' || type === 'mention') {
    return (
      <div className={`shrink-0 w-11 h-11 rounded-full ${color} flex items-center justify-center text-white font-bold text-sm`}>
        {initials}
      </div>
    );
  }
  return (
    <div className="shrink-0 w-11 h-11 rounded-full bg-primary/20 flex items-center justify-center text-primary">
      <Icon className="h-5 w-5" />
    </div>
  );
}

// Quick-reply toast — chat messages get an inline reply input (like Teams popup)
function ChatToast({ t, opts, target }: { t: any; opts: any; target: string }) {
  const [reply, setReply] = useState('');

  const sendReply = async () => {
    const txt = reply.trim();
    if (!txt) return;
    const roomId = opts.roomId;
    if (roomId) {
      try {
        await api.post(`/chat/rooms/${roomId}/messages`, { content: txt, type: 'text' });
      } catch {}
    }
    toast.dismiss(t.id);
  };

  return (
    <div className={`pointer-events-auto w-[380px] max-w-[calc(100vw-2rem)] rounded-2xl shadow-2xl overflow-hidden transition-all ${
      t.visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-95'
    }`} style={{ background: 'hsl(225 25% 16%)', border: '1px solid hsl(225 20% 24%)' }}>
      {/* Top bar */}
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid hsl(225 20% 22%)' }}>
        <div className="w-4 h-4 rounded bg-primary/80 flex items-center justify-center shrink-0">
          <MessageSquare className="h-2.5 w-2.5 text-white" />
        </div>
        <span className="text-xs font-medium text-white/70 flex-1">Fox Portal</span>
        <button onClick={() => { toast.dismiss(t.id); if (target) window.location.assign(target); }}
          className="text-white/40 hover:text-white/80 text-[10px] transition-colors">···</button>
        <button onClick={() => toast.dismiss(t.id)}
          className="text-white/40 hover:text-white/80 p-0.5 rounded transition-colors" aria-label="Dismiss">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex items-start gap-3 px-3 pt-3 pb-2 cursor-pointer"
        onClick={() => { toast.dismiss(t.id); if (target) window.location.assign(target); }}>
        <ToastAvatar name={opts.title} type={opts.type} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-white truncate">{opts.title}</div>
          {opts.body && (
            <div className="text-sm text-white/60 line-clamp-2 break-words mt-0.5">{opts.body}</div>
          )}
        </div>
      </div>

      {/* Quick reply */}
      <div className="flex items-center gap-2 mx-3 mb-3 mt-1 rounded-xl overflow-hidden"
        style={{ background: 'hsl(225 20% 22%)', border: '1px solid hsl(225 20% 28%)' }}>
        <input
          value={reply}
          onChange={e => setReply(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } e.stopPropagation(); }}
          onClick={e => e.stopPropagation()}
          placeholder="Send a quick reply"
          className="flex-1 bg-transparent text-sm text-white px-3 py-2.5 focus:outline-none placeholder:text-white/30"
        />
        <button onClick={e => { e.stopPropagation(); sendReply(); }}
          className="p-2 mr-1 text-white/50 hover:text-white transition-colors">
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// Generic notification toast (non-chat)
function NotifToast({ t, opts, target }: { t: any; opts: any; target: string }) {
  return (
    <div
      onClick={() => { toast.dismiss(t.id); if (target) window.location.assign(target); }}
      className={`pointer-events-auto cursor-pointer w-[360px] max-w-[calc(100vw-2rem)] bg-card border border-border rounded-2xl shadow-xl overflow-hidden transition-all ${
        t.visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-95'
      }`}
      role="alert"
    >
      <div className="flex items-start gap-3 p-3.5">
        <ToastAvatar name={opts.title} type={opts.type} />
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="text-sm font-semibold text-foreground truncate">{opts.title}</div>
          {opts.body && (
            <div className="text-xs text-muted-foreground line-clamp-2 break-words mt-0.5">{opts.body}</div>
          )}
          <div className="text-[10px] text-muted-foreground/50 mt-1.5 capitalize">
            {opts.type || 'notification'} · click to open
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); toast.dismiss(t.id); }}
          className="shrink-0 text-muted-foreground hover:text-foreground p-1 rounded-lg transition-colors mt-0.5"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function showNotificationToast(opts: {
  title: string;
  body: string;
  type: string;
  link: string;
  roomId?: string;
}) {
  const target = opts.link || fallbackLinkForType(opts.type);
  const isChat = opts.type === 'message' || opts.type === 'mention';

  toast.custom((t) => isChat
    ? <ChatToast t={t} opts={opts} target={target} />
    : <NotifToast t={t} opts={opts} target={target} />,
  {
    duration: 7000,
    position: 'top-right',
  });
}

export function useNotificationsSocket() {
  const qc              = useQueryClient();
  const accessToken     = useAuthStore((s) => s.accessToken);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userId          = useAuthStore((s) => s.user?.id);
  const { bump }        = useUnreadStore();

  // ── Idle / away detection ────────────────────────────────────────────────
  // After 5 min with no mouse/keyboard/scroll activity → set status to 'away'
  // Any activity while away → restore to 'online'
  const autoAwayRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;

    const IDLE_MS = 5 * 60 * 1000;
    const EVENTS  = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'wheel'];

    const emitStatus = (status: string) => {
      try {
        api.patch('/users/me/status', { status, status_text: null, status_emoji: null }).catch(() => {});
        getSocket(accessToken).emit('set_status', { status, status_text: null, status_emoji: null });
      } catch {}
    };

    const goAway = () => {
      autoAwayRef.current = true;
      emitStatus('away');
    };

    const resetTimer = () => {
      clearTimeout(idleTimerRef.current);
      if (autoAwayRef.current) {
        autoAwayRef.current = false;
        emitStatus('online');
      }
      idleTimerRef.current = setTimeout(goAway, IDLE_MS);
    };

    EVENTS.forEach(ev => window.addEventListener(ev, resetTimer, { passive: true }));
    idleTimerRef.current = setTimeout(goAway, IDLE_MS);

    return () => {
      clearTimeout(idleTimerRef.current);
      EVENTS.forEach(ev => window.removeEventListener(ev, resetTimer));
    };
  }, [isAuthenticated, accessToken]);

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
      const currentPath = window.location.pathname;
      const isInCurrentRoom = currentPath.includes('/chat') &&
        new URLSearchParams(window.location.search).get('room') === msg?.room_id;

      // Always play sound for every incoming message
      playNotificationSound();

      // Show toast for any message NOT in the currently active room
      // (if you're already watching the room the messages appear live — no extra toast needed)
      if (!isInCurrentRoom) {
        bump('chat');
        const senderName = msg?.sender_name || msg?.from_name || 'New message';
        const preview    = (msg?.content || msg?.body || '').slice(0, 140);
        const role       = useAuthStore.getState().user?.role;
        const adminRoles = ['super_admin', 'admin', 'sales_manager', 'sales_rep'];
        const base       = role === 'client'
          ? '/client-portal'
          : adminRoles.includes(role || '') ? '/admin' : '/emp';
        const link       = msg?.room_id ? `${base}/chat?room=${msg.room_id}` : `${base}/chat`;
        showNotificationToast({
          title:  senderName,
          body:   preview,
          type:   'message',
          link,
          roomId: msg?.room_id,
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
