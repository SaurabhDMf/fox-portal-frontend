import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Plus, X, ListTodo } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const STATUS_CLS: Record<string, string> = {
  Open: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  'In Progress': 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  Review: 'bg-purple-500/15 text-purple-700 dark:text-purple-400',
  Done: 'bg-green-500/15 text-green-700 dark:text-green-400',
  Cancelled: 'bg-red-500/15 text-red-700 dark:text-red-400',
};

const PRIORITY_CLS: Record<string, string> = {
  High: 'bg-red-500/15 text-red-700 dark:text-red-400',
  Critical: 'bg-red-500/15 text-red-700 dark:text-red-400',
  Medium: 'bg-orange-500/15 text-orange-700 dark:text-orange-400',
  Low: 'bg-green-500/15 text-green-700 dark:text-green-400',
};

function StatusBadge({ status }: { status?: string }) {
  if (!status) return <span className="text-xs text-muted-foreground">—</span>;
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLS[status] || 'bg-muted text-muted-foreground'}`}>{status}</span>;
}

export default function CPTasks() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['cp-tasks'],
    queryFn: () => api.get('/tasks').then(r => {
      const d = r.data?.data ?? r.data?.tasks ?? r.data;
      return Array.isArray(d) ? d : [];
    }),
  });

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Tasks</h1>
          <p className="page-subtitle">Track requests you've submitted</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all"
        >
          <Plus className="h-4 w-4" /> New Request
        </button>
      </div>

      <div className="glass-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : tasks.length > 0 ? tasks.map((t: any) => (
              <TableRow
                key={t.id}
                className="hover:bg-muted/50 cursor-pointer"
                onClick={() => navigate(`/client-portal/tasks/${t.id}`)}
              >
                <TableCell>
                  <div className="flex items-center gap-2">
                    {t.task_number && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{t.task_number}</span>}
                    <span className="font-medium text-sm">{t.title}</span>
                  </div>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{t.project_name || '—'}</TableCell>
                <TableCell><StatusBadge status={t.status} /></TableCell>
                <TableCell>
                  <Badge variant="secondary" className={`text-[10px] ${PRIORITY_CLS[t.priority] || ''}`}>{t.priority || '—'}</Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{fmtDate(t.due_date)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{fmtDate(t.created_at)}</TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={6} className="py-16 text-center">
                  <ListTodo className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
                  <div className="text-sm text-muted-foreground mb-3">No tasks yet</div>
                  <button onClick={() => setShowCreate(true)} className="text-sm text-primary hover:underline">
                    Submit your first request →
                  </button>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {showCreate && (
        <CreateTaskModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ['cp-tasks'] });
            setShowCreate(false);
          }}
        />
      )}
    </div>
  );
}

function CreateTaskModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ title: '', description: '', project_id: '', priority: 'Medium', due_date: '' });
  const [loading, setLoading] = useState(false);

  const { data: projects = [] } = useQuery({
    queryKey: ['cp-projects-for-task'],
    queryFn: () => api.get('/projects').then(r => {
      const d = r.data?.data ?? r.data?.projects ?? r.data;
      return Array.isArray(d) ? d : [];
    }),
  });

  // Preselect when only one project
  useEffect(() => {
    if (projects.length === 1 && !form.project_id) {
      setForm(f => ({ ...f, project_id: String(projects[0].id) }));
    }
  }, [projects]);

  const submit = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    setLoading(true);
    try {
      const payload: any = { title: form.title.trim(), priority: form.priority };
      if (form.description.trim()) payload.description = form.description.trim();
      if (form.project_id) payload.project_id = form.project_id;
      if (form.due_date) payload.due_date = form.due_date;
      await api.post('/tasks', payload);
      toast.success('Request submitted');
      onCreated();
    } catch (e: any) {
      toast.error(e.response?.data?.message || e.response?.data?.error || 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50";
  const disabled = loading || !form.title.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="glass-card w-full max-w-md p-6 space-y-4 animate-slide-up">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">New Request</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Title *</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inputCls} placeholder="e.g. Update pricing page" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={4} className={`${inputCls} resize-y min-h-[100px]`} placeholder="Describe what you need…" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Project</label>
            <select value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))} className={inputCls}>
              <option value="">— None —</option>
              {projects.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Priority</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className={inputCls}>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Due Date</label>
              <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className={inputCls} />
            </div>
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">Cancel</button>
          <button
            onClick={submit}
            disabled={disabled}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Submitting…' : 'Submit Request'}
          </button>
        </div>
      </div>
    </div>
  );
}
