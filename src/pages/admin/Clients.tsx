import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Plus, Search } from 'lucide-react';

const types = ['All', 'VIP', 'Active', 'New', 'At-Risk'];

export default function Clients() {
  const [type, setType] = useState('All');
  const [search, setSearch] = useState('');
  const canCreate = useAuthStore(s => s.canCreate);
  const navigate = useNavigate();

  const { data = [], isLoading } = useQuery({
    queryKey: ['clients', type, search],
    queryFn: () => api.get('/clients', { params: { type: type === 'All' ? undefined : type, search } }).then(r => r.data?.clients || r.data || []),
  });

  const clients = Array.isArray(data) ? data : [];

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Clients</h1><p className="page-subtitle">Manage your client base</p></div>
        {canCreate('clients') && (
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all">
            <Plus className="h-4 w-4" /> Add Client
          </button>
        )}
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
      </div>
    </div>
  );
}
