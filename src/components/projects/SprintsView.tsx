import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { extractProjectArray, extractProjectEntity } from '@/lib/projectResponse';
import type { Sprint } from '@/lib/projectTypes';
import { useState } from 'react';
import { Plus, X, Play, CheckCircle2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  projectId: string;
}

export default function SprintsView({ projectId }: Props) {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [showComplete, setShowComplete] = useState<string | null>(null);
  const [deleteSprintId, setDeleteSprintId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', goal: '', start_date: '', end_date: '' });
  const [moveIncompleteTo, setMoveIncompleteTo] = useState('backlog');

  const { data: sprintsRaw } = useQuery({
    queryKey: ['project-sprints', projectId],
    queryFn: () => api.get(`/projects/${projectId}/sprints`).then(r => extractProjectArray<Sprint>(r.data, ['sprints'])),
  });
  const sprints: Sprint[] = Array.isArray(sprintsRaw) ? sprintsRaw : [];

  const createMut = useMutation({
    mutationFn: (d: typeof form) => api.post(`/projects/${projectId}/sprints`, d),
    onSuccess: (res) => {
      const newSprint = extractProjectEntity<Sprint>(res.data, ['sprint']);
      if (newSprint?.id) {
        qc.setQueryData(['project-sprints', projectId], (old: any) => {
          const prev = Array.isArray(old) ? old : [];
          return prev.some((item: any) => item?.id === newSprint.id) ? prev : [...prev, newSprint];
        });
      }
      setTimeout(() => qc.invalidateQueries({ queryKey: ['project-sprints', projectId] }), 1200);
      setShowCreate(false);
      setForm({ name: '', goal: '', start_date: '', end_date: '' });
      toast.success('Sprint created');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Error creating sprint'),
  });

  const startMut = useMutation({
    mutationFn: (sid: string) => api.post(`/projects/${projectId}/sprints/${sid}/start`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-sprints', projectId] });
      toast.success('Sprint started');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Error starting sprint'),
  });

  const completeMut = useMutation({
    mutationFn: (sid: string) => api.post(`/projects/${projectId}/sprints/${sid}/complete`, { move_incomplete_to: moveIncompleteTo }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-sprints', projectId] });
      setShowComplete(null);
      toast.success('Sprint completed');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Error completing sprint'),
  });

  const deleteMut = useMutation({
    mutationFn: (sid: string) => api.delete(`/projects/${projectId}/sprints/${sid}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-sprints', projectId] });
      qc.invalidateQueries({ queryKey: ['project-backlog', projectId] });
      setDeleteSprintId(null);
      toast.success('Sprint deleted');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Error deleting sprint'),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Sprints</h3>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 active:scale-[0.97] transition-all">
          <Plus className="h-3 w-3" /> New Sprint
        </button>
      </div>

      <div className="space-y-3">
        {sprints.map(sprint => {
          const progress = sprint.task_count ? Math.round(((sprint.done_count || 0) / sprint.task_count) * 100) : 0;
          return (
            <div key={sprint.id} className="glass-card p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-sm">{sprint.name}</h4>
                    <span className={sprint.status === 'Active' ? 'badge-success' : sprint.status === 'Completed' ? 'badge-info' : 'badge-neutral'}>{sprint.status}</span>
                  </div>
                  {sprint.goal && <p className="text-xs text-muted-foreground mt-1">{sprint.goal}</p>}
                  {sprint.start_date && sprint.end_date && (
                    <p className="text-xs text-muted-foreground">{new Date(sprint.start_date).toLocaleDateString()} — {new Date(sprint.end_date).toLocaleDateString()}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  {sprint.status === 'Planned' && (
                    <button onClick={() => startMut.mutate(sprint.id)} className="flex items-center gap-1 px-3 py-1 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors">
                      <Play className="h-3 w-3" /> Start
                    </button>
                  )}
                  {sprint.status === 'Active' && (
                    <button onClick={() => setShowComplete(sprint.id)} className="flex items-center gap-1 px-3 py-1 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors">
                      <CheckCircle2 className="h-3 w-3" /> Complete
                    </button>
                  )}
                  <button onClick={() => setDeleteSprintId(sprint.id)} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Delete Sprint">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {sprint.task_count != null && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Progress</span><span>{sprint.done_count || 0}/{sprint.task_count} tasks ({progress}%)</span></div>
                  <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {sprints.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground mb-2">No sprints yet</p>
            <button onClick={() => setShowCreate(true)} className="text-sm text-primary hover:underline">Create your first sprint →</button>
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-md p-6 space-y-4 animate-slide-up">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">New Sprint</h2>
              <button onClick={() => setShowCreate(false)} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
            </div>
            <input placeholder="Sprint Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            <textarea placeholder="Sprint Goal" value={form.goal} onChange={e => setForm(f => ({ ...f, goal: e.target.value }))} rows={2} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-muted-foreground">Start</label><input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
              <div><label className="text-xs text-muted-foreground">End</label><input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">Cancel</button>
              <button onClick={() => createMut.mutate(form)} disabled={!form.name || createMut.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
                {createMut.isPending ? 'Creating...' : 'Create Sprint'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showComplete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-sm p-6 space-y-4 animate-slide-up">
            <h2 className="text-lg font-semibold">Complete Sprint</h2>
            <p className="text-sm text-muted-foreground">Where should incomplete tasks go?</p>
            <select value={moveIncompleteTo} onChange={e => setMoveIncompleteTo(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
              <option value="backlog">Move to Backlog</option>
              {sprints.filter(s => s.status === 'Planned').map(s => <option key={s.id} value={s.id}>Move to {s.name}</option>)}
            </select>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowComplete(null)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">Cancel</button>
              <button onClick={() => completeMut.mutate(showComplete)} disabled={completeMut.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
                {completeMut.isPending ? 'Completing...' : 'Complete Sprint'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Sprint Confirmation */}
      {deleteSprintId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-sm p-6 space-y-4 animate-slide-up">
            <h2 className="text-lg font-semibold">Delete Sprint</h2>
            <p className="text-sm text-muted-foreground">Are you sure you want to delete this sprint? Tasks will be moved to the backlog.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteSprintId(null)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors">Cancel</button>
              <button onClick={() => deleteMut.mutate(deleteSprintId)} disabled={deleteMut.isPending} className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
                {deleteMut.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}