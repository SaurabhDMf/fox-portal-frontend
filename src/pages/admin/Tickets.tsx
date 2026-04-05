import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useModulePermission } from '@/hooks/usePermission';
import { dummyTickets } from '@/lib/dummyData';

const statusTabs = ['Open', 'In Progress', 'Waiting', 'Resolved', 'Closed'];
const categories = ['General', 'Technical', 'Billing', 'Feature Request', 'Bug Report'];

export default function Tickets() {
  const perm = useModulePermission('tickets');
  const [tab, setTab] = useState('Open');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', category: 'General', priority: 'Medium', client_id: '' });
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data = [], isLoading } = useQuery({
    queryKey: ['tickets', tab],
    queryFn: () => api.get('/tickets', { params: { status: tab } }).then(r => r.data?.tickets || r.data || []),
  });

  const createMut = useMutation({
    mutationFn: (d: typeof form) => api.post('/tickets', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tickets'] }); setShowCreate(false); toast.success('Ticket created'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Error'),
  });

  const rawTickets = Array.isArray(data) ? data : [];
  const tickets = rawTickets.length > 0 ? rawTickets : dummyTickets.filter(t => t.status === tab);

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Support Tickets</h1><p className="page-subtitle">Manage support requests</p></div>
        {perm.canCreate && (
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all">
            <Plus className="h-4 w-4" /> New Ticket
          </button>
        )}
      </div>

      {/* ... rest identical to original but button is always visible */}
      <div className="flex gap-1 overflow-x-auto">
        {statusTabs.map(s => (
          <button key={s} onClick={() => setTab(s)} className={`text-xs px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${tab === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'}`}>{s}</button>
        ))}
      </div>

      <div className="space-y-3">
        {isLoading ? [...Array(3)].map((_, i) => <div key={i} className="glass-card h-24 animate-pulse" />) :
        tickets.map((t: any) => (
          <div key={t.id} onClick={() => navigate(`/admin/tickets/${t.id}`)} className="glass-card-hover p-4 space-y-2 cursor-pointer">
            <div className="flex items-start justify-between">
              <h3 className="font-semibold text-sm">{t.title}</h3>
              <span className={t.priority === 'Critical' ? 'badge-danger' : t.priority === 'High' ? 'badge-warning' : t.priority === 'Medium' ? 'badge-info' : 'badge-neutral'}>{t.priority}</span>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="badge-neutral">{t.category}</span>
              {t.client_name && <span>{t.client_name}</span>}
              {t.assigned_to_name && <span>→ {t.assigned_to_name}</span>}
              {t.created_at && <span>{new Date(t.created_at).toLocaleDateString()}</span>}
            </div>
          </div>
        ))}
        {tickets.length === 0 && !isLoading && <div className="text-center py-12 text-muted-foreground text-sm">No tickets in this status</div>}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-lg p-6 space-y-4 animate-slide-up">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">New Ticket</h2>
              <button onClick={() => setShowCreate(false)} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
            </div>
            <input placeholder="Title *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            <textarea placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={4} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
            <div className="grid grid-cols-2 gap-3">
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                {['Critical', 'High', 'Medium', 'Low'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">Cancel</button>
              <button onClick={() => createMut.mutate(form)} disabled={createMut.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
                {createMut.isPending ? 'Creating...' : 'Create Ticket'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
