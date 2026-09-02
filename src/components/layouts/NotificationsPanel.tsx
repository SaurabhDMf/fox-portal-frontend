import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Bell, MessageSquare, CheckSquare, FileText, Target,
  Wallet, Calendar, Mail, Ticket, CheckCheck, X,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useUnreadStore } from '@/stores/unreadStore';

interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  link?: string | null;
  is_read: number | boolean;
  created_at: string;
}

const ICON_MAP: Record<string, any> = {
  task: CheckSquare,
  mention: MessageSquare,
  message: MessageSquare,
  lead: Target,
  invoice: FileText,
  payroll: Wallet,
  leave: Calendar,
  ticket: Ticket,
  email: Mail,
  inbox_reply: Mail,
};

function fmtRelative(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function fallbackLinkForType(type: string, role?: string): string {
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
    default:        return base;
  }
}

// Dropdown notification panel anchored under the header bell — replaces the
// old behavior of fully navigating to a /notifications page with no way back
// other than re-clicking the bell. Click-outside or the × closes it; a
// "View all" link is still available for anyone who wants the full page.
export default function NotificationsPanel({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role);
  const clearUnread = useUnreadStore((s) => s.clear);

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await api.get('/notifications');
      return (res.data?.data || res.data || []) as Notification[];
    },
  });

  const notifications = (data || []).slice(0, 8);

  const markRead = useMutation({
    mutationFn: (id: string) => api.put(`/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllRead = useMutation({
    mutationFn: () => api.put('/notifications/read-all'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      clearUnread('notifications');
    },
  });

  const unreadCount = (data || []).filter((n) => !n.is_read).length;

  const handleClick = (n: Notification) => {
    if (!n.is_read) markRead.mutate(n.id);
    const target = n.link || fallbackLinkForType(n.type, role);
    onClose();
    if (target) navigate(target);
  };

  return (
    <div className="absolute right-0 top-11 z-50 w-80 max-w-[calc(100vw-2rem)] bg-popover border border-border rounded-xl shadow-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
        <span className="text-sm font-semibold text-foreground">Notifications</span>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              title="Mark all read"
              className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              <CheckCheck className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={onClose}
            title="Close"
            className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="max-h-[60vh] overflow-y-auto">
        {isLoading ? (
          <div className="p-6 text-center text-xs text-muted-foreground">Loading…</div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center">
            <Bell className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No notifications yet.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {notifications.map((n) => {
              const Icon = ICON_MAP[n.type] || Bell;
              const unread = !n.is_read;
              return (
                <li
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`flex items-start gap-2.5 px-3 py-2.5 cursor-pointer transition-colors ${
                    unread ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/40'
                  }`}
                >
                  <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                    unread ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                  }`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <span className={`text-xs truncate ${unread ? 'font-semibold text-foreground' : 'text-foreground'}`}>
                        {n.title}
                      </span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{fmtRelative(n.created_at)}</span>
                    </div>
                    {n.body && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 break-words">{n.body}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <button
        onClick={() => {
          onClose();
          const base = role === 'client' ? '/client-portal' : (['super_admin', 'admin', 'sales_manager', 'sales_rep'].includes(role || '') ? '/admin' : '/emp');
          navigate(`${base}/notifications`);
        }}
        className="w-full px-3 py-2 text-xs font-medium text-center text-primary hover:bg-secondary/60 border-t border-border transition-colors"
      >
        View all notifications
      </button>
    </div>
  );
}
