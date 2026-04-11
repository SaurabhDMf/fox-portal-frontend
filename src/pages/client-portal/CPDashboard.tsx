import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { DollarSign, FolderKanban, Ticket, Receipt } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function CPDashboard() {
  const user = useAuthStore(s => s.user);
  const navigate = useNavigate();

  const { data: dashData } = useQuery({
    queryKey: ['cp-dashboard'],
    queryFn: () => api.get('/client/dashboard').then(r => r.data?.data || r.data || {}),
  });

  const { data: invoicesRaw } = useQuery({
    queryKey: ['cp-invoices'],
    queryFn: () => api.get('/client/invoices').then(r => r.data?.data || r.data?.invoices || r.data || []),
  });

  const stats = dashData || {};
  const invoices = stats.invoices || {};
  const totalBilled = invoices.total_billed ?? stats.total_invoiced ?? 0;
  const totalPaid = invoices.total_paid ?? 0;
  const amountDue = totalBilled - totalPaid || stats.amount_due || 0;
  const activeProjects = stats.projects?.count ?? stats.active_projects ?? 0;
  const openTickets = stats.open_tickets?.count ?? stats.open_tickets ?? 0;

  const recentInvoices = Array.isArray(invoicesRaw) ? invoicesRaw.slice(0, 3) : [];

  const fmt = (v: number) => {
    const abs = Math.abs(v);
    return abs >= 1000 ? `₹${abs.toLocaleString('en-IN')}` : `₹${abs}`;
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Welcome back, {user?.full_name?.split(' ')[0]}</h1>
          <p className="page-subtitle">Here's an overview of your account</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card-hover p-5 cursor-pointer" onClick={() => navigate('/client-portal/invoices')}>
          <div className="flex items-start justify-between mb-3">
            <div className="p-2.5 rounded-xl bg-primary/15"><Receipt className="h-5 w-5 text-primary" /></div>
          </div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Billed</p>
          <p className="text-2xl font-bold">{fmt(totalBilled)}</p>
        </div>

        <div className="glass-card-hover p-5 cursor-pointer" onClick={() => navigate('/client-portal/invoices')}>
          <div className="flex items-start justify-between mb-3">
            <div className="p-2.5 rounded-xl bg-warning/15"><DollarSign className="h-5 w-5 text-warning" /></div>
          </div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Amount Due</p>
          <p className="text-2xl font-bold">{fmt(amountDue)}</p>
        </div>

        <div className="glass-card-hover p-5 cursor-pointer" onClick={() => navigate('/client-portal/projects')}>
          <div className="flex items-start justify-between mb-3">
            <div className="p-2.5 rounded-xl bg-info/15"><FolderKanban className="h-5 w-5 text-info" /></div>
          </div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Active Projects</p>
          <p className="text-2xl font-bold">{activeProjects}</p>
        </div>

        <div className="glass-card-hover p-5 cursor-pointer" onClick={() => navigate('/client-portal/support')}>
          <div className="flex items-start justify-between mb-3">
            <div className="p-2.5 rounded-xl bg-destructive/15"><Ticket className="h-5 w-5 text-destructive" /></div>
          </div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Open Tickets</p>
          <p className="text-2xl font-bold">{openTickets}</p>
        </div>
      </div>

      {/* Recent Invoices */}
      {recentInvoices.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Recent Invoices</h2>
            <button onClick={() => navigate('/client-portal/invoices')} className="text-xs text-primary hover:underline">View all →</button>
          </div>
          <div className="glass-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="p-3">Invoice #</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentInvoices.map((inv: any) => (
                  <tr key={inv.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer"
                      onClick={() => navigate(`/client-portal/invoices/${inv.id}`)}>
                    <td className="p-3 font-medium">{inv.invoice_number || inv.id?.slice(0, 8)}</td>
                    <td className="p-3 font-semibold">{fmt(Number(inv.total || inv.amount || 0))}</td>
                    <td className="p-3"><StatusBadge status={inv.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'Paid' ? 'bg-success/15 text-success' :
    status === 'Overdue' ? 'bg-destructive/15 text-destructive' :
    status === 'Sent' || status === 'Viewed' ? 'bg-info/15 text-info' :
    status === 'Partially Paid' ? 'bg-warning/15 text-warning' :
    'bg-secondary text-muted-foreground';
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{status}</span>;
}
