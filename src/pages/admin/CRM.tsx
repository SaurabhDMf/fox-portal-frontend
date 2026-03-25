import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Plus, Search, List, LayoutGrid, X } from 'lucide-react';
import toast from 'react-hot-toast';

const statuses = ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation', 'Closed Won', 'Closed Lost'];
const priorities = [
  { value: 'Critical', color: 'badge-danger' },
  { value: 'High', color: 'badge-warning' },
  { value: 'Medium', color: 'badge-info' },
  { value: 'Low', color: 'badge-neutral' },
];
const sources = ['Referral', 'Cold Call', 'Website', 'Social Media', 'Email', 'Event', 'Other'];

export default function CRM() {
  const navigate = useNavigate();
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const canCreate = useAuthStore(s => s.canCreate);
  const qc = useQueryClient();

  const [form, setForm] = useState({
    full_name: '', company_name: '', email: '', phone: '', lead_source: 'Website',
    status: 'New', priority: 'Medium', deal_value: '', assigned_to: '', client_id: '', next_followup: '', notes: '', lead_by: '',
  });

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads', search, statusFilter],
    queryFn: () => api.get('/leads', { params: { search, status: statusFilter || undefined } }).then(r => r.data?.leads || r.data || []),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => api.get('/users').then(r => r.data?.users || r.data || []),
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients-list'],
    queryFn: () => api.get('/clients').then(r => r.data?.clients || r.data || []),
    enabled: showCreate,
  });

  const createMut = useMutation({
    mutationFn: (d: typeof form) => api.post('/leads', { ...d, deal_value: d.deal_value ? Number(d.deal_value) : undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      setShowCreate(false);
      setForm({ full_name: '', company_name: '', email: '', phone: '', lead_source: 'Website', status: 'New', priority: 'Medium', deal_value: '', assigned_to: '', client_id: '', next_followup: '', notes: '', lead_by: '' });
      toast.success('Lead created');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Error'),
  });

  const leadsArr = Array.isArray(leads) ? leads : [];
  const usersArr = Array.isArray(users) ? users : [];
  const clientsArr = Array.isArray(clients) ? clients : [];

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Sales CRM</h1><p className="page-subtitle">Manage your sales pipeline</p></div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg overflow-hidden border border-border">
            <button onClick={() => setView('kanban')} className={`p-2 ${view === 'kanban' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-secondary'} transition-colors`}><LayoutGrid className="h-4 w-4" /></button>
            <button onClick={() => setView('list')} className={`p-2 ${view === 'list' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-secondary'} transition-colors`}><List className="h-4 w-4" /></button>
          </div>
          {canCreate('crm') && (
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all">
              <Plus className="h-4 w-4" /> New Lead
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search leads..." className="w-full pl-10 pr-4 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setStatusFilter('')} className={`text-xs px-3 py-1.5 rounded-full transition-colors ${!statusFilter ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>All</button>
          {statuses.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`text-xs px-3 py-1.5 rounded-full transition-colors ${statusFilter === s ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>{s}</button>
          ))}
        </div>
      </div>

      {/* Kanban View */}
      {view === 'kanban' && (
        <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
          {statuses.map(status => {
            const col = leadsArr.filter((l: any) => l.status === status);
            return (
              <div key={status} className="min-w-[280px] flex-shrink-0">
                <div className="flex items-center justify-between mb-3 px-1">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{status}</h3>
                  <span className="text-xs bg-secondary px-2 py-0.5 rounded-full text-muted-foreground">{col.length}</span>
                </div>
                <div className="space-y-2">
                  {col.map((lead: any) => (
                    <div key={lead.id} onClick={() => navigate(`/admin/crm/${lead.id}`)} className="glass-card-hover p-3 space-y-2 cursor-pointer">
                      <div className="flex items-start justify-between">
                        <div className="font-medium text-sm">{lead.full_name}</div>
                        <span className={priorities.find(p => p.value === lead.priority)?.color || 'badge-neutral'}>{lead.priority}</span>
                      </div>
                      {lead.company_name && <div className="text-xs text-muted-foreground">{lead.company_name}</div>}
                      <div className="flex items-center justify-between">
                        {lead.deal_value && <span className="text-sm font-semibold text-[hsl(var(--success))]">${Number(lead.deal_value).toLocaleString()}</span>}
                        {lead.lead_source && <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{lead.lead_source}</span>}
                      </div>
                      {lead.assigned_to_name && (
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center text-[8px] font-bold text-primary">{lead.assigned_to_name[0]}</div>
                          <span className="text-[10px] text-muted-foreground">{lead.assigned_to_name}</span>
                        </div>
                      )}
                    </div>
                  ))}
                  {col.length === 0 && <div className="text-xs text-muted-foreground text-center py-8 border border-dashed border-border rounded-lg">No leads</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List View */}
      {view === 'list' && (
        <div className="glass-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="p-4">Name</th><th className="p-4">Company</th><th className="p-4">Status</th><th className="p-4">Priority</th><th className="p-4">Deal Value</th><th className="p-4">Source</th><th className="p-4">Assigned</th>
              </tr>
            </thead>
            <tbody>
              {leadsArr.map((lead: any) => (
                <tr key={lead.id} onClick={() => navigate(`/admin/crm/${lead.id}`)} className="border-b border-border/50 hover:bg-secondary/50 transition-colors cursor-pointer">
                  <td className="p-4 font-medium">{lead.full_name}</td>
                  <td className="p-4 text-muted-foreground">{lead.company_name || '—'}</td>
                  <td className="p-4"><span className={lead.status === 'Closed Won' ? 'badge-success' : lead.status === 'Closed Lost' ? 'badge-danger' : 'badge-info'}>{lead.status}</span></td>
                  <td className="p-4"><span className={priorities.find(p => p.value === lead.priority)?.color || 'badge-neutral'}>{lead.priority}</span></td>
                  <td className="p-4 font-medium">{lead.deal_value ? `$${Number(lead.deal_value).toLocaleString()}` : '—'}</td>
                  <td className="p-4 text-muted-foreground">{lead.lead_source}</td>
                  <td className="p-4 text-muted-foreground">{lead.assigned_to_name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-lg p-6 space-y-4 animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Create Lead</h2>
              <button onClick={() => setShowCreate(false)} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input placeholder="Full Name *" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              <input placeholder="Company Name" value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              <input placeholder="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              <input placeholder="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              <input placeholder="Deal Value" type="number" value={form.deal_value} onChange={e => setForm(f => ({ ...f, deal_value: e.target.value }))} className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              <select value={form.lead_source} onChange={e => setForm(f => ({ ...f, lead_source: e.target.value }))} className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                {sources.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                {statuses.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                {priorities.map(p => <option key={p.value} value={p.value}>{p.value}</option>)}
              </select>
              <select value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                <option value="">Assign To</option>
                {usersArr.map((u: any) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
              <select value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))} className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                <option value="">Link Client (optional)</option>
                {clientsArr.map((c: any) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
              </select>
              <input type="date" placeholder="Next Follow-up" value={form.next_followup} onChange={e => setForm(f => ({ ...f, next_followup: e.target.value }))} className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              <select value={form.lead_by} onChange={e => setForm(f => ({ ...f, lead_by: e.target.value }))} className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                <option value="">Lead By (Pre-Sales)</option>
                {usersArr.map((u: any) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </div>
            <textarea placeholder="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors">Cancel</button>
              <button onClick={() => createMut.mutate(form)} disabled={createMut.isPending || !form.full_name} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
                {createMut.isPending ? 'Creating...' : 'Create Lead'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
