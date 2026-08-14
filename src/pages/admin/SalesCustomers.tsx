import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { salesApi } from '@/lib/api';
import { Users } from 'lucide-react';

export default function SalesCustomers() {
  const navigate = useNavigate();
  const basePath = window.location.pathname.startsWith('/sales') ? '/sales' : '/admin';

  const { data, isLoading } = useQuery({
    queryKey: ['sales-customers'],
    queryFn: () => salesApi.getCustomers().then(r => r.data?.data || []),
  });

  const customers: any[] = data || [];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">One customer, one permanent owner — every future requirement follows them</p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-sm text-muted-foreground">Loading…</div>
      ) : customers.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">No customers yet</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="p-3">Customer</th>
                <th className="p-3">Company</th>
                <th className="p-3">Owner</th>
                <th className="p-3">Source</th>
                <th className="p-3">Tickets</th>
              </tr>
            </thead>
            <tbody>
              {customers.map(c => (
                <tr key={c.id} onClick={() => navigate(`${basePath}/sales-customers/${c.id}`)} className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer">
                  <td className="p-3">
                    <div className="font-medium">{c.name || c.email}</div>
                    <div className="text-xs text-muted-foreground">{c.email}</div>
                  </td>
                  <td className="p-3 text-muted-foreground">{c.company || '—'}</td>
                  <td className="p-3">{c.owner_name || '—'}</td>
                  <td className="p-3 text-xs text-muted-foreground">{c.source_email || '—'}</td>
                  <td className="p-3">{c.ticket_count ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
