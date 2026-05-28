import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useState } from 'react';
import { Clock, X, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

const statuses = ['All', 'Open', 'In Progress', 'Review', 'Done'];
const taskStatuses = ['Open', 'In Progress', 'Review', 'Done', 'Cancelled'];

export default function EmpTasks() {
  const user = useAuthStore(s => s.user);
  const [status, setStatus] = useState('All');
  const [showTimeLog, setShowTimeLog] = useState<string | null>(null);
  const [timeForm, setTimeForm] = useState({ hours: '', description: '', date: '' });
  const qc = useQueryClient();

  const { data = [], isLoading } = useQuery({
    queryKey: ['my-tasks', status],
    queryFn: () => api.get('/tasks', { params: { assignee_id: user?.id, status: status === 'All' ? undefined : status } }).then(r => r.data?.tasks || r.data || []),
  });

  const updateStatusMut = useMutation({
    mutationFn: ({ taskId, newStatus }: { taskId: string; newStatus: string }) => api.put(`/tasks/${taskId}`, { status: newStatus }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-tasks'] }); toast.success('Status updated'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Error'),
  });

  const logTimeMut = useMutation({
    mutationFn: ({ taskId, data }: { taskId: string; data: typeof timeForm }) =>
      api.post(`/tasks/${taskId}/log-time`, { hours: Number(data.hours), description: data.description, date: data.date || new Date().toISOString().split('T')[0] }),
    onSuccess: () => { setShowTimeLog(null); setTimeForm({ hours: '', description: '', date: '' }); toast.success('Time logged'); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Error'),
  });

  const tasks = Array.isArray(data) ? data : [];

  return (
    <div className="page-container">
      <div className="page-header"><div><h1 className="page-title">My Tasks</h1><p className="page-subtitle">Track and manage your assigned tasks</p></div></div>
      <div className="flex gap-1 overflow-x-auto">
        {statuses.map(s => (
          <button key={s} onClick={() => setStatus(s)} className={`text-xs px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${status === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'}`}>{s}</button>
        ))}
      </div>
      <div className="space-y-2">
        {isLoading ? [...Array(3)].map((_, i) => <div key={i} className="glass-card h-20 animate-pulse" />) :
        tasks.map((t: any) => (
          <div key={t.id} className="glass-card-hover p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">{t.title}</div>
                <div className="text-xs text-muted-foreground">{t.project_name} • {t.type || 'Task'}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className={t.priority === 'Critical' ? 'badge-danger' : t.priority === 'High' ? 'badge-warning' : 'badge-info'}>{t.priority}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <select
                  value={t.status}
                  onChange={e => updateStatusMut.mutate({ taskId: t.id, newStatus: e.target.value })}
                  className="text-xs px-2 py-1 rounded-md bg-secondary border border-border focus:outline-none focus:ring-1 focus:ring-primary/50"
                >
                  {taskStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {t.estimate_hours && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> {t.estimate_hours}h est.</span>
                )}
              </div>
              <button
                onClick={() => setShowTimeLog(t.id)}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <Clock className="h-3 w-3" /> Log Time
              </button>
            </div>
          </div>
        ))}
        {tasks.length === 0 && !isLoading && <div className="text-center py-12 text-muted-foreground text-sm">No tasks in this status</div>}
      </div>

      {/* Time Log Modal */}
      {showTimeLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-md p-6 space-y-4 animate-slide-up">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Log Time</h2>
              <button onClick={() => setShowTimeLog(null)} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Hours *</label>
                <input type="number" step="0.25" min="0.25" placeholder="e.g. 2.5" value={timeForm.hours} onChange={e => setTimeForm(f => ({ ...f, hours: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Date</label>
                <input type="date" value={timeForm.date} onChange={e => setTimeForm(f => ({ ...f, date: e.target.value }))} className="w-full mt-1 px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
            </div>
            <textarea placeholder="What did you work on?" value={timeForm.description} onChange={e => setTimeForm(f => ({ ...f, description: e.target.value }))} rows={3} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowTimeLog(null)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">Cancel</button>
              <button
                onClick={() => showTimeLog && logTimeMut.mutate({ taskId: showTimeLog, data: timeForm })}
                disabled={logTimeMut.isPending || !timeForm.hours}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50"
              >
                {logTimeMut.isPending ? 'Logging...' : 'Log Time'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
