import { useQuery } from '@tanstack/react-query';
import { saLocalService } from '@/lib/saLocalService';
import StatCard from '@/components/ui/StatCard';
import { Building2, DollarSign, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

export default function SADashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['sa-stats'],
    queryFn: () => saLocalService.getStats(),
  });

  const s = stats ?? {
    total_organizations: 0,
    mrr: 0,
    active_count: 0,
    trial_count: 0,
    suspended_count: 0,
    plan_breakdown: {},
    recent_organizations: [],
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Super Admin Dashboard</h1>
          <p className="page-subtitle">Platform overview and management</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Total Orgs" value={s.total_organizations ?? '—'} icon={Building2} />
        <StatCard label="MRR" value={s.mrr ? `$${Number(s.mrr).toLocaleString()}` : '—'} icon={DollarSign} iconColor="text-success" />
        <StatCard label="Active" value={s.active_count ?? '—'} icon={CheckCircle} iconColor="text-success" />
        <StatCard label="Trial" value={s.trial_count ?? '—'} icon={Clock} iconColor="text-warning" />
        <StatCard label="Suspended" value={s.suspended_count ?? '—'} icon={AlertTriangle} iconColor="text-destructive" />
      </div>

      {/* Plan Breakdown */}
      {s.plan_breakdown && (
        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold mb-4">Plan Distribution</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(s.plan_breakdown as Record<string, number>).map(([plan, count]) => (
              <div key={plan} className="p-3 rounded-lg bg-secondary text-center">
                <div className="text-lg font-bold">{count}</div>
                <div className="text-xs text-muted-foreground capitalize">{plan}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Orgs */}
      {s.recent_organizations && (
        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold mb-4">Recent Organizations</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground text-xs uppercase tracking-wider border-b border-border">
                  <th className="pb-3 pr-4">Name</th>
                  <th className="pb-3 pr-4">Plan</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {(s.recent_organizations as any[]).map((org: any) => (
                  <tr key={org.id} className="border-b border-border/50 last:border-0">
                    <td className="py-3 pr-4 font-medium">{org.name}</td>
                    <td className="py-3 pr-4"><span className="badge-primary">{org.plan}</span></td>
                    <td className="py-3 pr-4"><span className={org.status === 'active' ? 'badge-success' : 'badge-warning'}>{org.status}</span></td>
                    <td className="py-3 text-muted-foreground">{new Date(org.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="stat-card animate-pulse h-28" />
          ))}
        </div>
      )}
    </div>
  );
}
