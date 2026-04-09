import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { extractProjectArray, extractProjectEntity } from '@/lib/projectResponse';
import type { Epic, ProjectTask, Sprint } from '@/lib/projectTypes';
import { TASK_TYPE_CONFIG, PRIORITY_COLORS } from '@/lib/projectTypes';
import { useState } from 'react';
import { Plus, X, Trash2, Pencil, ChevronRight, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  projectId: string;
  onTaskClick?: (task: ProjectTask) => void;
}

const COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];

function buildEpicPayload(form: { title: string; color: string; start_date: string; due_date: string; sprint_id: string }) {
  const payload: Record<string, any> = { title: form.title, color: form.color };
  if (form.start_date) payload.start_date = form.start_date;
  if (form.due_date) payload.due_date = form.due_date;
  if (form.sprint_id) payload.sprint_id = form.sprint_id;
  return payload;
}

export default function EpicsView({ projectId, onTaskClick }: Props) {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editEpic, setEditEpic] = useState<Epic | null>(null);
  const [form, setForm] = useState({ title: '', color: '#3B82F6', start_date: '', due_date: '', sprint_id: '' });
  const [selectedEpic, setSelectedEpic] = useState<Epic | null>(null);
  const [deleteEpicId, setDeleteEpicId] = useState<string | null>(null);

  const { data: epicsRaw } = useQuery({
    queryKey: ['project-epics', projectId],
    queryFn: () => api.get(`/projects/${projectId}/epics`).then(r => extractProjectArray<Epic>(r.data, ['epics'])),
  });
  const epics: Epic[] = Array.isArray(epicsRaw) ? epicsRaw : [];

  const { data: sprintsRaw } = useQuery({
    queryKey: ['project-sprints', projectId],
    queryFn: () => api.get(`/projects/${projectId}/sprints`).then(r => extractProjectArray<Sprint>(r.data, ['sprints'])),
  });
  const sprints: Sprint[] = Array.isArray(sprintsRaw) ? sprintsRaw : [];

  const createMut = useMutation({
    mutationFn: (d: typeof form) => api.post(`/projects/${projectId}/epics`, buildEpicPayload(d)),
    onSuccess: (res) => {
      const newEpic = extractProjectEntity<Epic>(res.data, ['epic']);
      if (newEpic?.id) {
        qc.setQueryData(['project-epics', projectId], (old: any) => {
          const prev = Array.isArray(old) ? old : [];
          return prev.some((item: any) => item?.id === newEpic.id) ? prev : [...prev, newEpic];
        });
      }
      setTimeout(() => qc.invalidateQueries({ queryKey: ['project-epics', projectId] }), 1500);
      setShowCreate(false);
      setForm({ title: '', color: '#3B82F6', start_date: '', due_date: '', sprint_id: '' });
      toast.success('Epic created');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Error creating epic'),
  });

  const updateMut = useMutation({
    mutationFn: ({ epicId, data }: { epicId: string; data: typeof form }) =>
      api.put(`/projects/${projectId}/epics/${epicId}`, buildEpicPayload(data)),
    onSuccess: (res) => {
      const updated = extractProjectEntity<Epic>(res.data, ['epic']);
      if (updated?.id) {
        qc.setQueryData(['project-epics', projectId], (old: any) => {
          const prev = Array.isArray(old) ? old : [];
          return prev.map((e: any) => e.id === updated.id ? { ...e, ...updated } : e);
        });
        if (selectedEpic?.id === updated.id) setSelectedEpic({ ...selectedEpic, ...updated });
      }
      setTimeout(() => qc.invalidateQueries({ queryKey: ['project-epics', projectId] }), 1500);
      setEditEpic(null);
      setForm({ title: '', color: '#3B82F6', start_date: '', due_date: '', sprint_id: '' });
      toast.success('Epic updated');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Error updating epic'),
  });

  const deleteMut = useMutation({
    mutationFn: (epicId: string) => api.delete(`/projects/${projectId}/epics/${epicId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-epics', projectId] });
      if (selectedEpic?.id === deleteEpicId) setSelectedEpic(null);
      setDeleteEpicId(null);
      toast.success('Epic deleted');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Error deleting epic'),
  });

  const openEdit = (epic: Epic) => {
    setEditEpic(epic);
    setForm({
      title: epic.title,
      color: epic.color || '#3B82F6',
      start_date: epic.start_date?.split('T')[0] || '',
      due_date: epic.due_date?.split('T')[0] || '',
      sprint_id: (epic as any).sprint_id || '',
    });
  };

  // Timeline calculation
  const allDates = epics.flatMap(e => [e.start_date, e.due_date].filter(Boolean)).map(d => new Date(d!).getTime());
  const minDate = allDates.length > 0 ? Math.min(...allDates) : Date.now();
  const maxDate = allDates.length > 0 ? Math.max(...allDates) : Date.now() + 86400000 * 90;
  const range = maxDate - minDate || 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Epics Timeline</h3>
        <button onClick={() => { setEditEpic(null); setForm({ title: '', color: '#3B82F6', start_date: '', due_date: '', sprint_id: '' }); setShowCreate(true); }} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 active:scale-[0.97] transition-all">
          <Plus className="h-3 w-3" /> New Epic
        </button>
      </div>

      {/* Timeline */}
      <div className="glass-card p-4 space-y-3">
        {epics.map(epic => {
          const start = epic.start_date ? new Date(epic.start_date).getTime() : minDate;
          const end = epic.due_date ? new Date(epic.due_date).getTime() : maxDate;
          const left = ((start - minDate) / range) * 100;
          const width = Math.max(((end - start) / range) * 100, 5);

          return (
            <div key={epic.id} className="flex items-center gap-3 cursor-pointer hover:bg-secondary/50 rounded-lg p-2 transition-colors group" onClick={() => setSelectedEpic(epic)}>
              <div className="w-40 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded" style={{ background: epic.color }} />
                  <span className="text-sm font-medium truncate">{epic.title}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">{epic.done_count || 0}/{epic.task_count || 0} tasks</span>
              </div>
              <div className="flex-1 relative h-8">
                <div className="absolute inset-0 bg-secondary rounded-full" />
                <div
                  className="absolute top-0 h-full rounded-full flex items-center justify-end px-2"
                  style={{ left: `${left}%`, width: `${width}%`, background: epic.color, opacity: 0.8 }}
                >
                  <span className="text-[10px] font-bold text-white">{epic.progress || 0}%</span>
                </div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); openEdit(epic); }} className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-secondary text-muted-foreground hover:text-foreground transition-all" title="Edit Epic">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); setDeleteEpicId(epic.id); }} className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all" title="Delete Epic">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
        {epics.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No epics yet</p>}
      </div>

      {/* Epic detail panel with stories fetched from API */}
      {selectedEpic && (
        <EpicDetailPanel epic={selectedEpic} projectId={projectId} onClose={() => setSelectedEpic(null)} onDelete={() => setDeleteEpicId(selectedEpic.id)} onEdit={() => openEdit(selectedEpic)} onTaskClick={onTaskClick} />
      )}

      {/* Delete Confirmation */}
      {deleteEpicId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-sm p-6 space-y-4 animate-slide-up">
            <h2 className="text-lg font-semibold">Delete Epic</h2>
            <p className="text-sm text-muted-foreground">Are you sure you want to delete this epic? Tasks assigned to it will be unlinked.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteEpicId(null)} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors">Cancel</button>
              <button onClick={() => deleteMut.mutate(deleteEpicId)} disabled={deleteMut.isPending} className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50">
                {deleteMut.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit modal */}
      {(showCreate || editEpic) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-md p-6 space-y-4 animate-slide-up">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editEpic ? 'Edit Epic' : 'New Epic'}</h2>
              <button onClick={() => { setShowCreate(false); setEditEpic(null); }} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
            </div>
            <input placeholder="Epic title *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Color</label>
              <div className="flex gap-2">
                {COLORS.map(c => (
                  <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))} className={`w-7 h-7 rounded-full border-2 transition-all ${form.color === c ? 'border-foreground scale-110' : 'border-transparent'}`} style={{ background: c }} />
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Sprint</label>
              <select value={form.sprint_id} onChange={e => setForm(f => ({ ...f, sprint_id: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
                <option value="">No Sprint (Backlog)</option>
                {sprints.filter(s => s.status !== 'Completed').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-muted-foreground">Start Date</label><input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
              <div><label className="text-xs text-muted-foreground">Due Date</label><input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" /></div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowCreate(false); setEditEpic(null); }} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-secondary">Cancel</button>
              <button
                onClick={() => editEpic ? updateMut.mutate({ epicId: editEpic.id, data: form }) : createMut.mutate(form)}
                disabled={!form.title || createMut.isPending || updateMut.isPending}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 active:scale-[0.97] transition-all disabled:opacity-50"
              >
                {(createMut.isPending || updateMut.isPending) ? 'Saving...' : editEpic ? 'Update Epic' : 'Create Epic'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EpicDetailPanel({ epic, projectId, onClose, onDelete, onEdit, onTaskClick }: { epic: Epic; projectId: string; onClose: () => void; onDelete: () => void; onEdit: () => void; onTaskClick?: (t: ProjectTask) => void }) {
  const [expandedStories, setExpandedStories] = useState<Set<string>>(new Set());

  // Fetch stories under this epic using the proper endpoint
  const { data: storiesRaw } = useQuery({
    queryKey: ['epic-stories', epic.id],
    queryFn: () => api.get('/tasks', { params: { epic_id: epic.id, type: 'Story' } }).then(r => extractProjectArray<ProjectTask>(r.data, ['tasks'])),
  });
  const stories = Array.isArray(storiesRaw) ? storiesRaw : [];

  // Also fetch non-story tasks (Task, Bug) under this epic
  const { data: otherTasksRaw } = useQuery({
    queryKey: ['epic-other-tasks', epic.id],
    queryFn: async () => {
      try {
        const [tasksRes, bugsRes] = await Promise.all([
          api.get('/tasks', { params: { epic_id: epic.id, type: 'Task' } }),
          api.get('/tasks', { params: { epic_id: epic.id, type: 'Bug' } }),
        ]);
        return [
          ...extractProjectArray<ProjectTask>(tasksRes.data, ['tasks']),
          ...extractProjectArray<ProjectTask>(bugsRes.data, ['tasks']),
        ];
      } catch {
        return [];
      }
    },
  });
  const otherTasks = Array.isArray(otherTasksRaw) ? otherTasksRaw : [];

  // Fetch subtasks for expanded stories
  const expandedIds = Array.from(expandedStories);
  const { data: subtaskMap } = useQuery({
    queryKey: ['story-subtasks', expandedIds],
    queryFn: async () => {
      const results: Record<string, ProjectTask[]> = {};
      await Promise.all(expandedIds.map(async sid => {
        try {
          const r = await api.get('/tasks', { params: { parent_task_id: sid } });
          results[sid] = extractProjectArray<ProjectTask>(r.data, ['tasks']);
        } catch { results[sid] = []; }
      }));
      return results;
    },
    enabled: expandedIds.length > 0,
  });

  const toggleStory = (id: string) => {
    setExpandedStories(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const TaskRow = ({ task, indent = 0 }: { task: ProjectTask; indent?: number }) => {
    const tc = TASK_TYPE_CONFIG[task.type] || TASK_TYPE_CONFIG.Task;
    const pc = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.Medium;
    const isStory = task.type === 'Story';
    const isExpanded = expandedStories.has(task.id);
    const subs = subtaskMap?.[task.id] || [];

    return (
      <>
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-secondary/50 cursor-pointer transition-colors"
          style={{ paddingLeft: `${12 + indent * 20}px` }}
          onClick={() => onTaskClick?.(task)}
        >
          {isStory && (
            <button onClick={(e) => { e.stopPropagation(); toggleStory(task.id); }} className="p-0.5">
              {isExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
            </button>
          )}
          {!isStory && <span className="w-4" />}
          <span className="text-sm">{tc.icon}</span>
          <span className="text-xs font-mono text-muted-foreground w-16 flex-shrink-0">{task.task_number}</span>
          <span className="text-sm font-medium flex-1 truncate">{task.title}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{task.status}</span>
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: pc }} title={task.priority} />
        </div>
        {isStory && isExpanded && subs.map(sub => (
          <TaskRow key={sub.id} task={sub} indent={indent + 1} />
        ))}
        {isStory && isExpanded && subs.length === 0 && (
          <p className="text-[10px] text-muted-foreground py-1" style={{ paddingLeft: `${32 + indent * 20}px` }}>No sub-tasks</p>
        )}
      </>
    );
  };

  return (
    <div className="glass-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ background: epic.color }} />
          <h3 className="font-semibold">{epic.title}</h3>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onEdit} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Edit Epic">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Delete Epic">
            <Trash2 className="h-4 w-4" />
          </button>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div><span className="text-muted-foreground text-xs">Progress</span><p className="font-semibold">{epic.progress || 0}%</p></div>
        <div><span className="text-muted-foreground text-xs">Tasks</span><p className="font-semibold">{epic.done_count || 0}/{epic.task_count || 0}</p></div>
        <div><span className="text-muted-foreground text-xs">Due</span><p className="font-semibold">{epic.due_date ? new Date(epic.due_date).toLocaleDateString() : '—'}</p></div>
      </div>

      {/* Stories */}
      {stories.length > 0 && (
        <div className="border-t border-border pt-3 space-y-1">
          <h4 className="text-xs font-semibold text-muted-foreground mb-2">Stories</h4>
          {stories.map(task => <TaskRow key={task.id} task={task} />)}
        </div>
      )}

      {/* Other tasks (Task, Bug) */}
      {otherTasks.length > 0 && (
        <div className="border-t border-border pt-3 space-y-1">
          <h4 className="text-xs font-semibold text-muted-foreground mb-2">Tasks & Bugs</h4>
          {otherTasks.map(task => <TaskRow key={task.id} task={task} />)}
        </div>
      )}

      {stories.length === 0 && otherTasks.length === 0 && (
        <div className="border-t border-border pt-3">
          <p className="text-xs text-muted-foreground text-center py-3">No tasks in this epic</p>
        </div>
      )}
    </div>
  );
}
