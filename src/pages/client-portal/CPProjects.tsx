import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useNavigate } from 'react-router-dom';
import { Calendar, Users } from 'lucide-react';

export default function CPProjects() {
  const navigate = useNavigate();

  const { data = [] } = useQuery({
    queryKey: ['cp-projects'],
    queryFn: () => api.get('/client/projects').then(r => r.data?.data || r.data?.projects || r.data || []),
  });
  const projects = Array.isArray(data) ? data : [];

  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  return (
    <div className="page-container">
      <div className="page-header"><div><h1 className="page-title">Projects</h1><p className="page-subtitle">Track progress on your active projects</p></div></div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projects.map((p: any) => {
          const done = p.done_tasks ?? 0;
          const total = p.total_tasks ?? 0;
          const pct = total > 0 ? Math.round((done / total) * 100) : 0;

          return (
            <div key={p.id} className="glass-card-hover p-5 space-y-3 cursor-pointer" onClick={() => navigate(`/client-portal/projects/${p.id}`)}>
              <div className="flex items-start justify-between">
                <h3 className="font-semibold text-sm">{p.name}</h3>
                <StatusBadge status={p.status} />
              </div>

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

              {/* Lead + Due date */}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  {p.lead_avatar ? (
                    <img src={p.lead_avatar} className="w-5 h-5 rounded-full" alt="" />
                  ) : p.lead_name ? (
                    <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-bold text-primary">{p.lead_name[0]}</div>
                  ) : null}
                  {p.lead_name && <span>{p.lead_name}</span>}
                </div>
                {p.due_date && (
                  <div className="flex items-center gap-1"><Calendar className="h-3 w-3" />{fmtDate(p.due_date)}</div>
                )}
              </div>

              {/* Sprints count */}
              {(p.active_sprints != null || p.sprints_count != null) && (
                <div className="text-xs text-muted-foreground">{p.active_sprints ?? p.sprints_count ?? 0} active sprints</div>
              )}
            </div>
          );
        })}
        {projects.length === 0 && <div className="col-span-full text-center py-12 text-muted-foreground text-sm">No projects found</div>}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'Active' ? 'bg-success/15 text-success' :
    status === 'Completed' ? 'bg-secondary text-muted-foreground' :
    'bg-warning/15 text-warning';
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{status}</span>;
}
