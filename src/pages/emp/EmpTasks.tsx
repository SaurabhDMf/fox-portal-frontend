import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useState } from 'react';

const statuses = ['All', 'Open', 'In Progress', 'Review', 'Done'];

export default function EmpTasks() {
  const user = useAuthStore(s => s.user);
  const [status, setStatus] = useState('All');

  const { data = [], isLoading } = useQuery({
    queryKey: ['my-tasks', status],
    queryFn: () => api.get('/tasks', { params: { assignee_id: user?.id, status: status === 'All' ? undefined : status } }).then(r => r.data?.tasks || r.data || []),
  });

  const tasks = Array.isArray(data) ? data : [];

  return (
    <div className="page-container">
      <div className="page-header"><div><h1 className="page-title">My Tasks</h1></div></div>
      <div className="flex gap-1 overflow-x-auto">
        {statuses.map(s => (
          <button key={s} onClick={() => setStatus(s)} className={`text-xs px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${status === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'}`}>{s}</button>
        ))}
      </div>
      <div className="space-y-2">
        {tasks.map((t: any) => (
          <div key={t.id} className="glass-card-hover p-4 flex items-center justify-between">
            <div><div className="text-sm font-medium">{t.title}</div><div className="text-xs text-muted-foreground">{t.project_name} • {t.type}</div></div>
            <div className="flex items-center gap-2">
              <span className={t.priority === 'Critical' ? 'badge-danger' : t.priority === 'High' ? 'badge-warning' : 'badge-info'}>{t.priority}</span>
              <span className="badge-neutral">{t.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
