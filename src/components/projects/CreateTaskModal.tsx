import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { extractProjectArray, extractProjectEntity } from '@/lib/projectResponse';
import type { Epic, Sprint } from '@/lib/projectTypes';
import { useState } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  projectId: string;
  defaultStatus?: string;
  onClose: () => void;
}

type ItemType = 'Task' | 'Story' | 'Bug' | 'Feature';
const ITEM_TYPES: ItemType[] = ['Task', 'Story', 'Bug', 'Feature'];
const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];
const STATUS_OPTIONS = ['Open', 'In Progress', 'Review', 'Done', 'Cancelled'];
const STAGES = ['Design', 'Development', 'Integration', 'Testing', 'Done'];

export default function CreateTaskModal({ projectId, defaultStatus, onClose }: Props) {
  const qc = useQueryClient();
  const [itemType, setItemType] = useState<ItemType>('Task');
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'Medium',
    status: defaultStatus || 'Open',
    stage: '',
    assignee_ids: [] as string[],
    epic_id: '',
    sprint_id: '',
    parent_task_id: '',
    story_points: '',
    due_date: '',
  });

  const { data: membersRaw } = useQuery({
    queryKey: ['project-members', projectId],
    queryFn: () => api.get(`/projects/${projectId}/members`).then(r => extractProjectArray(r.data, ['members', 'users'])),
  });
  const members = Array.isArray(membersRaw) ? membersRaw : [];

  const { data: epicsRaw } = useQuery({
    queryKey: ['project-epics', projectId],
    queryFn: () => api.get(`/projects/${projectId}/epics`).then(r => extractProjectArray<Epic>(r.data, ['epics'])),
  });
  const epics = Array.isArray(epicsRaw) ? epicsRaw : [];

  const { data: sprintsRaw } = useQuery({
    queryKey: ['project-sprints', projectId],
    queryFn: () => api.get(`/projects/${projectId}/sprints`).then(r => extractProjectArray<Sprint>(r.data, ['sprints'])),
  });
  const sprints = (Array.isArray(sprintsRaw) ? sprintsRaw : []).filter((s: Sprint) => s.status !== 'Completed');

  const { data: storiesRaw } = useQuery({
    queryKey: ['project-stories', projectId],
    queryFn: async () => {
      try {
        const r = await api.get('/tasks', { params: { project_id: projectId, type: 'Story' } });
        const stories = extractProjectArray(r.data, ['tasks']);
        if (stories.length > 0) return stories;
      } catch {}
      try {
        const r = await api.get('/tasks', { params: { project_id: projectId } });
        const all = extractProjectArray(r.data, ['tasks']);
        return all.filter((t: any) => t.type === 'Story');
      } catch { return []; }
    },
  });
  const stories = Array.isArray(storiesRaw) ? storiesRaw : [];

  const createMut = useMutation({
    mutationFn: () => {
      const payload: Record<string, any> = {
        project_id: projectId,
        title: form.title,
        type: itemType,
        priority: form.priority,
        status: form.status,
      };
      if (form.description.trim()) payload.description = form.description.trim();
      if (form.stage) payload.stage = form.stage;
      if (form.assignee_ids.length === 1) payload.assignee_id = form.assignee_ids[0];
      if (form.assignee_ids.length > 1) payload.assignee_ids = form.assignee_ids;
      if (form.epic_id) payload.epic_id = form.epic_id; else payload.epic_id = null;
      if (form.sprint_id) payload.sprint_id = form.sprint_id; else payload.sprint_id = null;
      if (form.parent_task_id) payload.parent_task_id = form.parent_task_id; else payload.parent_task_id = null;
      if (form.story_points) payload.story_points = Number(form.story_points);
      if (form.due_date) payload.due_date = form.due_date;
      return api.post('/tasks', payload);
    },
    onSuccess: (res) => {
      const newTask = extractProjectEntity(res.data, ['task']);
      if (newTask?.id) {
        qc.setQueryData(['project-all-tasks', projectId], (old: any) => {
          const prev = Array.isArray(old) ? old : [];
          return prev.some((t: any) => t?.id === newTask.id) ? prev : [...prev, newTask];
        });
      }
      qc.invalidateQueries({ queryKey: ['project-board', projectId] });
      qc.invalidateQueries({ queryKey: ['project-backlog', projectId] });
      qc.invalidateQueries({ queryKey: ['project-epics', projectId] });
      qc.invalidateQueries({ queryKey: ['sprint-hierarchy', projectId] });
      // Delay refetch of all-tasks so backend has time to commit
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ['project-all-tasks', projectId] });
      }, 1500);
      onClose();
      toast.success(`${itemType} created`);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || e.response?.data?.error || `Failed to create ${itemType}`),
  });

  const toggleAssignee = (uid: string) =>
    setForm(f => ({ ...f, assignee_ids: f.assignee_ids.includes(uid) ? f.assignee_ids.filter(id => id !== uid) : [...f.assignee_ids, uid] }));

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="glass-card w-full max-w-lg p-6 space-y-4 animate-slide-up max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Create {itemType}</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>

        {/* Type selector */}
        <div className="flex gap-1">
          {ITEM_TYPES.map(t => (
            <button key={t} onClick={() => setItemType(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${itemType === t ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
              {t}
            </button>
          ))}
        </div>

        {/* Title */}
        <input placeholder={`${itemType} title *`} value={form.title} onChange={e => set('title', e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" autoFocus />

        {/* Description */}
        <textarea placeholder="Description (optional)" value={form.description} onChange={e => set('description', e.target.value)} rows={2}
          className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />

        {/* Priority + Status + Stage */}
        <div className="grid grid-cols-3 gap-3">
          <select value={form.priority} onChange={e => set('priority', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none">
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={form.status} onChange={e => set('status', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none">
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={form.stage} onChange={e => set('stage', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none">
            <option value="">No Stage</option>
            {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Epic (optional) */}
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Epic (optional)</label>
          <select value={form.epic_id} onChange={e => set('epic_id', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none">
            <option value="">None</option>
            {epics.map((ep: Epic) => <option key={ep.id} value={ep.id}>{ep.title}</option>)}
          </select>
        </div>

        {/* Sprint (optional) */}
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Sprint (optional)</label>
          <select value={form.sprint_id} onChange={e => set('sprint_id', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none">
            <option value="">None</option>
            {sprints.map((s: Sprint) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        {/* Parent Story (optional) */}
        {stories.length > 0 && (
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Parent Story (optional — makes this a sub-task)</label>
            <select value={form.parent_task_id} onChange={e => set('parent_task_id', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none">
              <option value="">None (standalone {itemType.toLowerCase()})</option>
              {stories.map((s: any) => <option key={s.id} value={s.id}>{s.task_number} — {s.title}</option>)}
            </select>
          </div>
        )}

        {/* Assignees */}
        {members.length > 0 && (
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Assignees</label>
            <div className="flex flex-wrap gap-1.5">
              {members.map((m: any) => {
                const uid = m.user_id || m.id;
                const sel = form.assignee_ids.includes(uid);
                return (
                  <button key={uid} onClick={() => toggleAssignee(uid)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-colors ${sel ? 'bg-primary/15 text-primary border border-primary/30' : 'bg-secondary text-muted-foreground border border-border hover:border-primary/30'}`}>
                    <div className="w-4 h-4 rounded-full bg-primary/15 flex items-center justify-center text-[8px] font-bold text-primary">{m.full_name?.[0]}</div>
                    {m.full_name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Story points + Due date */}
        <div className="grid grid-cols-2 gap-3">
          <input type="number" placeholder="Story Points" value={form.story_points} onChange={e => set('story_points', e.target.value)}
            className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none" />
          <input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)}
            className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none" />
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">Cancel</button>
          <button onClick={() => createMut.mutate()} disabled={!form.title || createMut.isPending}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
            {createMut.isPending ? 'Creating...' : `Create ${itemType}`}
          </button>
        </div>
      </div>
    </div>
  );
}
