import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { extractProjectArray, extractProjectEntity } from '@/lib/projectResponse';
import { useState } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  projectId: string;
  defaultStatus?: string;
  onClose: () => void;
}

const TYPES = ['Story', 'Task', 'Bug', 'Subtask'];
const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];

export default function CreateTaskModal({ projectId, defaultStatus, onClose }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: '', type: 'Story', priority: 'Medium', status: defaultStatus || 'Open',
    assignee_ids: [] as string[], epic_id: '', sprint_id: '', story_points: '', due_date: '',
    parent_task_id: '',
  });

  const { data: membersRaw } = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => api.get(`/projects/${projectId}/members`).then(r => extractProjectArray(r.data, ['members', 'users'])),
  });
  const members = Array.isArray(membersRaw) ? membersRaw : [];

  const { data: epicsRaw } = useQuery({
    queryKey: ['project-epics', projectId],
    queryFn: () => api.get(`/projects/${projectId}/epics`).then(r => extractProjectArray(r.data, ['epics'])),
  });
  const epics = Array.isArray(epicsRaw) ? epicsRaw : [];

  const { data: sprintsRaw } = useQuery({
    queryKey: ['project-sprints', projectId],
    queryFn: () => api.get(`/projects/${projectId}/sprints`).then(r => extractProjectArray(r.data, ['sprints'])),
  });
  const sprints = Array.isArray(sprintsRaw) ? sprintsRaw : [];

  const createMut = useMutation({
    mutationFn: (d: typeof form) => api.post('/tasks', {
      ...d,
      project_id: projectId,
      story_points: d.story_points ? Number(d.story_points) : undefined,
      epic_id: d.epic_id || undefined,
      sprint_id: d.sprint_id || undefined,
      parent_task_id: d.parent_task_id || undefined,
    }),
    onSuccess: (res) => {
      const newTask = extractProjectEntity(res.data, ['task']);
      if (newTask?.id) {
        qc.setQueryData(['project-backlog', projectId], (old: any) => {
          const prev = Array.isArray(old) ? old : [];
          return prev.some((item: any) => item?.id === newTask.id) ? prev : [...prev, newTask];
        });
      }
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ['project-board', projectId] });
        qc.invalidateQueries({ queryKey: ['project-backlog', projectId] });
      }, 1200);
      onClose();
      toast.success('Task created');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Error'),
  });

  const toggleAssignee = (userId: string) => {
    setForm(f => ({
      ...f,
      assignee_ids: f.assignee_ids.includes(userId) ? f.assignee_ids.filter(id => id !== userId) : [...f.assignee_ids, userId],
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="glass-card w-full max-w-lg p-6 space-y-4 animate-slide-up">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Create Task</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>

        <input placeholder="Task title *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" autoFocus />

        <div className="grid grid-cols-2 gap-3">
          <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none">
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none">
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {/* Assignees multi-select */}
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Assignees</label>
          <div className="flex flex-wrap gap-1.5">
            {members.map((m: any) => {
              const selected = form.assignee_ids.includes(m.user_id);
              return (
                <button key={m.user_id || m.id} onClick={() => toggleAssignee(m.user_id || m.id)} className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-colors ${selected ? 'bg-primary/15 text-primary border border-primary/30' : 'bg-secondary text-muted-foreground border border-border hover:border-primary/30'}`}>
                  <div className="w-4 h-4 rounded-full bg-primary/15 flex items-center justify-center text-[8px] font-bold text-primary">{m.full_name?.[0]}</div>
                  {m.full_name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <select value={form.epic_id} onChange={e => setForm(f => ({ ...f, epic_id: e.target.value }))} className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none">
            <option value="">No Epic</option>
            {epics.map((e: any) => <option key={e.id} value={e.id}>{e.title}</option>)}
          </select>
          <select value={form.sprint_id} onChange={e => setForm(f => ({ ...f, sprint_id: e.target.value }))} className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none">
            <option value="">No Sprint</option>
            {sprints.filter((s: any) => s.status !== 'Completed').map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <input type="number" placeholder="Story Points" value={form.story_points} onChange={e => setForm(f => ({ ...f, story_points: e.target.value }))} className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none" />
          <input type="date" placeholder="Due Date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none" />
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">Cancel</button>
          <button onClick={() => createMut.mutate(form)} disabled={!form.title || createMut.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
            {createMut.isPending ? 'Creating...' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>
  );
}
