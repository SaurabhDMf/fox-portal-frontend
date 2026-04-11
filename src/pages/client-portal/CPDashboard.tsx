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

  const stats = dashData || {};
  const totalInvoiced = stats.total_invoiced ?? 0;
  const amountDue = stats.amount_due ?? 0;
  const activeProjects = stats.active_projects ?? 0;
  const openTickets = stats.open_tickets ?? 0;

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
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Invoiced</p>
          <p className="text-2xl font-bold">${Number(totalInvoiced).toLocaleString()}</p>
        </div>

        <div className="glass-card-hover p-5 cursor-pointer" onClick={() => navigate('/client-portal/invoices')}>
          <div className="flex items-start justify-between mb-3">
            <div className="p-2.5 rounded-xl bg-warning/15"><DollarSign className="h-5 w-5 text-warning" /></div>
          </div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Amount Due</p>
          <p className="text-2xl font-bold">${Number(amountDue).toLocaleString()}</p>
          {amountDue > 0 && <button className="mt-3 text-xs text-primary hover:underline">Pay Now →</button>}
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
    </div>
  );
}
