import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export default function ClientProjects() {
  const { data = [] } = useQuery({
    queryKey: ['my-projects'],
    queryFn: () => api.get('/projects').then(r => r.data?.projects || r.data || []),
  });
  const projects = Array.isArray(data) ? data : [];

  return (
    <div className="page-container">
      <div className="page-header"><div><h1 className="page-title">My Projects</h1></div></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projects.map((p: any) => (
          <div key={p.id} className="glass-card p-5 space-y-3">
            <div className="flex items-start justify-between">
              <h3 className="font-semibold text-sm">{p.name}</h3>
              <span className={p.status === 'Active' ? 'badge-success' : 'badge-neutral'}>{p.status}</span>
            </div>
            <p className="text-xs text-muted-foreground">{p.description || 'No description'}</p>
            {p.progress != null && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Progress</span><span>{p.progress}%</span></div>
                <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${p.progress}%` }} />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
