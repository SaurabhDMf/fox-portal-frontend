import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';

const types = ['All', 'VIP', 'Active', 'New', 'At-Risk'];
const industries = ['Technology', 'Healthcare', 'Finance', 'Education', 'Retail', 'Manufacturing', 'Services', 'Other'];

export default function Clients() {
  const [type, setType] = useState('All');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ company_name: '', industry: '', client_type: 'Active', website: '', account_manager_id: '' });
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data = [], isLoading } = useQuery({
    queryKey: ['clients', type, search],
    queryFn: () => api.get('/clients', { params: { type: type === 'All' ? undefined : type, search } }).then(r => r.data?.clients || r.data || []),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => api.get('/users').then(r => r.data?.users || r.data || []),
  });

  const createMut = useMutation({
    mutationFn: (d: typeof form) => api.post('/clients', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); setShowCreate(false); toast.success('Client created'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Error'),
  });

  const clients = Array.isArray(data) ? data : [];
  const usersArr = Array.isArray(users) ? users : [];

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Clients</h1><p className="page-subtitle">Manage your client base</p></div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all">
          <Plus className="h-4 w-4" /> Add Client
        </button>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients..." className="w-full pl-10 pr-4 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
        <div className="flex gap-1.5">
          {types.map(t => (
            <button key={t} onClick={() => setType(t)} className={`text-xs px-3 py-1.5 rounded-full transition-colors ${type === t ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>{t}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? [...Array(6)].map((_, i) => <div key={i} className="glass-card h-40 animate-pulse" />) :
        clients.map((client: any) => (
          <div key={client.id} onClick={() => navigate(`/admin/clients/${client.id}`)} className="glass-card-hover p-5 space-y-3 cursor-pointer">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                {client.company_name?.[0] || 'C'}
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-sm truncate">{client.company_name}</h3>
                <p className="text-xs text-muted-foreground">{client.industry || 'No industry'}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {client.client_type && <span className={client.client_type === 'VIP' ? 'badge-warning' : client.client_type === 'At-Risk' ? 'badge-danger' : 'badge-info'}>{client.client_type}</span>}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Manager: {client.account_manager_name || '—'}</span>
              {client.total_spend != null && <span className="font-medium text-foreground">${Number(client.total_spend).toLocaleString()}</span>}
            </div>
          </div>
        ))}
        {clients.length === 0 && !isLoading && (
          <div className="col-span-full text-center py-16">
            <div className="text-muted-foreground text-sm mb-3">No clients found</div>
            <button onClick={() => setShowCreate(true)} className="text-sm text-primary hover:underline">Add your first client →</button>
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-lg p-6 space-y-4 animate-slide-up">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Add Client</h2>
              <button onClick={() => setShowCreate(false)} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
            </div>
            <input placeholder="Company Name *" value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            <div className="grid grid-cols-2 gap-3">
              <select value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))} className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                <option value="">Select Industry</option>
                {industries.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
              <select value={form.client_type} onChange={e => setForm(f => ({ ...f, client_type: e.target.value }))} className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                {['Active', 'VIP', 'New', 'At-Risk'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <input placeholder="Website URL" value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            <select value={form.account_manager_id} onChange={e => setForm(f => ({ ...f, account_manager_id: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
              <option value="">Select Account Manager</option>
              {usersArr.map((u: any) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">Cancel</button>
              <button onClick={() => createMut.mutate(form)} disabled={createMut.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
                {createMut.isPending ? 'Creating...' : 'Add Client'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
