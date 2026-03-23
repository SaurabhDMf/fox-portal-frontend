import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

export default function Projects() {
  const [search, setSearch] = useState('');
  const canCreate = useAuthStore(s => s.canCreate);

  const { data = [], isLoading } = useQuery({
    queryKey: ['projects', search],
    queryFn: () => api.get('/projects', { params: { search } }).then(r => r.data?.projects || r.data || []),
  });

  const projects = Array.isArray(data) ? data : [];

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Projects</h1><p className="page-subtitle">Track project progress</p></div>
        {canCreate('projects') && (
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all">
            <Plus className="h-4 w-4" /> New Project
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? [...Array(6)].map((_, i) => <div key={i} className="glass-card h-40 animate-pulse" />) :
        projects.map((p: any) => (
          <div key={p.id} className="glass-card-hover p-5 space-y-3">
            <div className="flex items-start justify-between">
              <h3 className="font-semibold text-sm">{p.name}</h3>
              <span className={p.status === 'Active' ? 'badge-success' : p.status === 'Completed' ? 'badge-info' : 'badge-neutral'}>{p.status}</span>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">{p.description || 'No description'}</p>
            {p.progress != null && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Progress</span><span>{p.progress}%</span></div>
                <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${p.progress}%` }} />
                </div>
              </div>
            )}
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{p.client_name || ''}</span>
              {p.due_date && <span>Due: {new Date(p.due_date).toLocaleDateString()}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
