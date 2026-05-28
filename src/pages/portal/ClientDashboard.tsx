import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import StatCard from '@/components/ui/StatCard';
import { useAuthStore } from '@/stores/authStore';
import { DollarSign, FolderKanban, Ticket } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ClientDashboard() {
  const user = useAuthStore(s => s.user);
  const navigate = useNavigate();

  const { data: invoices = [] } = useQuery({
    queryKey: ['my-invoices'],
    queryFn: () => api.get('/invoices').then(r => r.data?.invoices || r.data || []),
  });
  const { data: projects = [] } = useQuery({
    queryKey: ['my-projects'],
    queryFn: () => api.get('/projects').then(r => r.data?.projects || r.data || []),
  });
  const { data: tickets = [] } = useQuery({
    queryKey: ['my-tickets'],
    queryFn: () => api.get('/tickets').then(r => r.data?.tickets || r.data || []),
  });

  const invArr = Array.isArray(invoices) ? invoices : [];
  const outstanding = invArr.filter((i: any) => i.status !== 'Paid').reduce((s: number, i: any) => s + Number(i.total || 0), 0);
  const projArr = Array.isArray(projects) ? projects : [];
  const tickArr = Array.isArray(tickets) ? tickets : [];
  const openTickets = tickArr.filter((t: any) => t.status !== 'Closed' && t.status !== 'Resolved').length;

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Client Portal</h1><p className="page-subtitle">Welcome, {user?.full_name}</p></div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card-hover p-5 cursor-pointer" onClick={() => navigate('/portal/invoices')}>
          <div className="flex items-start justify-between mb-3">
            <div className="p-2.5 rounded-xl bg-warning/15"><DollarSign className="h-5 w-5 text-warning" /></div>
          </div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Outstanding</p>
          <p className="text-2xl font-bold">${outstanding.toLocaleString()}</p>
          <button className="mt-3 text-xs text-primary hover:underline">Pay Now →</button>
        </div>
        <StatCard label="Active Projects" value={projArr.length} icon={FolderKanban} iconColor="text-info" />
        <StatCard label="Open Tickets" value={openTickets} icon={Ticket} iconColor="text-destructive" />
      </div>
    </div>
  );
}
