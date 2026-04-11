import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { ArrowLeft, Calendar, Users } from 'lucide-react';

export default function CPProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['cp-project', id],
    queryFn: () => api.get(`/client/projects/${id}`).then(r => r.data?.data || r.data || {}),
    enabled: !!id,
  });

  const project = data || {};
  const sprints = project.sprints || [];
  const members = project.members || project.team || [];
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  if (isLoading) return <div className="page-container"><div className="text-center py-20 text-muted-foreground">Loading...</div></div>;

  return (
    <div className="page-container">
      <button onClick={() => navigate('/client-portal/projects')} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to Projects
      </button>

      {/* Header */}
      <div className="glass-card p-6 mb-6">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">{project.name}</h1>
            {project.description && <p className="text-sm text-muted-foreground mt-1">{project.description}</p>}
          </div>
          <StatusBadge status={project.status} />
        </div>
        <div className="flex flex-wrap gap-4 mt-4 text-sm text-muted-foreground">
          {project.start_date && <div className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Start: {fmtDate(project.start_date)}</div>}
          {project.due_date && <div className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Due: {fmtDate(project.due_date)}</div>}
          {project.lead_name && (
            <div className="flex items-center gap-1">
              <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-bold text-primary">{project.lead_name[0]}</div>
              Lead: {project.lead_name}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sprints */}
        <div className="lg:col-span-2">
          <h2 className="text-sm font-semibold mb-3">Sprints</h2>
          {sprints.length > 0 ? (
            <div className="space-y-2">
              {sprints.map((s: any) => (
                <div key={s.id} className="glass-card p-4 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {fmtDate(s.start_date)} — {fmtDate(s.end_date)}
                      {s.total_tasks != null && <span className="ml-2">• {s.done_tasks || 0}/{s.total_tasks} tasks</span>}
                    </div>
                  </div>
                  <SprintBadge status={s.status} />
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-card p-8 text-center text-muted-foreground text-sm">No sprints available</div>
          )}
        </div>

        {/* Team */}
        <div>
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-1"><Users className="h-4 w-4" /> Team Members</h2>
          {members.length > 0 ? (
            <div className="glass-card p-4 space-y-3">
              {members.map((m: any, i: number) => (
                <div key={i} className="flex items-center gap-3">
                  {m.avatar_url ? (
                    <img src={m.avatar_url} className="w-8 h-8 rounded-full" alt="" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                      {(m.full_name || m.name || '?')[0]}
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-medium">{m.full_name || m.name}</div>
                    {m.role && <div className="text-xs text-muted-foreground">{m.role}</div>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-card p-8 text-center text-muted-foreground text-sm">No team members</div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls = status === 'Active' ? 'bg-success/15 text-success' : status === 'Completed' ? 'bg-secondary text-muted-foreground' : 'bg-warning/15 text-warning';
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{status}</span>;
}

function SprintBadge({ status }: { status: string }) {
  const cls = status === 'Active' ? 'bg-success/15 text-success' : status === 'Completed' ? 'bg-secondary text-muted-foreground' : 'bg-info/15 text-info';
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{status}</span>;
}
