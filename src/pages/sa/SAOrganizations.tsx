import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useState } from 'react';
import { Building2, Plus, Search, Users, FileText, X } from 'lucide-react';
import toast from 'react-hot-toast';

const plans = [
  { value: 'trial', label: 'Trial (Free)' },
  { value: 'starter', label: 'Starter ($29/mo)' },
  { value: 'pro', label: 'Pro ($79/mo)' },
  { value: 'enterprise', label: 'Enterprise ($199/mo)' },
];

const industries = ['Technology', 'Healthcare', 'Finance', 'Education', 'Retail', 'Manufacturing', 'Services', 'Other'];
const sizes = ['1-10', '11-50', '51-200', '201-500', '500+'];

export default function SAOrganizations() {
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', owner_email: '', owner_name: '', plan: 'trial', industry: '', size: '' });
  const qc = useQueryClient();

  const { data: orgs = [], isLoading } = useQuery({
    queryKey: ['sa-orgs', search],
    queryFn: () => api.get('/sa/organizations', { params: { search } }).then(r => r.data?.organizations || r.data || []),
  });

  const createMut = useMutation({
    mutationFn: (d: typeof form) => api.post('/sa/organizations', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sa-orgs'] }); setShowCreate(false); toast.success('Organization created'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Error'),
  });

  const actionMut = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) => api.post(`/sa/organizations/${id}/${action}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sa-orgs'] }); toast.success('Done'); },
  });

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Organizations</h1>
          <p className="page-subtitle">Manage all platform organizations</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all">
          <Plus className="h-4 w-4" /> New Organization
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search organizations..." className="w-full pl-10 pr-4 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="glass-card h-48 animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(Array.isArray(orgs) ? orgs : []).map((org: any) => (
            <div key={org.id} className="glass-card-hover p-5 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                  {org.name?.[0]}
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-sm truncate">{org.name}</h3>
                  <p className="text-xs text-muted-foreground truncate">{org.owner_email}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="badge-primary">{org.plan}</span>
                <span className={org.status === 'active' ? 'badge-success' : org.status === 'suspended' ? 'badge-danger' : 'badge-warning'}>{org.status}</span>
              </div>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {org.user_count ?? 0}</span>
                <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> {org.invoice_count ?? 0}</span>
              </div>
              <div className="flex gap-2 pt-1">
                {org.status === 'active' && (
                  <button onClick={() => actionMut.mutate({ id: org.id, action: 'suspend' })} className="text-xs px-3 py-1.5 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">Suspend</button>
                )}
                {org.status === 'suspended' && (
                  <button onClick={() => actionMut.mutate({ id: org.id, action: 'activate' })} className="text-xs px-3 py-1.5 rounded-md bg-success/10 text-success hover:bg-success/20 transition-colors">Activate</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-lg p-6 space-y-4 animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Create Organization</h2>
              <button onClick={() => setShowCreate(false)} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <input placeholder="Company Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              <input placeholder="Owner Email *" value={form.owner_email} onChange={e => setForm(f => ({ ...f, owner_email: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              <input placeholder="Owner Name" value={form.owner_name} onChange={e => setForm(f => ({ ...f, owner_name: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              <select value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                {plans.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              <select value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                <option value="">Select Industry</option>
                {industries.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
              <select value={form.size} onChange={e => setForm(f => ({ ...f, size: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                <option value="">Company Size</option>
                {sizes.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <p className="text-xs text-muted-foreground bg-info/10 p-2 rounded-md">Admin account will be created with password: Welcome123!</p>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors">Cancel</button>
              <button onClick={() => createMut.mutate(form)} disabled={createMut.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
                {createMut.isPending ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
