import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Bell, MessageSquare, CheckSquare, FileText, Target,
  Wallet, Calendar, Mail, Ticket, CheckCheck,
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
};

function fmtRelative(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
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

export default function Notifications() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role);
  const clearUnread = useUnreadStore((s) => s.clear);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await api.get('/notifications');
      return (res.data?.data || res.data || []) as Notification[];
    },
    refetchInterval: 30_000,
  });

  const notifications = data || [];

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

  // Clear bell badge on mount — user has now seen them
  useEffect(() => {
    clearUnread('notifications');
  }, [clearUnread]);

  const handleClick = (n: Notification) => {
    if (!n.is_read) markRead.mutate(n.id);
    const target = n.link || fallbackLinkForType(n.type, role);
    if (target) navigate(target);
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Notifications</h1>
            <p className="text-xs text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
            </p>
          </div>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary text-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all read
          </button>
        )}
      </div>

      <div className="glass-card overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
        ) : isError ? (
          <div className="p-6 text-center text-sm text-destructive">
            Could not load notifications.
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-10 text-center">
            <Bell className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No notifications yet.</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              When someone assigns a task, mentions you, or sends a message — it'll show up here.
            </p>
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
                  className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors ${
                    unread ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/40'
                  }`}
                >
                  <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
                    unread ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                  }`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <span className={`text-sm truncate ${unread ? 'font-semibold text-foreground' : 'text-foreground'}`}>
                        {n.title}
                      </span>
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {fmtRelative(n.created_at)}
                      </span>
                    </div>
                    {n.body && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 break-words">
                        {n.body}
                      </p>
                    )}
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[10px] text-muted-foreground/70 capitalize px-1.5 py-0.5 rounded bg-secondary">
                        {n.type}
                      </span>
                      {unread && (
                        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
