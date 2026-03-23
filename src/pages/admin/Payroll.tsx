import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export default function Payroll() {
  const { data = [], isLoading } = useQuery({
    queryKey: ['payroll-runs'],
    queryFn: () => api.get('/payroll/runs').then(r => r.data?.runs || r.data || []),
  });

  const runs = Array.isArray(data) ? data : [];

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Payroll</h1><p className="page-subtitle">Manage payroll runs</p></div>
      </div>

      <div className="space-y-3">
        {isLoading ? [...Array(3)].map((_, i) => <div key={i} className="glass-card h-20 animate-pulse" />) :
        runs.map((run: any) => (
          <div key={run.id} className="glass-card-hover p-5 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm">{run.period_label}</h3>
              <p className="text-xs text-muted-foreground">{run.period_start && new Date(run.period_start).toLocaleDateString()} — {run.period_end && new Date(run.period_end).toLocaleDateString()}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">{run.total_net ? `$${Number(run.total_net).toLocaleString()}` : ''}</span>
              <span className={run.status === 'Paid' ? 'badge-success' : run.status === 'Approved' ? 'badge-info' : run.status === 'Pending' ? 'badge-warning' : 'badge-neutral'}>{run.status}</span>
            </div>
          </div>
        ))}
        {runs.length === 0 && !isLoading && <div className="text-center py-12 text-muted-foreground text-sm">No payroll runs</div>}
      </div>
    </div>
  );
}
