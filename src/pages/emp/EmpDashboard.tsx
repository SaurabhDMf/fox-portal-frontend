import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import StatCard from '@/components/ui/StatCard';
import { useAuthStore } from '@/stores/authStore';
import { ListChecks, Clock, Calendar, Wallet, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export default function EmpDashboard() {
  const user = useAuthStore(s => s.user);
  const qc = useQueryClient();

  const { data: summary } = useQuery({
    queryKey: ['tracker-summary'],
    queryFn: () => api.get('/tracker/tracker-summary').then(r => r.data),
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['my-tasks'],
    queryFn: () => api.get('/tasks', { params: { assignee_id: user?.id, status: 'In Progress' } }).then(r => r.data?.tasks || r.data || []),
  });

  const checkInMut = useMutation({
    mutationFn: () => api.post('/tracker/attendance/check-in'),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tracker-summary'] }); },
  });
  const checkOutMut = useMutation({
    mutationFn: () => api.post('/tracker/attendance/check-out'),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tracker-summary'] }); },
  });

  const s = summary || {};
  const tasksArr = Array.isArray(tasks) ? tasks : [];

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">My Dashboard</h1><p className="page-subtitle">Welcome back, {user?.full_name}</p></div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Tasks" value={tasksArr.length} icon={ListChecks} />
        <StatCard label="Hours This Month" value={s.monthly_hours || '0'} icon={Clock} iconColor="text-info" />
        <StatCard label="Leave Balance" value={s.leave_balance ?? '—'} icon={Calendar} iconColor="text-success" />
        <StatCard label="Next Pay Date" value={s.next_pay_date ? new Date(s.next_pay_date).toLocaleDateString() : '—'} icon={Wallet} iconColor="text-warning" />
      </div>

      {/* Check in/out */}
      <div className="glass-card p-5 flex flex-col sm:flex-row items-center gap-4">
        <Clock className="h-8 w-8 text-primary" />
        <div className="flex-1 text-center sm:text-left">
          <div className="text-sm text-muted-foreground">Today</div>
          <div className="text-xl font-bold">{s.today_hours || '0h 0m'}</div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => checkInMut.mutate()} className="px-4 py-2 rounded-lg bg-success/15 text-success text-sm font-medium hover:bg-success/25 active:scale-[0.97] transition-all flex items-center gap-1">
            <ArrowUpRight className="h-4 w-4" /> Check In
          </button>
          <button onClick={() => checkOutMut.mutate()} className="px-4 py-2 rounded-lg bg-destructive/15 text-destructive text-sm font-medium hover:bg-destructive/25 active:scale-[0.97] transition-all flex items-center gap-1">
            <ArrowDownRight className="h-4 w-4" /> Check Out
          </button>
        </div>
      </div>

      {/* Active Tasks */}
      <div className="glass-card p-5">
        <h2 className="text-sm font-semibold mb-4">My Active Tasks</h2>
        <div className="space-y-2">
          {tasksArr.slice(0, 10).map((t: any) => (
            <div key={t.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/50 transition-colors">
              <div><div className="text-sm font-medium">{t.title}</div><div className="text-xs text-muted-foreground">{t.project_name}</div></div>
              <span className="badge-info">{t.status}</span>
            </div>
          ))}
          {tasksArr.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No active tasks</p>}
        </div>
      </div>
    </div>
  );
}
