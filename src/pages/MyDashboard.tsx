import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import StatCard from '@/components/ui/StatCard';
import { useAuthStore } from '@/stores/authStore';
import { useNavigate } from 'react-router-dom';
import { ListChecks, FolderKanban, Target, FileText, Clock, ArrowUpRight, ArrowDownRight, CheckCircle2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

export default function MyDashboard() {
  const user = useAuthStore(s => s.user);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const basePath = window.location.pathname.startsWith('/admin') ? '/admin' : window.location.pathname.startsWith('/portal') ? '/portal' : '/emp';

  const { data, isLoading } = useQuery({
    queryKey: ['my-dashboard'],
    queryFn: () => api.get('/dashboard').then(r => r.data),
  });

  const { data: trackerSummary } = useQuery({
    queryKey: ['tracker-summary'],
    queryFn: () => api.get('/tracker/tracker-summary').then(r => r.data),
  });

  const { data: today } = useQuery({
    queryKey: ['today-attendance'],
    queryFn: () => api.get('/tracker/attendance/today').then(r => r.data?.data || r.data || {}),
    refetchInterval: 60_000,
  });

  const invalidateTracker = () => {
    qc.invalidateQueries({ queryKey: ['today-attendance'] });
    qc.invalidateQueries({ queryKey: ['tracker-summary'] });
  };

  const checkInMut = useMutation({
    mutationFn: () => api.post('/tracker/attendance/check-in'),
    onSuccess: () => { invalidateTracker(); toast.success('Checked in! Timer started.'); },
    onError: (e: any) => toast.error(e?.response?.data?.error || e?.response?.data?.message || 'Check-in failed'),
  });
  const checkOutMut = useMutation({
    mutationFn: () => api.post('/tracker/attendance/check-out'),
    onSuccess: () => { invalidateTracker(); toast.success('Checked out. Have a great day!'); },
    onError: (e: any) => toast.error(e?.response?.data?.error || e?.response?.data?.message || 'Check-out failed'),
  });

  // Live tick — updates running timer every second while checked in
  const [now, setNow] = useState(Date.now());
  const isActive = !!today?.check_in_time && !today?.check_out_time;
  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isActive]);

  const formatElapsed = () => {
    if (today?.check_in_time && today?.check_out_time) {
      const hrs = Number(today.hours_worked || 0);
      return `${Math.floor(hrs)}h ${Math.round((hrs % 1) * 60)}m`;
    }
    if (today?.check_in_time) {
      const ms = now - new Date(today.check_in_time).getTime();
      const totalSec = Math.max(0, Math.floor(ms / 1000));
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
    }
    return trackerSummary?.today_hours || '0h 0m';
  };

  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const stats = data?.stats || {};
  const myTasks: any[] = Array.isArray(data?.my_tasks) ? data.my_tasks : [];
  const myProjects: any[] = Array.isArray(data?.my_projects) ? data.my_projects : [];
  const myLeads: any[] = Array.isArray(data?.my_leads) ? data.my_leads : [];
  const myInvoices: any[] = Array.isArray(data?.my_invoices) ? data.my_invoices : [];
  

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Dashboard</h1>
          <p className="page-subtitle">Welcome back, {user?.full_name}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="My Tasks" value={stats.tasks ?? myTasks.length} icon={ListChecks} />
        <StatCard label="My Projects" value={myProjects.length} icon={FolderKanban} iconColor="text-info" />
        <StatCard label="Open Leads" value={stats.leads ?? myLeads.length} icon={Target} iconColor="text-warning" />
        <StatCard label="Invoices" value={myInvoices.length} icon={FileText} iconColor="text-success" />
      </div>

      {/* Time Tracker */}
      <div className={`glass-card p-5 flex flex-col sm:flex-row items-center gap-4 transition-colors ${isActive ? 'ring-1 ring-success/40' : ''}`}>
        <div className="relative">
          <Clock className={`h-8 w-8 ${isActive ? 'text-success' : 'text-primary'}`} />
          {isActive && (
            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success" />
            </span>
          )}
        </div>
        <div className="flex-1 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2 text-sm text-muted-foreground">
            Today
            {isActive && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-success/15 text-success text-[10px] font-semibold uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" /> Live
              </span>
            )}
          </div>
          <div className={`text-xl font-bold tabular-nums ${isActive ? 'text-success' : ''}`}>{formatElapsed()}</div>
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-1 text-xs">
            {today?.check_in_time && <span className="text-success font-medium">In: {fmtTime(today.check_in_time)}</span>}
            {today?.check_out_time && <span className="text-destructive font-medium">Out: {fmtTime(today.check_out_time)}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          {!today?.check_in_time && (
            <button
              onClick={() => checkInMut.mutate()}
              disabled={checkInMut.isPending}
              className="px-4 py-2 rounded-lg bg-success text-success-foreground text-sm font-semibold hover:opacity-90 active:scale-[0.97] transition-all flex items-center gap-1 disabled:opacity-50"
            >
              <ArrowUpRight className="h-4 w-4" /> {checkInMut.isPending ? 'Checking in…' : 'Check In'}
            </button>
          )}
          {today?.check_in_time && !today?.check_out_time && (
            <button
              onClick={() => checkOutMut.mutate()}
              disabled={checkOutMut.isPending}
              className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-semibold hover:opacity-90 active:scale-[0.97] transition-all flex items-center gap-1 disabled:opacity-50"
            >
              <ArrowDownRight className="h-4 w-4" /> {checkOutMut.isPending ? 'Checking out…' : 'Check Out'}
            </button>
          )}
          {today?.check_in_time && today?.check_out_time && (
            <span className="px-4 py-2 rounded-lg bg-secondary text-foreground text-sm font-medium flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-success" /> Day complete
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* My Tasks */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">My Tasks</h2>
            {basePath !== '/portal' && (
              <button onClick={() => navigate(`${basePath}/tasks`)} className="text-xs text-primary hover:underline">View all</button>
            )}
          </div>
          <div className="space-y-2">
            {myTasks.slice(0, 6).map((t: any) => (
              <div key={t.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/50 transition-colors">
                <div>
                  <div className="text-sm font-medium">{t.title}</div>
                  <div className="text-xs text-muted-foreground">{t.project_name}</div>
                </div>
                <span className={t.status === 'Done' ? 'badge-success' : t.status === 'In Progress' ? 'badge-info' : 'badge-neutral'}>{t.status}</span>
              </div>
            ))}
            {myTasks.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No tasks assigned</p>}
          </div>
        </div>

        {/* My Projects */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">My Projects</h2>
            <button onClick={() => navigate(`${basePath}/projects`)} className="text-xs text-primary hover:underline">View all</button>
          </div>
          <div className="space-y-2">
            {myProjects.slice(0, 6).map((p: any) => (
              <div key={p.id} onClick={() => navigate(`${basePath}/projects/${p.id}`)} className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-6 rounded-full flex-shrink-0" style={{ background: p.color || 'hsl(var(--primary))' }} />
                  <div>
                    <div className="text-sm font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.client_name}</div>
                  </div>
                </div>
                <span className={p.status === 'Active' ? 'badge-success' : p.status === 'Completed' ? 'badge-info' : 'badge-neutral'}>{p.status}</span>
              </div>
            ))}
            {myProjects.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No projects</p>}
          </div>
        </div>

        {/* My Leads */}
        {myLeads.length > 0 && (
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold">My Leads</h2>
              {basePath === '/admin' && (
                <button onClick={() => navigate('/admin/crm')} className="text-xs text-primary hover:underline">View all</button>
              )}
            </div>
            <div className="space-y-2">
              {myLeads.slice(0, 5).map((l: any) => (
                <div key={l.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/50 transition-colors">
                  <div>
                    <div className="text-sm font-medium">{l.full_name}</div>
                    <div className="text-xs text-muted-foreground">{l.company_name}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">{l.deal_value ? `$${Number(l.deal_value).toLocaleString()}` : '—'}</div>
                    <span className={l.status === 'Closed Won' ? 'badge-success' : l.status === 'Closed Lost' ? 'badge-danger' : 'badge-info'}>{l.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* My Invoices */}
        {myInvoices.length > 0 && (
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold">My Invoices</h2>
              <button onClick={() => navigate(basePath === '/portal' ? '/portal/invoices' : `${basePath}/invoicing`)} className="text-xs text-primary hover:underline">View all</button>
            </div>
            <div className="space-y-2">
              {myInvoices.slice(0, 5).map((inv: any) => (
                <div key={inv.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/50 transition-colors">
                  <div>
                    <div className="text-sm font-medium">{inv.invoice_number || inv.id?.slice(0, 8)}</div>
                    <div className="text-xs text-muted-foreground">{inv.client_name}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">${Number(inv.total || 0).toLocaleString()}</div>
                    <span className={inv.status === 'Paid' ? 'badge-success' : inv.status === 'Overdue' ? 'badge-danger' : 'badge-warning'}>{inv.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="glass-card h-48 animate-pulse" />)}
        </div>
      )}
    </div>
  );
}