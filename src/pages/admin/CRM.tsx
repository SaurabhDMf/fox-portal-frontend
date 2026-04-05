import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Plus, Search, List, LayoutGrid, X, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

const statuses = ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation', 'Closed Won', 'Closed Lost'];
const defaultPurposes = ['Web Development', 'Mobile App', 'UI/UX Design', 'SEO', 'Digital Marketing', 'Consulting', 'Other'];

const countries = [
  'India', 'United States', 'United Kingdom', 'Canada', 'Australia',
  'Germany', 'France', 'UAE', 'Singapore', 'Other',
];

function isStale(lead: any): boolean {
  if (!lead.created_at) return false;
  if (lead.status !== 'New') return false;
  const created = new Date(lead.created_at);
  const today = new Date();
  return created.toDateString() !== today.toDateString();
}

export default function CRM() {
  const navigate = useNavigate();
  const [view, setView] = useState<'list' | 'kanban'>('list');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const qc = useQueryClient();

  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', country: '', purpose: '',
    status: 'New', assigned_to: '', notes: '',
  });

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads', search, statusFilter, countryFilter, dateFrom, dateTo],
    queryFn: () => api.get('/leads', {
      params: {
        search: search || undefined,
        status: statusFilter || undefined,
        country: countryFilter || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      },
    }).then(r => r.data?.leads || r.data || []),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => api.get('/users').then(r => r.data?.users || r.data || []),
  });

  const createMut = useMutation({
    mutationFn: (d: typeof form) => api.post('/leads', d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      setShowCreate(false);
      setForm({ full_name: '', email: '', phone: '', country: '', purpose: '', status: 'New', assigned_to: '', notes: '' });
      toast.success('Lead created');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Error'),
  });

  const leadsArr = Array.isArray(leads) ? leads : [];
  const usersArr = Array.isArray(users) ? users : [];

  const inputCls = "px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50";

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Sales CRM</h1><p className="page-subtitle">Manage your sales pipeline</p></div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg overflow-hidden border border-border">
            <button onClick={() => setView('list')} className={`p-2 ${view === 'list' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-secondary'} transition-colors`}><List className="h-4 w-4" /></button>
            <button onClick={() => setView('kanban')} className={`p-2 ${view === 'kanban' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-secondary'} transition-colors`}><LayoutGrid className="h-4 w-4" /></button>
          </div>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all">
            <Plus className="h-4 w-4" /> New Lead
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search leads..." className="w-full pl-10 pr-4 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
        <select value={countryFilter} onChange={e => setCountryFilter(e.target.value)} className={inputCls}>
          <option value="">All Countries</option>
          {countries.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="flex items-center gap-1.5">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={`${inputCls} w-36`} placeholder="From" />
          <span className="text-muted-foreground text-xs">to</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={`${inputCls} w-36`} placeholder="To" />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => setStatusFilter('')} className={`text-xs px-3 py-1.5 rounded-full transition-colors ${!statusFilter ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>All</button>
        {statuses.map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} className={`text-xs px-3 py-1.5 rounded-full transition-colors ${statusFilter === s ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>{s}</button>
        ))}
      </div>

      {/* List View */}
      {view === 'list' && (
        <div className="glass-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="p-4">Created</th>
                <th className="p-4">Name</th>
                <th className="p-4">Email</th>
                <th className="p-4">Phone</th>
                <th className="p-4">Country</th>
                <th className="p-4">Purpose</th>
                <th className="p-4">Status</th>
                <th className="p-4">Added By</th>
                <th className="p-4">Assigned To</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? [...Array(5)].map((_, i) => <tr key={i}><td colSpan={9} className="p-4"><div className="h-4 bg-secondary rounded animate-pulse" /></td></tr>) :
              leadsArr.map((lead: any) => {
                const stale = isStale(lead);
                return (
                  <tr key={lead.id} onClick={() => navigate(`/admin/crm/${lead.id}`)}
                    className={`border-b border-border/50 hover:bg-secondary/50 transition-colors cursor-pointer ${stale ? 'bg-destructive/5' : ''}`}>
                    <td className={`p-4 text-muted-foreground ${stale ? 'text-destructive font-medium' : ''}`}>
                      {lead.created_at ? new Date(lead.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className={`p-4 font-medium ${stale ? 'text-destructive' : ''}`}>{lead.full_name}</td>
                    <td className="p-4 text-muted-foreground">{lead.email || '—'}</td>
                    <td className="p-4 text-muted-foreground">{lead.phone || '—'}</td>
                    <td className="p-4 text-muted-foreground">{lead.country || '—'}</td>
                    <td className="p-4 text-muted-foreground">{lead.purpose || '—'}</td>
                    <td className="p-4">
                      <span className={lead.status === 'Closed Won' ? 'badge-success' : lead.status === 'Closed Lost' ? 'badge-danger' : 'badge-info'}>{lead.status}</span>
                    </td>
                    <td className="p-4 text-muted-foreground">{lead.lead_by_name || lead.added_by_name || '—'}</td>
                    <td className="p-4 text-muted-foreground">{lead.assigned_to_name || '—'}</td>
                  </tr>
                );
              })}
              {leadsArr.length === 0 && !isLoading && (
                <tr><td colSpan={9} className="p-8 text-center text-muted-foreground text-sm">No leads found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

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
                  {col.map((lead: any) => {
                    const stale = isStale(lead);
                    return (
                      <div key={lead.id} onClick={() => navigate(`/admin/crm/${lead.id}`)}
                        className={`glass-card-hover p-3 space-y-2 cursor-pointer ${stale ? 'border-destructive/50 bg-destructive/5' : ''}`}>
                        <div className="flex items-start justify-between">
                          <div className={`font-medium text-sm ${stale ? 'text-destructive' : ''}`}>{lead.full_name}</div>
                          <span className={lead.status === 'Closed Won' ? 'badge-success' : lead.status === 'Closed Lost' ? 'badge-danger' : 'badge-info'}>{lead.status}</span>
                        </div>
                        {lead.purpose && <div className="text-xs text-muted-foreground">{lead.purpose}</div>}
                        {lead.country && <div className="text-xs text-muted-foreground">{lead.country}</div>}
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          {lead.assigned_to_name && <span>→ {lead.assigned_to_name}</span>}
                          {lead.created_at && <span>{new Date(lead.created_at).toLocaleDateString()}</span>}
                        </div>
                      </div>
                    );
                  })}
                  {col.length === 0 && <div className="text-xs text-muted-foreground text-center py-8 border border-dashed border-border rounded-lg">No leads</div>}
                </div>
              </div>
            );
          })}
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
              <input placeholder="Full Name *" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} className={inputCls} />
              <input placeholder="Email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputCls} />
              <input placeholder="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inputCls} />
              <select value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} className={inputCls}>
                <option value="">Select Country</option>
                {countries.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} className={inputCls}>
                <option value="">Select Purpose</option>
                {defaultPurposes.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inputCls}>
                {statuses.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} className={inputCls}>
                <option value="">Assign To</option>
                {usersArr.map((u: any) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </div>
            <textarea placeholder="Notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} className={`w-full ${inputCls} resize-none`} />
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
