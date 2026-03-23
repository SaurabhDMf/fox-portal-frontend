import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { Plus, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';

const roles = ['admin', 'sales_manager', 'sales_rep', 'resource', 'freelancer'];

export default function AdminUsers() {
  const [search, setSearch] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [form, setForm] = useState({ full_name: '', email: '', role: 'sales_rep', employment_type: 'Full-time', department: '', job_title: '' });
  const canCreate = useAuthStore(s => s.canCreate);
  const qc = useQueryClient();

  const { data = [], isLoading } = useQuery({
    queryKey: ['users', search],
    queryFn: () => api.get('/users', { params: { search } }).then(r => r.data?.users || r.data || []),
  });

  const inviteMut = useMutation({
    mutationFn: (d: typeof form) => api.post('/users/invite', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setShowInvite(false); toast.success('User invited'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Error'),
  });

  const users = Array.isArray(data) ? data : [];

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Team & Users</h1><p className="page-subtitle">Manage your team</p></div>
        {canCreate('users') && (
          <button onClick={() => setShowInvite(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all">
            <Plus className="h-4 w-4" /> Invite User
          </button>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..." className="w-full pl-10 pr-4 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
      </div>

      <div className="glass-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
              <th className="p-4">User</th><th className="p-4">Role</th><th className="p-4">Dept</th><th className="p-4">Type</th><th className="p-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u: any) => (
              <tr key={u.id} className="border-b border-border/50 hover:bg-secondary/50 transition-colors">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary">{u.full_name?.[0]}</div>
                    <div><div className="font-medium">{u.full_name}</div><div className="text-xs text-muted-foreground">{u.email}</div></div>
                  </div>
                </td>
                <td className="p-4"><span className="badge-primary">{u.role}</span></td>
                <td className="p-4 text-muted-foreground">{u.department || '—'}</td>
                <td className="p-4 text-muted-foreground">{u.employment_type || '—'}</td>
                <td className="p-4"><span className={u.status === 'active' ? 'badge-success' : 'badge-warning'}>{u.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-lg p-6 space-y-4 animate-slide-up">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Invite User</h2>
              <button onClick={() => setShowInvite(false)} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input placeholder="Full Name *" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              <input placeholder="Email *" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                {roles.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
              </select>
              <input placeholder="Department" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              <input placeholder="Job Title" value={form.job_title} onChange={e => setForm(f => ({ ...f, job_title: e.target.value }))} className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowInvite(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">Cancel</button>
              <button onClick={() => inviteMut.mutate(form)} disabled={inviteMut.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
                {inviteMut.isPending ? 'Inviting...' : 'Send Invite'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
