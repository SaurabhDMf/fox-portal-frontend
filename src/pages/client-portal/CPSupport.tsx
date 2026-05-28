import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';

const STATUS_FILTERS = ['All', 'Open', 'In Progress', 'Resolved', 'Closed'];

export default function CPSupport() {
  const [filter, setFilter] = useState('All');
  const [showCreate, setShowCreate] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data = [] } = useQuery({
    queryKey: ['cp-tickets'],
    queryFn: () => api.get('/client/tickets').then(r => r.data?.data || r.data?.tickets || r.data || []),
  });
  const tickets = Array.isArray(data) ? data : [];
  const filtered = filter === 'All' ? tickets : tickets.filter((t: any) => t.status === filter);

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Support</h1><p className="page-subtitle">View and manage your support tickets</p></div>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5">
          <Plus className="h-4 w-4" /> New Ticket
        </button>
      </div>

      <div className="flex flex-wrap gap-1 mb-4">
        {STATUS_FILTERS.map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === s ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
            {s}
          </button>
        ))}
      </div>

      <div className="glass-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
              <th className="p-4">Subject</th>
              <th className="p-4">Priority</th>
              <th className="p-4">Status</th>
              <th className="p-4">Replies</th>
              <th className="p-4">Created</th>
              <th className="p-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t: any) => (
              <tr key={t.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                <td className="p-4 font-medium">{t.subject}</td>
                <td className="p-4"><PriorityBadge priority={t.priority} /></td>
                <td className="p-4"><TicketStatusBadge status={t.status} /></td>
                <td className="p-4 text-muted-foreground">{t.replies_count ?? t.replies ?? 0}</td>
                <td className="p-4 text-muted-foreground">{fmtDate(t.created_at)}</td>
                <td className="p-4">
                  <button onClick={() => navigate(`/client-portal/support/${t.id}`)}
                    className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs">
                    <MessageSquare className="h-4 w-4" /> View
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="p-12 text-center text-muted-foreground text-sm">No tickets found. Create one using the button above.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showCreate && <CreateTicketModal onClose={() => setShowCreate(false)} onCreated={(ticket: any) => {
        qc.setQueryData(['cp-tickets'], (old: any) => Array.isArray(old) ? [ticket, ...old] : [ticket]);
        setShowCreate(false);
      }} />}
    </div>
  );
}

function CreateTicketModal({ onClose, onCreated }: { onClose: () => void; onCreated: (t: any) => void }) {
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('Medium');

  const createMut = useMutation({
    mutationFn: () => api.post('/client/tickets', { subject, description, priority }).then(r => r.data?.data || r.data),
    onSuccess: (data) => { toast.success('Ticket created'); onCreated(data); },
    onError: () => toast.error('Failed to create ticket'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <h2 className="text-lg font-semibold mb-4">New Support Ticket</h2>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-foreground">Subject *</label>
            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Brief subject..."
              className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} placeholder="Describe your issue..."
              className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Priority</label>
            <select value={priority} onChange={e => setPriority(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-border hover:bg-secondary transition-colors">Cancel</button>
          <button onClick={() => createMut.mutate()} disabled={!subject.trim() || createMut.isPending}
            className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
            {createMut.isPending ? 'Creating...' : 'Create Ticket'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TicketStatusBadge({ status }: { status: string }) {
  const cls =
    status === 'Open' ? 'bg-info/15 text-info' :
    status === 'In Progress' ? 'bg-warning/15 text-warning' :
    status === 'Resolved' ? 'bg-success/15 text-success' :
    status === 'Closed' ? 'bg-secondary text-muted-foreground' :
    'bg-secondary text-muted-foreground';
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{status}</span>;
}

function PriorityBadge({ priority }: { priority: string }) {
  const cls =
    priority === 'High' ? 'bg-destructive/15 text-destructive' :
    priority === 'Medium' ? 'bg-warning/15 text-warning' :
    'bg-secondary text-muted-foreground';
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{priority}</span>;
}
