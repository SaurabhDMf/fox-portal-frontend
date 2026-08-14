import { useQuery } from '@tanstack/react-query';
import { salesApi } from '@/lib/api';

export default function SalesReports() {
  const { data: bySource } = useQuery({
    queryKey: ['sales-report-source'],
    queryFn: () => salesApi.reportBySource().then(r => r.data?.data || []),
  });
  const { data: byRep } = useQuery({
    queryKey: ['sales-report-rep'],
    queryFn: () => salesApi.reportByRep().then(r => r.data?.data || []),
  });

  const sources: any[] = bySource || [];
  const reps: any[] = byRep || [];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Sales Reports</h1>
          <p className="page-subtitle">Marketing source performance and rep pipeline</p>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">By Marketing Source</h2>
        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="p-3">Source</th>
                <th className="p-3">Customers</th>
                <th className="p-3">Tickets</th>
                <th className="p-3">Won</th>
              </tr>
            </thead>
            <tbody>
              {sources.length === 0 ? (
                <tr><td colSpan={4} className="p-8 text-center text-muted-foreground text-sm">No data yet</td></tr>
              ) : sources.map((s, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="p-3">{s.source_email || 'Unknown'}</td>
                  <td className="p-3">{s.customers}</td>
                  <td className="p-3">{s.tickets || 0}</td>
                  <td className="p-3">{s.won || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">By Salesperson</h2>
        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="p-3">Rep</th>
                <th className="p-3">Customers</th>
                <th className="p-3">Tickets</th>
                <th className="p-3">Won</th>
                <th className="p-3">Lost</th>
              </tr>
            </thead>
            <tbody>
              {reps.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground text-sm">No data yet</td></tr>
              ) : reps.map((r: any) => (
                <tr key={r.id} className="border-b border-border/50">
                  <td className="p-3 font-medium">{r.full_name}</td>
                  <td className="p-3">{r.customers}</td>
                  <td className="p-3">{r.tickets}</td>
                  <td className="p-3">{r.won}</td>
                  <td className="p-3">{r.lost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
