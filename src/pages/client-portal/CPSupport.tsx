import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useState } from 'react';
import { Plus, X, Send, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CPSupport() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);

  const { data = [] } = useQuery({
    queryKey: ['cp-tickets'],
    queryFn: () => api.get('/client/tickets').then(r => r.data?.data || r.data?.tickets || r.data || []),
  });
  const tickets = Array.isArray(data) ? data : [];

  if (selectedTicket) {
    return <TicketThread ticket={selectedTicket} onBack={() => setSelectedTicket(null)} />;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Support</h1><p className="page-subtitle">Your support tickets</p></div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="h-4 w-4" /> New Ticket
        </button>
      </div>

      <div className="glass-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
              <th className="p-4">Subject</th>
              <th className="p-4">Priority</th>
              <th className="p-4">Status</th>
              <th className="p-4">Created</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((t: any) => (
              <tr key={t.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer" onClick={() => setSelectedTicket(t)}>
                <td className="p-4 font-medium text-primary hover:underline">{t.subject || t.title}</td>
                <td className="p-4">
                  <span className={
                    t.priority === 'High' || t.priority === 'Urgent' ? 'badge-danger' :
                    t.priority === 'Medium' ? 'badge-warning' : 'badge-neutral'
                  }>{t.priority}</span>
                </td>
                <td className="p-4">
                  <span className={
                    t.status === 'Open' ? 'badge-warning' :
                    t.status === 'In Progress' ? 'badge-info' :
                    t.status === 'Resolved' || t.status === 'Closed' ? 'badge-success' : 'badge-neutral'
                  }>{t.status}</span>
                </td>
                <td className="p-4 text-muted-foreground">{t.created_at ? new Date(t.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
              </tr>
            ))}
            {tickets.length === 0 && (
              <tr><td colSpan={4} className="p-12 text-center text-muted-foreground text-sm">No tickets found. Create one to get support.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showCreate && <CreateTicketModal onClose={() => setShowCreate(false)} onCreated={(t: any) => {
        qc.setQueryData(['cp-tickets'], (old: any) => [t, ...(Array.isArray(old) ? old : [])]);
        setShowCreate(false);
      }} />}
    </div>
  );
}

function CreateTicketModal({ onClose, onCreated }: { onClose: () => void; onCreated: (t: any) => void }) {
  const [form, setForm] = useState({ subject: '', description: '', priority: 'Medium' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subject.trim()) return;
    setLoading(true);
    try {
      const res = await api.post('/client/tickets', form);
      const ticket = res.data?.data || res.data;
      toast.success('Ticket created');
      onCreated(ticket);
    } catch {
      toast.error('Failed to create ticket');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">New Support Ticket</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-secondary text-muted-foreground"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Subject *</label>
            <input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={4} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Priority</label>
            <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
              <option>Urgent</option>
            </select>
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full text-sm">{loading ? 'Creating...' : 'Create Ticket'}</button>
        </form>
      </div>
    </div>
  );
}

function TicketThread({ ticket, onBack }: { ticket: any; onBack: () => void }) {
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const qc = useQueryClient();

  const { data: detail } = useQuery({
    queryKey: ['cp-ticket-detail', ticket.id],
    queryFn: () => api.get(`/client/tickets/${ticket.id}`).then(r => r.data?.data || r.data || {}),
  });

  const thread = detail?.replies || detail?.thread || detail?.messages || [];

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    try {
      const res = await api.post(`/client/tickets/${ticket.id}/reply`, { message: reply });
      const newMsg = res.data?.data || res.data;
      qc.setQueryData(['cp-ticket-detail', ticket.id], (old: any) => {
        if (!old) return old;
        const key = old.replies ? 'replies' : old.thread ? 'thread' : 'messages';
        return { ...old, [key]: [...(old[key] || []), newMsg] };
      });
      setReply('');
      toast.success('Reply sent');
    } catch {
      toast.error('Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="page-container">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to tickets
      </button>
      <div className="page-header">
        <div>
          <h1 className="page-title">{ticket.subject || ticket.title}</h1>
          <p className="page-subtitle">
            <span className={
              ticket.status === 'Open' ? 'badge-warning' :
              ticket.status === 'In Progress' ? 'badge-info' :
              ticket.status === 'Resolved' || ticket.status === 'Closed' ? 'badge-success' : 'badge-neutral'
            }>{ticket.status}</span>
            <span className="ml-2">{ticket.priority} priority</span>
          </p>
        </div>
      </div>

      {/* Description */}
      {(ticket.description || detail?.description) && (
        <div className="glass-card p-4 mb-4">
          <p className="text-sm">{detail?.description || ticket.description}</p>
          <p className="text-xs text-muted-foreground mt-2">{ticket.created_at ? new Date(ticket.created_at).toLocaleString() : ''}</p>
        </div>
      )}

      {/* Thread */}
      <div className="space-y-3 mb-4">
        {thread.map((msg: any, i: number) => (
          <div key={msg.id || i} className={`glass-card p-4 ${msg.is_internal ? 'border-l-2 border-warning' : ''}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium">{msg.author_name || msg.user_name || 'Support'}</span>
              <span className="text-xs text-muted-foreground">{msg.created_at ? new Date(msg.created_at).toLocaleString() : ''}</span>
            </div>
            <p className="text-sm">{msg.message || msg.body || msg.content}</p>
          </div>
        ))}
      </div>

      {/* Reply box */}
      <form onSubmit={handleReply} className="glass-card p-4 flex gap-3">
        <textarea value={reply} onChange={e => setReply(e.target.value)} placeholder="Type your reply..." rows={2}
          className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
        <button type="submit" disabled={sending} className="btn-primary self-end flex items-center gap-1 text-sm px-4">
          <Send className="h-4 w-4" /> Send
        </button>
      </form>
    </div>
  );
}
