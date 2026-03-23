import { useQuery } from '@tanstack/react-query';
import { saLocalService } from '@/lib/saLocalService';
import { Search } from 'lucide-react';
import { useState } from 'react';

export default function SAUsers() {
  const [search, setSearch] = useState('');
  const { data = [], isLoading } = useQuery({
    queryKey: ['sa-users', search],
    queryFn: () => saLocalService.getUsers(search),
  });

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">All Users</h1>
          <p className="page-subtitle">Users across all organizations</p>
        </div>
      </div>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..." className="w-full pl-10 pr-4 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
      </div>
      <div className="glass-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
              <th className="p-4">Name</th><th className="p-4">Email</th><th className="p-4">Organization</th><th className="p-4">Role</th><th className="p-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [...Array(5)].map((_, i) => <tr key={i}><td colSpan={5} className="p-4"><div className="h-4 bg-secondary rounded animate-pulse" /></td></tr>)
            ) : (Array.isArray(data) ? data : []).map((u: any) => (
              <tr key={u.id} className="border-b border-border/50 hover:bg-secondary/50 transition-colors">
                <td className="p-4 font-medium">{u.full_name}</td>
                <td className="p-4 text-muted-foreground">{u.email}</td>
                <td className="p-4">{u.organization_name || '—'}</td>
                <td className="p-4"><span className="badge-primary">{u.role}</span></td>
                <td className="p-4"><span className={u.status === 'active' ? 'badge-success' : 'badge-warning'}>{u.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
