import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useState } from 'react';
import { Plus, X, Send, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

const categories = ['General', 'Technical', 'Billing', 'Feature Request', 'Bug Report'];

export default function ClientSupport() {
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [form, setForm] = useState({ title: '', description: '', category: 'General', priority: 'Medium' });
  const [reply, setReply] = useState('');
  const qc = useQueryClient();

  const { data = [] } = useQuery({
    queryKey: ['my-tickets'],
    queryFn: () => api.get('/tickets').then(r => r.data?.tickets || r.data || []),
  });

  const createMut = useMutation({
    mutationFn: (d: typeof form) => api.post('/tickets', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-tickets'] });
      setShowCreate(false);
      setForm({ title: '', description: '', category: 'General', priority: 'Medium' });
      toast.success('Ticket created');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Error'),
  });

  const replyMut = useMutation({
    mutationFn: (content: string) => api.post(`/tickets/${selectedTicket?.id}/replies`, { content }),
    onSuccess: () => { loadTicketDetail(selectedTicket.id); setReply(''); toast.success('Reply sent'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Error'),
  });

  const loadTicketDetail = async (id: string) => {
    try {
      const { data } = await api.get(`/tickets/${id}`);
      setSelectedTicket(data);
    } catch {
      toast.error('Could not load ticket');
    }
  };

  const tickets = Array.isArray(data) ? data : [];
  const replies = selectedTicket?.replies || [];

  if (selectedTicket) {
    return (
      <div className="page-container">
        <button onClick={() => setSelectedTicket(null)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Tickets
        </button>

        <div className="glass-card p-6 mb-4">
          <div className="flex items-start justify-between mb-3">
            <h1 className="text-lg font-bold">{selectedTicket.title}</h1>
            <div className="flex gap-2">
              <span className={selectedTicket.priority === 'Critical' ? 'badge-danger' : selectedTicket.priority === 'High' ? 'badge-warning' : 'badge-info'}>{selectedTicket.priority}</span>
              <span className={selectedTicket.status === 'Resolved' || selectedTicket.status === 'Closed' ? 'badge-success' : 'badge-warning'}>{selectedTicket.status}</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{selectedTicket.description}</p>
          <div className="mt-3 flex gap-2 text-xs text-muted-foreground">
            {selectedTicket.category && <span className="badge-neutral">{selectedTicket.category}</span>}
            {selectedTicket.created_at && <span>{new Date(selectedTicket.created_at).toLocaleString()}</span>}
          </div>
        </div>

        <div className="glass-card p-6">
          <h2 className="font-semibold mb-4">Replies</h2>
          <div className="space-y-4 mb-6">
            {replies.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No replies yet. Our team will respond shortly.</p>
            ) : (
              replies.filter((r: any) => !r.is_internal).map((r: any, i: number) => (
                <div key={r.id || i} className="p-3 rounded-lg bg-secondary/50">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-bold text-primary">{r.author_name?.[0] || 'S'}</div>
                      <span className="text-sm font-medium">{r.author_name || 'Support'}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{r.created_at ? new Date(r.created_at).toLocaleString() : ''}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{r.content}</p>
                </div>
              ))
            )}
          </div>

          <div className="space-y-2">
            <textarea value={reply} onChange={e => setReply(e.target.value)} placeholder="Write a reply..." rows={3} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
            <div className="flex justify-end">
              <button
                onClick={() => reply.trim() && replyMut.mutate(reply)}
                disabled={!reply.trim() || replyMut.isPending}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50 flex items-center gap-2"
              >
                <Send className="h-4 w-4" /> Reply
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Support</h1><p className="page-subtitle">Get help from our team</p></div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all">
          <Plus className="h-4 w-4" /> New Ticket
        </button>
      </div>

      <div className="space-y-3">
        {tickets.map((t: any) => (
          <div key={t.id} onClick={() => loadTicketDetail(t.id)} className="glass-card-hover p-4 space-y-2 cursor-pointer">
            <div className="flex items-start justify-between">
              <h3 className="font-semibold text-sm">{t.title}</h3>
              <div className="flex gap-2">
                <span className={t.priority === 'Critical' ? 'badge-danger' : t.priority === 'High' ? 'badge-warning' : 'badge-info'}>{t.priority}</span>
                <span className={t.status === 'Resolved' || t.status === 'Closed' ? 'badge-success' : 'badge-warning'}>{t.status}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>
            <div className="flex gap-2 text-xs text-muted-foreground">
              {t.category && <span className="badge-neutral">{t.category}</span>}
              {t.created_at && <span>{new Date(t.created_at).toLocaleDateString()}</span>}
            </div>
          </div>
        ))}
        {tickets.length === 0 && <div className="text-center py-12 text-muted-foreground text-sm">No tickets yet. Create one to get started.</div>}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-lg p-6 space-y-4 animate-slide-up">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">New Support Ticket</h2>
              <button onClick={() => setShowCreate(false)} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
            </div>
            <input placeholder="Title *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            <textarea placeholder="Describe your issue..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={4} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
            <div className="grid grid-cols-2 gap-3">
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                {['Critical', 'High', 'Medium', 'Low'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors">Cancel</button>
              <button onClick={() => createMut.mutate(form)} disabled={createMut.isPending || !form.title} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
                {createMut.isPending ? 'Submitting...' : 'Submit Ticket'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
