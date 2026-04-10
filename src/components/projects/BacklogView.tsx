import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { extractProjectArray } from '@/lib/projectResponse';
import type { Epic, Sprint, ProjectTask } from '@/lib/projectTypes';
import { TASK_TYPE_CONFIG, PRIORITY_COLORS } from '@/lib/projectTypes';
import { useState } from 'react';
import { Plus, ArrowRight, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  projectId: string;
  onTaskClick?: (task: any) => void;
  onCreateTask?: () => void;
}

export default function BacklogView({ projectId, onTaskClick, onCreateTask }: Props) {
  const qc = useQueryClient();
  const [sprintPickerEpicId, setSprintPickerEpicId] = useState<string | null>(null);

  // Fetch unplanned epics
  const { data: epicsRaw, isLoading: epicsLoading } = useQuery({
    queryKey: ['project-backlog', projectId],
    queryFn: async () => {
      try {
        const r = await api.get(`/projects/${projectId}/backlog`);
        console.log('[Backlog] response:', r.data);
        return extractProjectArray<Epic>(r.data, ['epics', 'backlog', 'items']);
      } catch (err: any) {
        console.warn('[Backlog] failed:', err.response?.status);
        try {
          const r = await api.get(`/projects/${projectId}/epics`, { params: { sprint_id: 'backlog' } });
          return extractProjectArray<Epic>(r.data, ['epics']);
        } catch { return []; }
      }
    },
  });
  const epics: Epic[] = Array.isArray(epicsRaw) ? epicsRaw : [];

  // Fetch unassigned tasks (tasks not in any sprint/epic)
  const { data: tasksRaw, isLoading: tasksLoading } = useQuery({
    queryKey: ['project-backlog-tasks', projectId],
    queryFn: async () => {
      try {
        const r = await api.get('/tasks', { params: { project_id: projectId, backlog: true } });
        const backlogTasks = extractProjectArray<ProjectTask>(r.data, ['tasks']);
        if (backlogTasks.length > 0) return backlogTasks;
        // Fallback: fetch all project tasks so nothing is hidden
        const all = await api.get('/tasks', { params: { project_id: projectId } });
        return extractProjectArray<ProjectTask>(all.data, ['tasks']);
      } catch {
        try {
          const r = await api.get('/tasks', { params: { project_id: projectId } });
          return extractProjectArray<ProjectTask>(r.data, ['tasks']);
        } catch { return []; }
      }
    },
  });
  const tasks: ProjectTask[] = Array.isArray(tasksRaw) ? tasksRaw : [];

  const { data: sprintsRaw } = useQuery({
    queryKey: ['project-sprints', projectId],
    queryFn: () => api.get(`/projects/${projectId}/sprints`).then(r => extractProjectArray<Sprint>(r.data, ['sprints'])),
  });
  const sprints: Sprint[] = (Array.isArray(sprintsRaw) ? sprintsRaw : []).filter(s => s.status !== 'Completed');

  const moveToSprintMut = useMutation({
    mutationFn: ({ epicId, sprintId }: { epicId: string; sprintId: string }) =>
      api.put(`/projects/${projectId}/epics/${epicId}`, { sprint_id: sprintId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-backlog', projectId] });
      qc.invalidateQueries({ queryKey: ['project-sprints', projectId] });
      qc.invalidateQueries({ queryKey: ['project-epics', projectId] });
      setSprintPickerEpicId(null);
      toast.success('Epic added to sprint');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to move epic'),
  });

  const isLoading = epicsLoading || tasksLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Backlog</h3>
        {onCreateTask && (
          <button onClick={onCreateTask} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 active:scale-[0.97] transition-all">
            <Plus className="h-3 w-3" /> Create Item
          </button>
        )}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground text-center py-8">Loading backlog…</p>}

      {/* Unplanned Epics */}
      {epics.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Unplanned Epics</h4>
          {epics.map(epic => {
            const total = epic.total_tasks ?? epic.task_count ?? 0;
            const done = epic.done_count ?? 0;
            const open = epic.open_tasks ?? (total - done);
            const progress = total > 0 ? Math.round((done / total) * 100) : 0;

            return (
              <div key={epic.id} className="glass-card p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded" style={{ background: epic.color }} />
                    <span className="text-sm font-semibold">{epic.title}</span>
                    {epic.sprint_name && <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{epic.sprint_name}</span>}
                  </div>
                  <button
                    onClick={() => setSprintPickerEpicId(epic.id)}
                    className="flex items-center gap-1 px-3 py-1 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                  >
                    <ArrowRight className="h-3 w-3" /> Add to Sprint
                  </button>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{total} total</span>
                  <span className="text-primary">{done} done</span>
                  <span>{open} open</span>
                </div>
                {total > 0 && (
                  <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Unassigned Tasks */}
      {tasks.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tasks</h4>
          {tasks.map(task => {
            const tc = TASK_TYPE_CONFIG[task.type] || TASK_TYPE_CONFIG.Task;
            const pc = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.Medium;
            return (
              <div
                key={task.id}
                onClick={() => onTaskClick?.(task)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg glass-card hover:bg-secondary/50 cursor-pointer transition-colors"
              >
                <span className="text-sm">{tc.icon}</span>
                <span className="text-xs font-mono text-muted-foreground w-16 flex-shrink-0">{task.task_number}</span>
                <span className="text-sm font-medium flex-1 truncate">{task.title}</span>
                {task.epic_name && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${task.epic_color || '#888'}22`, color: task.epic_color || '#888' }}>{task.epic_name}</span>
                )}
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{task.status}</span>
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: pc }} title={task.priority} />
                {task.assignees && task.assignees.length > 0 ? (
                  <div className="flex -space-x-1">
                    {task.assignees.slice(0, 3).map(a => (
                      <div key={a.id} className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center text-[8px] font-bold text-primary border border-card">{a.full_name?.[0]}</div>
                    ))}
                  </div>
                ) : (
                  <span className="text-[10px] text-muted-foreground">Unassigned</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {epics.length === 0 && tasks.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground mb-2">Backlog is empty</p>
          {onCreateTask && <button onClick={onCreateTask} className="text-sm text-primary hover:underline">Create an item →</button>}
        </div>
      )}

      {/* Sprint Picker Modal */}
      {sprintPickerEpicId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-sm p-6 space-y-4 animate-slide-up">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Add to Sprint</h2>
              <button onClick={() => setSprintPickerEpicId(null)} className="p-1 rounded-md hover:bg-secondary"><X className="h-4 w-4" /></button>
            </div>
            {sprints.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active or planned sprints. Create a sprint first.</p>
            ) : (
              <div className="space-y-2">
                {sprints.map(s => (
                  <button
                    key={s.id}
                    onClick={() => moveToSprintMut.mutate({ epicId: sprintPickerEpicId, sprintId: s.id })}
                    disabled={moveToSprintMut.isPending}
                    className="w-full flex items-center justify-between p-3 rounded-lg bg-secondary hover:bg-secondary/80 text-sm transition-colors disabled:opacity-50"
                  >
                    <span className="font-medium">{s.name}</span>
                    <span className={s.status === 'Active' ? 'badge-success' : 'badge-neutral'}>{s.status}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
