import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';
import { ArrowLeft, Send } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';

export default function CPTicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const qc = useQueryClient();
  const [reply, setReply] = useState('');
  const threadRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['cp-ticket', id],
    queryFn: () => api.get(`/client/tickets/${id}`).then(r => r.data?.data || r.data || {}),
    enabled: !!id,
  });

  const ticket = data || {};
  const replies = ticket.replies || ticket.messages || ticket.thread || [];

  const replyMut = useMutation({
    mutationFn: () => api.post(`/client/tickets/${id}/reply`, { message: reply }).then(r => r.data?.data || r.data),
    onSuccess: (newReply) => {
      const replyObj = newReply || { id: Date.now(), message: reply, sender_name: user?.full_name, sender_type: 'client', created_at: new Date().toISOString() };
      qc.setQueryData(['cp-ticket', id], (old: any) => {
        if (!old) return old;
        const thread = old.replies || old.messages || old.thread || [];
        return { ...old, replies: [...thread, replyObj], messages: [...thread, replyObj], thread: [...thread, replyObj] };
      });
      setReply('');
      toast.success('Reply sent');
    },
    onError: () => toast.error('Failed to send reply'),
  });

  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [replies.length]);

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const fmtTime = (d: string) => d ? new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';

  if (isLoading) return <div className="page-container"><div className="text-center py-20 text-muted-foreground">Loading...</div></div>;

  return (
    <div className="page-container">
      <button onClick={() => navigate('/client-portal/support')} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to Support
      </button>

      {/* Header */}
      <div className="glass-card p-5 mb-4">
        <div className="flex flex-col sm:flex-row justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold">{ticket.subject}</h1>
            <div className="text-xs text-muted-foreground mt-1">Created {fmtDate(ticket.created_at)}</div>
          </div>
          <div className="flex items-center gap-2">
            <PriorityBadge priority={ticket.priority} />
            <StatusBadge status={ticket.status} />
          </div>
        </div>
        {ticket.description && <p className="text-sm text-muted-foreground mt-3 border-t border-border pt-3">{ticket.description}</p>}
      </div>

      {/* Thread */}
      <div className="glass-card flex flex-col" style={{ height: 'calc(100vh - 340px)', minHeight: '300px' }}>
        <div ref={threadRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {replies.length === 0 && <div className="text-center text-muted-foreground text-sm py-8">No replies yet</div>}
          {replies.map((r: any, i: number) => {
            const isClient = r.sender_type === 'client' || r.user_id === user?.id;
            return (
              <div key={r.id || i} className={`flex ${isClient ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-xl px-4 py-2.5 ${isClient ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'}`}>
                  <div className="text-xs font-medium mb-1 opacity-80">{r.sender_name || r.user_name || (isClient ? 'You' : 'Staff')}</div>
                  <div className="text-sm whitespace-pre-wrap">{r.message || r.body || r.content}</div>
                  <div className={`text-[10px] mt-1 ${isClient ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>{fmtTime(r.created_at)}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Reply box */}
        <div className="border-t border-border p-3 flex gap-2">
          <textarea value={reply} onChange={e => setReply(e.target.value)} rows={1} placeholder="Type your reply..."
            className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && reply.trim()) { e.preventDefault(); replyMut.mutate(); } }} />
          <button onClick={() => replyMut.mutate()} disabled={!reply.trim() || replyMut.isPending}
            className="px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls = status === 'Open' ? 'bg-info/15 text-info' : status === 'In Progress' ? 'bg-warning/15 text-warning' : status === 'Resolved' ? 'bg-success/15 text-success' : 'bg-secondary text-muted-foreground';
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{status}</span>;
}

function PriorityBadge({ priority }: { priority: string }) {
  const cls = priority === 'High' ? 'bg-destructive/15 text-destructive' : priority === 'Medium' ? 'bg-warning/15 text-warning' : 'bg-secondary text-muted-foreground';
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{priority}</span>;
}
