import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { useState } from 'react';
import { ArrowLeft, Send, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';

export default function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);
  const [reply, setReply] = useState('');
  const [isInternal, setIsInternal] = useState(false);

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['ticket', id],
    queryFn: () => api.get(`/tickets/${id}`).then(r => r.data),
    enabled: !!id,
  });

  const replyMut = useMutation({
    mutationFn: (content: string) => api.post(`/tickets/${id}/replies`, { content, is_internal: isInternal }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ticket', id] }); setReply(''); toast.success('Reply sent'); },
  });

  const statusMut = useMutation({
    mutationFn: (status: string) => api.put(`/tickets/${id}`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ticket', id] }); toast.success('Status updated'); },
  });

  if (isLoading) return <div className="page-container"><div className="glass-card h-64 animate-pulse" /></div>;
  if (!ticket) return <div className="page-container"><p className="text-muted-foreground">Ticket not found</p></div>;

  const priorities: Record<string, string> = { Critical: 'badge-danger', High: 'badge-warning', Medium: 'badge-info', Low: 'badge-neutral' };
  const replies = ticket.replies || [];

  return (
    <div className="page-container">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Tickets
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* Ticket header */}
          <div className="glass-card p-6">
            <div className="flex items-start justify-between mb-3">
              <h1 className="text-xl font-bold">{ticket.title}</h1>
              <div className="flex gap-2">
                <span className={priorities[ticket.priority] || 'badge-neutral'}>{ticket.priority}</span>
                <span className="badge-info">{ticket.status}</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{ticket.description}</p>
            <div className="mt-3 flex gap-2 text-xs text-muted-foreground">
              {ticket.category && <span className="badge-neutral">{ticket.category}</span>}
              {ticket.created_at && <span>{new Date(ticket.created_at).toLocaleString()}</span>}
            </div>
          </div>

          {/* Replies */}
          <div className="glass-card p-6">
            <h2 className="font-semibold mb-4">Replies</h2>
            <div className="space-y-4 mb-6">
              {replies.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No replies yet</p>
              ) : (
                replies.map((r: any, i: number) => (
                  <div key={r.id || i} className={`p-3 rounded-lg ${r.is_internal ? 'bg-warning/5 border border-warning/20' : 'bg-secondary/50'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-bold text-primary">{r.author_name?.[0] || 'U'}</div>
                        <span className="text-sm font-medium">{r.author_name || 'User'}</span>
                        {r.is_internal && <span className="text-[10px] badge-warning flex items-center gap-0.5"><Lock className="h-2.5 w-2.5" /> Internal</span>}
                      </div>
                      <span className="text-xs text-muted-foreground">{r.created_at ? new Date(r.created_at).toLocaleString() : ''}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{r.content}</p>
                  </div>
                ))
              )}
            </div>

            {/* Reply form */}
            <div className="space-y-2">
              <textarea value={reply} onChange={e => setReply(e.target.value)} placeholder="Write a reply..." rows={3} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
              <div className="flex items-center justify-between">
                {user?.role !== 'client' && (
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <input type="checkbox" checked={isInternal} onChange={e => setIsInternal(e.target.checked)} className="rounded" />
                    Internal note
                  </label>
                )}
                <button
                  onClick={() => reply.trim() && replyMut.mutate(reply)}
                  disabled={!reply.trim() || replyMut.isPending}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50 flex items-center gap-2 ml-auto"
                >
                  <Send className="h-4 w-4" /> Reply
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="glass-card p-5 space-y-3">
            <h3 className="text-sm font-semibold">Actions</h3>
            <div className="space-y-2">
              {['Open', 'In Progress', 'Waiting', 'Resolved', 'Closed'].map(s => (
                <button
                  key={s}
                  onClick={() => statusMut.mutate(s)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${ticket.status === s ? 'bg-primary/15 text-primary font-medium' : 'text-muted-foreground hover:bg-secondary'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="glass-card p-5 space-y-2 text-sm">
            <h3 className="text-sm font-semibold mb-2">Info</h3>
            <div className="flex justify-between"><span className="text-muted-foreground">Client</span><span>{ticket.client_name || '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Assigned</span><span>{ticket.assigned_to_name || '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Category</span><span>{ticket.category || '—'}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
