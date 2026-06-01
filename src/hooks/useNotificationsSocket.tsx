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

function ping(ctx: AudioContext, freq: number, startAt: number) {
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, startAt);
  // tiny linear attack so there's no click, then fast exponential decay
  gain.gain.setValueAtTime(0.001, startAt);
  gain.gain.linearRampToValueAtTime(0.9, startAt + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.25);
  osc.start(startAt);
  osc.stop(startAt + 0.26);
}

function playBeep(ctx: AudioContext) {
  // Two ascending pings (WhatsApp-style): low then high, 180ms apart
  ping(ctx, 880,  ctx.currentTime);
  ping(ctx, 1100, ctx.currentTime + 0.18);
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

// Module label for the top bar
function moduleLabel(type: string): string {
  const map: Record<string, string> = {
    task: 'Tasks', mention: 'Chat', message: 'Chat',
    lead: 'CRM', invoice: 'Invoicing', payroll: 'Payroll',
    leave: 'Leave', ticket: 'Support', email: 'Email',
  };
  return map[type] || 'Notification';
}

// Avatar: initials circle for chat, colored icon badge for others
function ToastAvatar({ name, type }: { name: string; type: string }) {
  const Icon = iconForType(type);
  const initials = (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const colors = ['bg-violet-600','bg-blue-600','bg-emerald-600','bg-orange-500','bg-pink-600','bg-cyan-600','bg-rose-600','bg-amber-600'];
  const color  = colors[((name || '').charCodeAt(0) || 0) % colors.length];
  const isChat = type === 'message' || type === 'mention';
  return isChat
    ? <div className={`shrink-0 w-11 h-11 rounded-full ${color} flex items-center justify-center text-white font-bold text-sm`}>{initials}</div>
    : <div className={`shrink-0 w-11 h-11 rounded-2xl ${color} flex items-center justify-center text-white`}><Icon className="h-5 w-5" /></div>;
}

// Unified Teams-style dark popup — chat gets quick-reply input, others get "Open" button
function UnifiedToast({ t, opts, target }: { t: any; opts: any; target: string }) {
  const [reply, setReply] = useState('');
  const isChat = opts.type === 'message' || opts.type === 'mention';

  const sendReply = async () => {
    const txt = reply.trim();
    if (!txt || !opts.roomId) return;
    try { await api.post(`/chat/rooms/${opts.roomId}/messages`, { content: txt, type: 'text' }); } catch {}
    toast.dismiss(t.id);
  };

  return (
    <div className={`pointer-events-auto w-[380px] max-w-[calc(100vw-2rem)] rounded-2xl shadow-2xl overflow-hidden transition-all ${
      t.visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-95'
    }`} style={{ background: 'hsl(225 25% 16%)', border: '1px solid hsl(225 20% 24%)' }}>

      {/* Top bar — app name + module label + dismiss */}
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid hsl(225 20% 22%)' }}>
        <div className="w-4 h-4 rounded bg-primary/80 flex items-center justify-center shrink-0">
          <Bell className="h-2.5 w-2.5 text-white" />
        </div>
        <span className="text-xs font-medium text-white/70 flex-1">Fox Portal · {moduleLabel(opts.type)}</span>
        <button
          onClick={(e) => { e.stopPropagation(); toast.remove(t.id); if (target) window.location.assign(target); }}
          className="text-white/40 hover:text-white/80 text-[11px] px-1 transition-colors">···</button>
        <button
          onClick={(e) => { e.stopPropagation(); toast.remove(t.id); }}
          className="text-white/40 hover:text-white/80 p-1 rounded transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Body — avatar + title + preview */}
      <div className="flex items-start gap-3 px-3 pt-3 pb-2.5 cursor-pointer"
        onClick={() => { toast.remove(t.id); if (target) window.location.assign(target); }}>
        <ToastAvatar name={opts.title} type={opts.type} />
        <div className="flex-1 min-w-0 pt-0.5">
          <div className="text-sm font-bold text-white truncate leading-snug">{opts.title}</div>
          {opts.body && (
            <div className="text-sm text-white/55 line-clamp-2 break-words mt-0.5 leading-snug">{opts.body}</div>
          )}
        </div>
      </div>

      {/* Footer — quick reply for chat, "Open" link for others */}
      {isChat ? (
        <div className="flex items-center mx-3 mb-3 rounded-xl overflow-hidden"
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
            className="p-2 mr-1.5 text-white/40 hover:text-white transition-colors">
            <Send className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-end px-3 pb-3">
          <button
            onClick={(e) => { e.stopPropagation(); toast.remove(t.id); if (target) window.location.assign(target); }}
            className="text-xs font-semibold px-4 py-1.5 rounded-lg transition-colors text-white/80 hover:text-white"
            style={{ background: 'hsl(225 20% 26%)' }}>
            Open
          </button>
        </div>
      )}
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
  toast.custom((t) => <UnifiedToast t={t} opts={opts} target={target} />, {
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

  // Dedup guard — backend now emits new_message to BOTH the room channel
  // (for live UI update) and the member's personal user channel (for
  // notification). Users who have the room open receive it twice; we process
  // it only once by tracking recent message IDs.
  const seenMsgIds = useRef(new Set<string>());

  // ── Idle / away detection ────────────────────────────────────────────────
  // After 10 min with no activity → set status to 'away'.
  // Any activity while away → restore to 'online'.
  // Only the status field is changed — status_text / status_emoji are left
  // untouched so custom statuses aren't accidentally cleared.
  const autoAwayRef  = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;

    const IDLE_MS = 10 * 60 * 1000; // 10 minutes
    const EVENTS  = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'wheel'];

    const emitStatusOnly = (status: string) => {
      try {
        // PATCH only the status field — do NOT send status_text/emoji so we
        // don't accidentally clear a custom status the user set manually.
        api.patch('/users/me/status', { status }).catch(() => {});
        getSocket(accessToken).emit('set_status', { status });
      } catch {}
    };

    const goAway = () => {
      autoAwayRef.current = true;
      emitStatusOnly('away');
    };

    const resetTimer = () => {
      clearTimeout(idleTimerRef.current);
      if (autoAwayRef.current) {
        autoAwayRef.current = false;
        emitStatusOnly('online');
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
      bump('notifications');
      const mod = typeToModule[notif?.type] || '';
      if (mod) bump(mod);
      playNotificationSound();
      showNotificationToast({
        title: notif?.title || 'New notification',
        body:  notif?.body  || '',
        type:  notif?.type  || '',
        link:  notif?.link  || '',
      });
    };

    const handleNewMessage = (msg: any) => {
      // Never process your own messages — you sent it, you don't need an alert
      if (msg?.sender_id === userId) return;

      // Dedup: backend emits to room channel + user channel; process only once
      const msgId = msg?.id;
      if (msgId) {
        if (seenMsgIds.current.has(msgId)) return;
        seenMsgIds.current.add(msgId);
        setTimeout(() => seenMsgIds.current.delete(msgId), 15_000);
      }

      const currentPath     = window.location.pathname;
      const isInCurrentRoom = currentPath.includes('/chat') &&
        new URLSearchParams(window.location.search).get('room') === msg?.room_id;

      // Always play sound — even when the room is open (audible confirmation)
      playNotificationSound();

      // Show toast only when NOT already looking at that room
      if (!isInCurrentRoom) {
        bump('chat');
        const senderName = msg?.sender_name || msg?.from_name || 'New message';
        const preview    = (msg?.content || msg?.body || '').slice(0, 140);
        const role       = useAuthStore.getState().user?.role;
        const adminRoles = ['super_admin', 'admin', 'sales_manager', 'sales_rep'];
        const base       = role === 'client'
          ? '/client-portal'
          : adminRoles.includes(role || '') ? '/admin' : '/emp';
        const link = msg?.room_id ? `${base}/chat?room=${msg.room_id}` : `${base}/chat`;
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

    // new_email fires when IMAP sync saves fresh emails.
    // new_notification (type:'email') is emitted at the same time and already
    // handles sound + toast + badge bump — so here we only refresh query data.
    const handleNewEmail = () => {
      qc.invalidateQueries({ queryKey: ['emails'] });
      qc.invalidateQueries({ queryKey: ['email-unread'] });
    };

    socket.on('new_notification', handleNewNotification);
    socket.on('new_message',      handleNewMessage);
    socket.on('new_email',        handleNewEmail);

    return () => {
      socket.off('new_notification', handleNewNotification);
      socket.off('new_message',      handleNewMessage);
      socket.off('new_email',        handleNewEmail);
    };
  }, [qc, accessToken, isAuthenticated, userId, bump]);
}

export default function NotificationsSocketBridge() {
  useNotificationsSocket();
  return null;
}
