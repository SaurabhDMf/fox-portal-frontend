import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useState } from 'react';
import { ChevronDown, ChevronRight, Users } from 'lucide-react';

export default function CPProjects() {
  const { data = [] } = useQuery({
    queryKey: ['cp-projects'],
    queryFn: () => api.get('/client/projects').then(r => r.data?.data || r.data?.projects || r.data || []),
  });
  const projects = Array.isArray(data) ? data : [];
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="page-container">
      <div className="page-header"><div><h1 className="page-title">Projects</h1><p className="page-subtitle">Track progress on your active projects</p></div></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projects.map((p: any) => {
          const done = p.done_tasks ?? 0;
          const total = p.total_tasks ?? 0;
          const pct = total > 0 ? Math.round((done / total) * 100) : 0;
          const isOpen = expanded === p.id;
          const members = p.members || [];
          const sprints = p.sprints || [];

          return (
            <div key={p.id} className="glass-card p-5 space-y-3">
              <div className="flex items-start justify-between">
                <h3 className="font-semibold text-sm">{p.name}</h3>
                <span className={p.status === 'Active' ? 'badge-success' : p.status === 'Completed' ? 'badge-neutral' : 'badge-warning'}>{p.status}</span>
              </div>
              {p.description && <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>}

              {/* Progress */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Progress</span>
                  <span>{done}/{total} tasks ({pct}%)</span>
                </div>
                <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>

              {/* Team */}
              {members.length > 0 && (
                <div className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5 text-muted-foreground mr-1" />
                  <div className="flex -space-x-1.5">
                    {members.slice(0, 5).map((m: any, i: number) => (
                      <div key={i} className="w-6 h-6 rounded-full bg-primary/20 border-2 border-card flex items-center justify-center text-[9px] font-bold text-primary" title={m.full_name || m.name}>
                        {(m.full_name || m.name || '?')[0]}
                      </div>
                    ))}
                    {members.length > 5 && <span className="text-xs text-muted-foreground ml-1">+{members.length - 5}</span>}
                  </div>
                  <span className="text-xs text-muted-foreground ml-1">{sprints.length || p.sprints_count || 0} sprints</span>
                </div>
              )}

              {/* Expand sprints */}
              {(sprints.length > 0 || p.sprints_count > 0) && (
                <button onClick={() => setExpanded(isOpen ? null : p.id)} className="flex items-center gap-1 text-xs text-primary hover:underline mt-1">
                  {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  {isOpen ? 'Hide sprints' : 'View sprints'}
                </button>
              )}
              {isOpen && sprints.length > 0 && (
                <div className="space-y-1.5 pt-1 border-t border-border/50">
                  {sprints.map((s: any) => (
                    <div key={s.id} className="flex items-center justify-between text-xs p-2 rounded-md bg-secondary/50">
                      <span className="font-medium">{s.name}</span>
                      <span className={s.status === 'Active' ? 'text-success' : 'text-muted-foreground'}>{s.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {projects.length === 0 && <div className="col-span-full text-center py-12 text-muted-foreground text-sm">No projects found</div>}
      </div>
    </div>
  );
}
