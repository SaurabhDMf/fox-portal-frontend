import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export default function SAAuditLog() {
  const { data = [], isLoading } = useQuery({
    queryKey: ['sa-audit'],
    queryFn: () => api.get('/sa/audit-log').then(r => r.data?.audit_logs || r.data || []),
  });

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Audit Log</h1><p className="page-subtitle">Platform activity history</p></div>
      </div>
      <div className="glass-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
              <th className="p-4">Action</th><th className="p-4">Actor</th><th className="p-4">Organization</th><th className="p-4">Details</th><th className="p-4">Time</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? [...Array(5)].map((_, i) => <tr key={i}><td colSpan={5} className="p-4"><div className="h-4 bg-secondary rounded animate-pulse" /></td></tr>) :
            (Array.isArray(data) ? data : []).map((log: any, i: number) => (
              <tr key={log.id || i} className="border-b border-border/50 hover:bg-secondary/50 transition-colors">
                <td className="p-4 font-medium">{log.action}</td>
                <td className="p-4 text-muted-foreground">{log.actor_name || log.actor_email}</td>
                <td className="p-4">{log.organization_name || '—'}</td>
                <td className="p-4 text-muted-foreground text-xs max-w-xs truncate">{log.details || '—'}</td>
                <td className="p-4 text-muted-foreground text-xs">{log.created_at ? new Date(log.created_at).toLocaleString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
