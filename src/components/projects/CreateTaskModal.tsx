import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { extractProjectArray, extractProjectEntity } from '@/lib/projectResponse';
import type { Epic, Sprint } from '@/lib/projectTypes';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  projectId: string;
  defaultStatus?: string;
  onClose: () => void;
}

type ItemType = 'Epic' | 'Story' | 'Task' | 'Bug';
const ITEM_TYPES: ItemType[] = ['Task', 'Story', 'Bug', 'Epic'];
const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];
const STATUS_OPTIONS = ['Open', 'In Progress', 'Review', 'Done', 'Cancelled'];

export default function CreateTaskModal({ projectId, defaultStatus, onClose }: Props) {
  const qc = useQueryClient();
  const [itemType, setItemType] = useState<ItemType>('Task');
  const [form, setForm] = useState({
    title: '', description: '', priority: 'Medium', status: defaultStatus || 'Open',
    assignee_ids: [] as string[], epic_id: '', sprint_id: '', parent_task_id: '',
    story_points: '', due_date: '', color: '#3B82F6',
  });

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      epic_id: itemType === 'Story' ? prev.epic_id : '',
      sprint_id: itemType === 'Epic' ? prev.sprint_id : '',
      parent_task_id: itemType === 'Task' || itemType === 'Bug' ? prev.parent_task_id : '',
    }));
  }, [itemType]);

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
    enabled: itemType === 'Epic',
  });
  const sprints = (Array.isArray(sprintsRaw) ? sprintsRaw : []).filter((s: Sprint) => s.status !== 'Completed');

  // For Task/Bug: need to pick a parent Story
  const { data: storiesRaw } = useQuery({
    queryKey: ['project-stories', projectId],
    queryFn: async () => {
      try {
        const r = await api.get('/tasks', { params: { project_id: projectId, type: 'Story' } });
        const stories = extractProjectArray(r.data, ['tasks']);
        if (stories.length > 0) return stories;
      } catch {}
      // Fallback: fetch all project tasks and filter client-side
      try {
        const r = await api.get('/tasks', { params: { project_id: projectId } });
        const all = extractProjectArray(r.data, ['tasks']);
        const storyTasks = all.filter((t: any) => t.type === 'Story');
        return storyTasks.length > 0 ? storyTasks : all.filter((t: any) => t.type !== 'Subtask');
      } catch { return []; }
    },
  });
  const stories = Array.isArray(storiesRaw) ? storiesRaw : [];

  const createMut = useMutation({
    mutationFn: (d: typeof form & { itemType: ItemType }) => {
      if (d.itemType === 'Epic') {
        const payload: Record<string, any> = { title: d.title };
        if (d.color) payload.color = d.color;
        if (d.sprint_id) payload.sprint_id = d.sprint_id;
        if (d.due_date) payload.due_date = d.due_date;
        return api.post(`/projects/${projectId}/epics`, payload);
      }

      // Story, Task, Bug
      const payload: Record<string, any> = {
        title: d.title,
        type: d.itemType,
        priority: d.priority,
        status: d.status,
        project_id: projectId,
        epic_id: null,
        sprint_id: null,
        parent_task_id: null,
      };
      if (d.description?.trim()) payload.description = d.description.trim();
      if (d.assignee_ids.length > 0) payload.assignee_ids = d.assignee_ids;
      if (d.story_points) payload.story_points = Number(d.story_points);
      if (d.due_date) payload.due_date = d.due_date;

      // Story → needs epic_id
      if (d.itemType === 'Story' && d.epic_id) payload.epic_id = d.epic_id;
      // Task/Bug → needs parent_task_id (Story's ID). NO sprint_id.
      if ((d.itemType === 'Task' || d.itemType === 'Bug') && d.parent_task_id) payload.parent_task_id = d.parent_task_id;

      return api.post('/tasks', payload);
    },
    onSuccess: (res) => {
      if (itemType === 'Epic') {
        qc.invalidateQueries({ queryKey: ['project-epics', projectId] });
        qc.invalidateQueries({ queryKey: ['project-backlog', projectId] });
      } else {
        const newTask = extractProjectEntity(res.data, ['task']);
        if (newTask?.id) {
          qc.setQueryData(['project-backlog', projectId], (old: any) => {
            const prev = Array.isArray(old) ? old : [];
            return prev.some((item: any) => item?.id === newTask.id) ? prev : [...prev, newTask];
          });
        }
        qc.invalidateQueries({ queryKey: ['project-board', projectId] });
        qc.invalidateQueries({ queryKey: ['project-backlog', projectId] });
        qc.invalidateQueries({ queryKey: ['project-all-tasks', projectId] });
        qc.invalidateQueries({ queryKey: ['project-epic-task-rollups', projectId] });
        qc.invalidateQueries({ queryKey: ['sprint-hierarchy', projectId] });
      }
      onClose();
      toast.success(`${itemType} created`);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || e.response?.data?.error || `Failed to create ${itemType}`),
  });

  const toggleAssignee = (userId: string) => {
    setForm(f => ({
      ...f,
      assignee_ids: f.assignee_ids.includes(userId) ? f.assignee_ids.filter(id => id !== userId) : [...f.assignee_ids, userId],
    }));
  };

  const canSubmit = () => {
    if (!form.title) return false;
    return true;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="glass-card w-full max-w-lg p-6 space-y-4 animate-slide-up">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Create {itemType}</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>

        {/* Item type selector */}
        <div className="flex gap-1">
          {ITEM_TYPES.map(t => (
            <button key={t} onClick={() => setItemType(t)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${itemType === t ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>{t}</button>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          {itemType === 'Task' || itemType === 'Bug'
            ? 'Leave Parent Story empty to create a main task. Select one only if this should sit under that story.'
            : itemType === 'Story'
              ? 'Epic is optional. Leave it empty to create a standalone story.'
              : 'Sprint is optional. Leave it empty to keep this epic in the backlog.'}
        </p>

        <input placeholder={`${itemType} title *`} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" autoFocus />

        {itemType !== 'Epic' && (
          <textarea placeholder="Description (optional)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
        )}

        {/* Epic-specific: sprint + color */}
        {itemType === 'Epic' && (
          <>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Sprint (leave empty for backlog)</label>
              <select value={form.sprint_id} onChange={e => setForm(f => ({ ...f, sprint_id: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none">
                <option value="">Backlog (no sprint)</option>
                {sprints.map((s: Sprint) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </>
        )}

        {/* Story: pick parent Epic */}
        {itemType === 'Story' && (
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Parent Epic (optional)</label>
            <select value={form.epic_id} onChange={e => setForm(f => ({ ...f, epic_id: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none">
              <option value="">None (standalone story)</option>
              {epics.map((e: Epic) => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
          </div>
        )}

        {/* Task/Bug: pick parent Story */}
        {(itemType === 'Task' || itemType === 'Bug') && (
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Parent Story (optional — leave empty for standalone {itemType})</label>
            <select value={form.parent_task_id} onChange={e => setForm(f => ({ ...f, parent_task_id: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none">
              <option value="">None (standalone {itemType.toLowerCase()})</option>
              {stories.map((s: any) => <option key={s.id} value={s.id}>{s.task_number} — {s.title}</option>)}
            </select>
          </div>
        )}

        {/* Priority (not for Epic) */}
        {itemType !== 'Epic' && (
          <div className="grid grid-cols-2 gap-3">
            <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none">
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none">
              {STATUS_OPTIONS.map(status => <option key={status} value={status}>{status}</option>)}
            </select>
          </div>
        )}

        {/* Assignees (not for Epic) */}
        {itemType !== 'Epic' && members.length > 0 && (
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Assignees</label>
            <div className="flex flex-wrap gap-1.5">
              {members.map((m: any) => {
                const uid = m.user_id || m.id;
                const selected = form.assignee_ids.includes(uid);
                return (
                  <button key={uid} onClick={() => toggleAssignee(uid)} className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-colors ${selected ? 'bg-primary/15 text-primary border border-primary/30' : 'bg-secondary text-muted-foreground border border-border hover:border-primary/30'}`}>
                    <div className="w-4 h-4 rounded-full bg-primary/15 flex items-center justify-center text-[8px] font-bold text-primary">{m.full_name?.[0]}</div>
                    {m.full_name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Story points + Due date (not for Epic) */}
        {itemType !== 'Epic' && (
          <div className="grid grid-cols-2 gap-3">
            <input type="number" placeholder="Story Points" value={form.story_points} onChange={e => setForm(f => ({ ...f, story_points: e.target.value }))} className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none" />
            <input type="date" placeholder="Due Date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className="px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none" />
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">Cancel</button>
          <button onClick={() => createMut.mutate({ ...form, itemType })} disabled={!canSubmit() || createMut.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
            {createMut.isPending ? 'Creating...' : `Create ${itemType}`}
          </button>
        </div>
      </div>
    </div>
  );
}
